import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import ResearchJob from '../models/ResearchJob';
import TrendVideo from '../models/TrendVideo';
import Idea from '../models/Idea';
import Script from '../models/Script';
import ProductBrief from '../models/ProductBrief';
import BrandProfile from '../models/BrandProfile';
import {
  runResearchPipeline,
  resumeResearchPipeline,
  defaultEmit,
  type EmitFn,
} from '../services/researchPipelineService';
import { publishJobEvent, subscribeJobEvents } from '../utils/jobEventBus';

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

export const createResearchJob = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, autoSelectTop3 } = req.body;

  if (!productId) {
    throw new ApiError(400, 'Thiếu productId');
  }

  const product = await ProductBrief.findOne({ _id: productId, userId: req.userId });
  if (!product) {
    throw new ApiError(404, 'Không tìm thấy sản phẩm (productId không hợp lệ hoặc không thuộc user này)');
  }

  const brandProfile = await BrandProfile.findOne({ userId: req.userId, isActive: true });

  const job = await ResearchJob.create({
    userId: req.userId,
    productId,
    brandProfileId: brandProfile?._id,
    status: 'queued',
    autoSelectTop3: typeof autoSelectTop3 === 'boolean' ? autoSelectTop3 : true,
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

export const selectHashtags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { selectedHashtags } = req.body;

  if (!Array.isArray(selectedHashtags) || selectedHashtags.length === 0) {
    throw new ApiError(400, 'selectedHashtags phải là mảng không rỗng');
  }
  if (!selectedHashtags.every((tag) => typeof tag === 'string' && tag.trim().length > 0)) {
    throw new ApiError(400, 'selectedHashtags phải là mảng chuỗi hợp lệ');
  }

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

  const unsubscribe = subscribeJobEvents(job.id, (event, payload) => send(event, payload));

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
