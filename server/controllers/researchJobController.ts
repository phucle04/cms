import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import ResearchJob, { type ResearchJobStatus } from '../models/ResearchJob';
import TrendVideo from '../models/TrendVideo';
import Idea from '../models/Idea';
import Script from '../models/Script';
import ProductBrief from '../models/ProductBrief';
import BrandProfile from '../models/BrandProfile';
import {
  runResearchPipeline,
  resumeResearchPipeline,
  defaultEmit,
  estimateResearchJobCost,
  type EmitFn,
} from '../services/researchPipelineService';
import { publishJobEvent, subscribeJobEvents } from '../utils/jobEventBus';
import {
  DAILY_COST_CAP_USD,
  MAX_CONCURRENT_RESEARCH_JOBS,
  DEFAULT_VIDEO_SCAN_COUNT,
  MAX_VIDEO_SCAN_COUNT,
  DEFAULT_SCRIPT_COUNT,
  MAX_SCRIPT_COUNT,
} from '../config/env';

// Job coi là "đang chạy" nếu chưa tới trạng thái cuối (completed/failed) -
// dùng để chặn job trùng (G6#8) + đếm giới hạn đồng thời (G7).
const ACTIVE_JOB_STATUSES: ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'awaiting_hashtag_selection',
  'scraping',
  'downloading',
  'analyzing',
  'awaiting_combo_selection',
  'generating_scripts',
];

/**
 * Chạy pipeline NỀN - KHÔNG await ở call site (request phải trả lời ngay).
 * runResearchPipeline() đã tự ghi status='failed' + error{...} vào DB TRƯỚC
 * khi throw lại (xem researchPipelineService.ts), nên .catch() ở đây chỉ để
 * chặn unhandled promise rejection, không cần xử lý gì thêm - trạng thái
 * job trong DB đã đúng và SSE đã nhận được event 'error' rồi.
 *
 * Giới hạn hiện tại: chạy trong CÙNG process Express, 1 instance duy nhất.
 * Nếu sau này cần scale nhiều instance/container, phần "chạy nền" này phải
 * chuyển sang hàng đợi thật (vd BullMQ + Redis) để job không bị mất khi
 * request rơi vào 1 instance nhưng job lại được xử lý ở instance khác.
 * Việc đó nằm ngoài phạm vi hiện tại.
 */
function runPipelineInBackground(jobId: string, resume: boolean): void {
  const emit: EmitFn = (event, payload) => {
    defaultEmit(event, payload);
    publishJobEvent(jobId, event, payload);
  };

  const run = resume ? resumeResearchPipeline : runResearchPipeline;

  run(jobId, emit).catch((error) => {
    console.error(
      `[ResearchJobController] Job ${jobId} kết thúc với lỗi (đã lưu vào DB, xem job.error):`,
      error instanceof Error ? error.message : error
    );
  });
}

// req.body đã qua validateBody(createResearchJobSchema) - productId chắc
// chắn có mặt, không cần check lại ở đây.
export const createResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, autoSelectTop3, videoScanCount, scriptCount, maxVideoAgeMonths } = req.body;

  const product = await ProductBrief.findOne({ _id: productId, userId: req.userId });
  if (!product) {
    throw new ApiError(404, 'Không tìm thấy sản phẩm (productId không hợp lệ hoặc không thuộc user này)');
  }

  // Chặn job trùng (G6#8, G7): cùng sản phẩm đã có job đang chạy thì không
  // tạo thêm - double-click "Tạo kịch bản" trước đây sẽ tạo 2 job tốn tiền
  // Apify/Gemini gấp đôi cho cùng 1 việc.
  const duplicateJob = await ResearchJob.findOne({
    userId: req.userId,
    productId,
    status: { $in: ACTIVE_JOB_STATUSES },
  });
  if (duplicateJob) {
    throw new ApiError(
      409,
      `Sản phẩm này đã có 1 job đang chạy (job #${duplicateJob.id}, trạng thái "${duplicateJob.status}") - vui lòng chờ job đó xong hoặc thất bại trước khi tạo job mới.`,
      'DUPLICATE_JOB_RUNNING'
    );
  }

  // Giới hạn số job đồng thời (G7): tránh 1 user vô tình (hoặc do bug UI)
  // mở quá nhiều job cùng lúc, mỗi job đều gọi Apify/Gemini tốn tiền thật.
  const activeJobCount = await ResearchJob.countDocuments({
    userId: req.userId,
    status: { $in: ACTIVE_JOB_STATUSES },
  });
  if (activeJobCount >= MAX_CONCURRENT_RESEARCH_JOBS) {
    throw new ApiError(
      429,
      `Đang có ${activeJobCount} job chạy đồng thời (giới hạn ${MAX_CONCURRENT_RESEARCH_JOBS}) - vui lòng chờ bớt job hoàn tất trước khi tạo job mới.`,
      'CONCURRENT_JOB_LIMIT'
    );
  }

  // Trần chi phí/ngày (G7): cộng dồn cost.totalEstimatedUsd của các job user
  // này đã TẠO trong ngày hôm nay (giờ server) - chặn TRƯỚC khi job mới phát
  // sinh thêm chi phí Apify/Gemini nếu đã vượt trần.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysJobs = await ResearchJob.find(
    { userId: req.userId, createdAt: { $gte: startOfToday } },
    { 'cost.totalEstimatedUsd': 1 }
  );
  const spentTodayUsd = todaysJobs.reduce((sum, j) => sum + (j.cost?.totalEstimatedUsd || 0), 0);
  if (spentTodayUsd >= DAILY_COST_CAP_USD) {
    throw new ApiError(
      402,
      `Đã dùng $${spentTodayUsd.toFixed(2)} hôm nay, vượt trần $${DAILY_COST_CAP_USD}/ngày - vui lòng thử lại vào ngày mai hoặc liên hệ quản trị viên để tăng trần (env DAILY_COST_CAP_USD).`,
      'DAILY_COST_CAP_EXCEEDED'
    );
  }

  const brandProfile = await BrandProfile.findOne({ userId: req.userId, isActive: true });

  const job = await ResearchJob.create({
    userId: req.userId,
    productId,
    brandProfileId: brandProfile?._id,
    status: 'queued',
    autoSelectTop3: typeof autoSelectTop3 === 'boolean' ? autoSelectTop3 : true,
    // videoScanCount/scriptCount đã được zod (createResearchJobSchema) chặn
    // trong khoảng [1, MAX_*] nếu có truyền lên - undefined thì Mongoose tự
    // áp default (DEFAULT_VIDEO_SCAN_COUNT/DEFAULT_SCRIPT_COUNT).
    videoScanCount,
    scriptCount,
    // null/không truyền = không giới hạn tuổi video (mặc định, giữ hành vi
    // cũ) - xem docstring maxVideoAgeMonths trong ResearchJob.ts.
    maxVideoAgeMonths: typeof maxVideoAgeMonths === 'number' ? maxVideoAgeMonths : null,
  });

  runPipelineInBackground(job.id, false);

  res.status(201).json({
    success: true,
    data: { jobId: job.id, status: job.status },
    message: 'Đã tạo research job, pipeline đang chạy nền',
  });
});

export const listResearchJobs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

  const filter = { userId: req.userId };
  const [jobs, total] = await Promise.all([
    ResearchJob.find(filter)
      .populate('productId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ResearchJob.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: jobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId })
    .populate('productId')
    .populate('brandProfileId');

  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }

  const [trendVideos, ideas, scripts] = await Promise.all([
    TrendVideo.find({ jobId: job.id }).sort({ playCount: -1 }),
    Idea.find({ _id: { $in: job.resultIdeaIds } }),
    Script.find({ _id: { $in: job.resultScriptIds } }),
  ]);

  res.json({
    success: true,
    data: { job, trendVideos, ideas, scripts },
  });
});

// req.body đã qua validateBody(selectHashtagsSchema) - selectedHashtags chắc
// chắn là mảng chuỗi không rỗng, không cần check lại ở đây.
export const selectHashtags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { selectedHashtags } = req.body;

  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId });
  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }
  if (job.status !== 'awaiting_hashtag_selection') {
    throw new ApiError(
      400,
      `Job đang ở trạng thái "${job.status}", không phải "awaiting_hashtag_selection" - không thể chọn hashtag lúc này`
    );
  }

  job.selectedHashtags = selectedHashtags;
  await job.save();

  runPipelineInBackground(job.id, false);

  res.json({
    success: true,
    data: { jobId: job.id, selectedHashtags: job.selectedHashtags },
    message: 'Đã lưu hashtag đã chọn, pipeline tiếp tục chạy nền từ Stage 2',
  });
});

// req.body đã qua validateBody(selectCombosSchema) - selectedCombos chắc
// chắn là mảng, không cần check lại hình dạng ở đây. Việc khớp ĐÚNG số lượng
// với job.scriptCount là nghiệp vụ, kiểm ở đây (như cổng tuổi ở productController).
export const selectCombos = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { selectedCombos } = req.body;

  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId });
  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }
  if (job.status !== 'awaiting_combo_selection') {
    throw new ApiError(
      400,
      `Job đang ở trạng thái "${job.status}", không phải "awaiting_combo_selection" - không thể chọn combo lúc này`
    );
  }
  if (selectedCombos.length !== job.scriptCount) {
    throw new ApiError(
      400,
      `Cần đúng ${job.scriptCount} combo (bằng scriptCount đã chọn lúc tạo job) - nhận được ${selectedCombos.length}`
    );
  }

  job.selectedCombos = selectedCombos;
  await job.save();

  runPipelineInBackground(job.id, false);

  res.json({
    success: true,
    data: { jobId: job.id, selectedCombos: job.selectedCombos },
    message: 'Đã lưu combo đã chọn, pipeline tiếp tục chạy nền sinh kịch bản',
  });
});

// GET /api/research/estimate-cost?videoScanCount=&scriptCount= - ước tính chi
// phí THÔ trước khi tạo job, hiển thị ở modal xác nhận. Không cần auth chặt -
// đây là phép tính thuần, không đọc/ghi gì của user cụ thể.
export const getResearchJobCostEstimate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const videoScanCountRaw = Number(req.query.videoScanCount);
  const scriptCountRaw = Number(req.query.scriptCount);

  const videoScanCount = Number.isFinite(videoScanCountRaw)
    ? Math.min(Math.max(Math.round(videoScanCountRaw), 1), MAX_VIDEO_SCAN_COUNT)
    : DEFAULT_VIDEO_SCAN_COUNT;
  const scriptCount = Number.isFinite(scriptCountRaw)
    ? Math.min(Math.max(Math.round(scriptCountRaw), 1), MAX_SCRIPT_COUNT)
    : DEFAULT_SCRIPT_COUNT;

  const estimate = estimateResearchJobCost(videoScanCount, scriptCount);

  res.json({
    success: true,
    data: { videoScanCount, scriptCount, ...estimate },
  });
});

export const retryResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId });
  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }
  if (job.status !== 'failed') {
    throw new ApiError(400, `Job đang ở trạng thái "${job.status}", không phải "failed" - không có gì để retry`);
  }

  runPipelineInBackground(job.id, true);

  res.json({
    success: true,
    data: { jobId: job.id, resumingFromStage: job.error?.stage ?? job.status },
    message: 'Đang thử lại job từ stage bị lỗi',
  });
});

// Trạng thái đã kết thúc - không còn gì để dừng.
const TERMINAL_JOB_STATUSES: ResearchJobStatus[] = ['completed', 'failed', 'cancelled'];

// Trạng thái "tạm dừng chờ" - KHÔNG có pipeline nào đang chạy nền tại thời
// điểm này (queued chỉ tồn tại trong khoảnh khắc trước khi
// runPipelineInBackground được gọi; awaiting_hashtag_selection/
// awaiting_combo_selection dừng hẳn chờ người dùng chọn) - set
// cancelRequested=true sẽ KHÔNG có gì bắt được cờ này cho tới khi người dùng
// vô tình kích hoạt lại (vd chọn hashtag/combo), lúc đó pipeline sẽ tự huỷ
// ngay ở stage đầu nhưng UI sẽ hiện nhầm thông báo "đang chạy" trong lúc đó.
// Để UX rõ ràng ngay lập tức, các trạng thái này được set status='cancelled'
// NGAY tại đây thay vì chỉ set cờ chờ.
const PAUSED_NO_ACTIVE_PIPELINE_STATUSES: ResearchJobStatus[] = [
  'queued',
  'awaiting_hashtag_selection',
  'awaiting_combo_selection',
];

export const cancelResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId });
  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }
  if (TERMINAL_JOB_STATUSES.includes(job.status)) {
    throw new ApiError(400, `Job đang ở trạng thái "${job.status}" - không thể dừng`);
  }

  job.cancelRequested = true;

  if (PAUSED_NO_ACTIVE_PIPELINE_STATUSES.includes(job.status)) {
    // Không có pipeline nào đang chạy để tự bắt cờ - dừng ngay tại đây.
    job.status = 'cancelled';
    await job.save();
    res.json({ success: true, data: { jobId: job.id }, message: 'Đã dừng job' });
    return;
  }

  // Pipeline đang chạy nền - chỉ set cờ, pipeline tự kiểm tra và dừng êm
  // trong giây lát (xem checkCancelled() trong researchPipelineService.ts).
  // KHÔNG set status='cancelled' ở đây để tránh đụng độ với pipeline đang tự
  // ghi status của chính nó cùng lúc.
  await job.save();

  res.json({
    success: true,
    data: { jobId: job.id },
    message: 'Đã gửi yêu cầu dừng - job sẽ dừng trong giây lát',
  });
});

export const streamResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const job = await ResearchJob.findOne({ _id: req.params.id, userId: req.userId });
  if (!job) {
    throw new ApiError(404, 'Không tìm thấy research job');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Gửi lại lịch sử tiến độ đã có ngay khi client (mới connect hoặc reconnect
  // sau khi mất mạng) bắt đầu lắng nghe, để không bị "mù" các bước đã qua.
  send('progress_history', { jobId: job.id, status: job.status, progress: job.progress });

  if (job.status === 'completed') {
    send('done', { jobId: job.id, resultIdeaIds: job.resultIdeaIds, resultScriptIds: job.resultScriptIds, cost: job.cost });
    res.end();
    return;
  }
  if (job.status === 'failed') {
    send('error', { jobId: job.id, stage: job.error?.stage, message: job.error?.message });
    res.end();
    return;
  }
  if (job.status === 'cancelled') {
    send('cancelled', { jobId: job.id });
    res.end();
    return;
  }

  const unsubscribe = subscribeJobEvents(job.id, (event, payload) => send(event, payload));

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
