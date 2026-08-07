import { GoogleGenAI } from '@google/genai';
import ResearchJob, { IResearchJob, IResearchJobCombo, ResearchJobStatus } from '../models/ResearchJob';
import ProductBrief, { IProductBrief } from '../models/ProductBrief';
import BrandProfile from '../models/BrandProfile';
import PromptTemplate from '../models/PromptTemplate';
import TrendVideo, { ITrendVideo } from '../models/TrendVideo';
import Idea from '../models/Idea';
import Script from '../models/Script';
import KnowledgeEntry, { IKnowledgeEntry } from '../models/KnowledgeEntry';
import { GEMINI_MODEL, APIFY_DISCOVERY_LIMIT } from '../config/env';
import { withGeminiRetry, estimateGeminiCost, type GeminiUsage, type PromptTemplateLike } from './geminiVideoService';
import { TikTokService, estimateApifyCost, normalizeToTrendVideo } from './tiktokService';
import {
  downloadVideo,
  getVideoFilePath,
  cleanupVideo,
  cleanupJobTempFiles,
  type DownloadableVideo,
} from './videoDownloadService';
import { analyzeVideo, analyzeFromTextOnly } from './geminiVideoService';
import {
  loadApprovedKnowledgeLibrary,
  buildKnowledgeMatchState,
  formatLibraryForPrompt,
  resolveKnowledgeMatch,
} from './knowledgeMatchService';
import {
  buildValueCommentSeenState,
  saveValueComments,
  loadRecentValueComments,
  formatValueCommentBankForPrompt,
} from './valueCommentService';
import { computeTrendStats, buildSuggestedCombos } from './trendStatsService';
import { HashtagSuggestionsSchema, GeneratedScriptsArraySchema, type GeneratedScript } from '../types/pipeline';
import type { VideoAnalysis } from '../types/videoAnalysis';
import type { ApifyTikTokResult } from '../types/apify';
import { withDbRetry } from '../utils/withDbRetry';
import fs from 'fs/promises';

/**
 * Orchestrator pipeline research: 5 stage tuần tự, cập nhật ResearchJob sau
 * mỗi bước, gọi `emit(event, payload)` để Giai đoạn 3C sau này nối vào SSE
 * (lượt này chỉ console.log qua emit mặc định). File này LÀ nơi được phép ghi
 * DB (khác 3 service thuần geminiVideoService/tiktokService/videoDownloadService
 * ở Giai đoạn 2 - chúng chỉ trả dữ liệu, không tự lưu).
 */

export type PipelineEvent = 'progress' | 'stage_complete' | 'error' | 'done' | 'cancelled';
export type EmitFn = (event: PipelineEvent, payload: Record<string, unknown>) => void;

export const defaultEmit: EmitFn = (event, payload) => {
  console.log(`[Pipeline] emit(${event}):`, JSON.stringify(payload));
};

/**
 * Ném ra khi phát hiện job bị người dùng yêu cầu dừng (checkCancelled()) -
 * KHÁC lỗi thật, orchestrator (runResearchPipeline) bắt riêng loại lỗi này để
 * đặt status='cancelled' thay vì 'failed', không log console.error, không ghi
 * job.error như 1 sự cố.
 */
export class PipelineCancelledError extends Error {
  constructor(public stage: ResearchJobStatus) {
    super(`Job bị dừng theo yêu cầu người dùng ở bước "${stage}"`);
    this.name = 'PipelineCancelledError';
  }
}

/**
 * Kiểm tra cờ cancelRequested TRỰC TIẾP TỪ DB (không dùng job.cancelRequested
 * trong bộ nhớ - job đang chạy có thể đã load từ lâu, request
 * POST /research/jobs/:id/cancel chạy ở 1 request Express KHÁC set cờ này
 * sau đó). Gọi ở đầu mỗi Stage VÀ giữa vòng lặp từng video (Stage 2/3/4) để
 * "dừng ở bất kỳ giai đoạn nào" phản hồi trong vài giây, không phải đợi hết
 * cả Stage đang chạy dở.
 */
async function checkCancelled(job: IResearchJob): Promise<void> {
  const cancelled = await ResearchJob.exists({ _id: job._id, cancelRequested: true });
  if (cancelled) {
    throw new PipelineCancelledError(job.status);
  }
}

// ============================================================
// Gemini text-generation helper dùng chung cho Stage 1 + Stage 5 (không
// phải phân tích video multimodal - đó là việc của geminiVideoService.ts).
// ============================================================

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('FATAL: GEMINI_API_KEY is missing - không thể gọi Gemini');
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

async function callGeminiJson(params: {
  label: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  responseSchema: Record<string, unknown>;
}): Promise<{ text: string; usage: GeminiUsage }> {
  return withGeminiRetry(async () => {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: params.model,
      contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
      config: {
        systemInstruction: params.systemPrompt,
        temperature: params.temperature,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
    });

    if (response.promptFeedback?.blockReason) {
      throw new Error(`Gemini chặn nội dung (safety filter): ${response.promptFeedback.blockReason}`);
    }

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason || 'unknown';
      throw new Error(`Gemini không trả về nội dung (finishReason: ${reason})`);
    }

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
    const model = params.model;

    return {
      text,
      usage: { model, inputTokens, outputTokens, estimatedUsd: estimateGeminiCost(model, inputTokens, outputTokens) },
    };
  }, params.label);
}

function resolveModel(template: PromptTemplateLike): string {
  return template.aiModel && template.aiModel.trim() !== '' ? template.aiModel : GEMINI_MODEL;
}

function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => (key in values ? String(values[key]) : ''));
}

// ============================================================
// Helper cập nhật progress + cộng dồn cost + gọi emit
// ============================================================

// job.save() bọc withDbRetry Ở ĐÂY (không phải ở từng call site) vì
// pushProgress/setStatus được gọi RẤT nhiều lần xuyên suốt cả 5 stage - bọc
// 1 lần ở đây bảo vệ được mọi nơi gọi, không cần sửa từng chỗ.
async function pushProgress(
  job: IResearchJob,
  stage: string,
  message: string,
  percent: number,
  emit: EmitFn
): Promise<void> {
  job.progress.push({ stage, message, percent, at: new Date() });
  await withDbRetry(() => job.save(), `pushProgress(${stage})`);
  emit('progress', { jobId: job._id, stage, message, percent });
}

async function setStatus(job: IResearchJob, status: ResearchJobStatus): Promise<void> {
  job.status = status;
  await withDbRetry(() => job.save(), `setStatus(${status})`);
}

export function addGeminiUsage(job: IResearchJob, usage: GeminiUsage): void {
  job.cost.geminiInputTokens += usage.inputTokens;
  job.cost.geminiOutputTokens += usage.outputTokens;
  job.cost.geminiEstimatedUsd += usage.estimatedUsd;
  recomputeTotalCost(job);
}

/**
 * BUG THẬT tìm thấy qua test (F1-test): bản đầu tiên cộng nhầm
 * apifyEstimatedUsd (ước tính TRƯỚC khi chạy) thay vì apifyActualUsd (chi
 * phí THẬT sau khi Stage 2 xong) - khiến totalEstimatedUsd không bao giờ
 * phản ánh chi phí Apify thật dù đã có số liệu chính xác. Dùng apifyActualUsd
 * làm nguồn chính vì đó là số ĐÁNG TIN CẬY nhất một khi đã có.
 */
export function recomputeTotalCost(job: IResearchJob): void {
  job.cost.totalEstimatedUsd = job.cost.apifyActualUsd + job.cost.geminiEstimatedUsd;
}

/**
 * Giai đoạn 6 Phase 3: ước tính chi phí THÔ TRƯỚC khi tạo job (chưa có
 * hashtag/video thật) - dùng để hiển thị số tiền dự kiến ở modal xác nhận
 * trước khi bấm "Bắt đầu", theo đúng giới hạn videoScanCount/scriptCount
 * người dùng chọn. Giả định 3 hashtag (mặc định autoSelectTop3) cho phần
 * Apify PASS 1; phần Gemini dùng số token trung bình quan sát qua các lần
 * chạy thật trước đó - ĐÂY LÀ ƯỚC TÍNH, không phải billing chính xác (khác
 * apifyActualUsd đọc được sau khi Stage 2 chạy xong - xem recomputeTotalCost).
 */
const ASSUMED_HASHTAG_COUNT_FOR_ESTIMATE = 3;
const AVG_HASHTAG_GEN_INPUT_TOKENS = 400;
const AVG_HASHTAG_GEN_OUTPUT_TOKENS = 500;
const AVG_VIDEO_ANALYSIS_INPUT_TOKENS = 4000;
const AVG_VIDEO_ANALYSIS_OUTPUT_TOKENS = 900;
const AVG_SCRIPT_GEN_INPUT_TOKENS = 2500;
const AVG_SCRIPT_GEN_OUTPUT_TOKENS_PER_SCRIPT = 350;

export interface ResearchJobCostEstimate {
  apifyEstimatedUsd: number;
  geminiEstimatedUsd: number;
  totalEstimatedUsd: number;
}

export function estimateResearchJobCost(videoScanCount: number, scriptCount: number): ResearchJobCostEstimate {
  const estimatedDiscoveryItems = ASSUMED_HASHTAG_COUNT_FOR_ESTIMATE * APIFY_DISCOVERY_LIMIT;
  const apifyEstimatedUsd = estimateApifyCost(estimatedDiscoveryItems, false) + estimateApifyCost(videoScanCount, true);

  const geminiInputTokens =
    AVG_HASHTAG_GEN_INPUT_TOKENS + AVG_VIDEO_ANALYSIS_INPUT_TOKENS * videoScanCount + AVG_SCRIPT_GEN_INPUT_TOKENS;
  const geminiOutputTokens =
    AVG_HASHTAG_GEN_OUTPUT_TOKENS +
    AVG_VIDEO_ANALYSIS_OUTPUT_TOKENS * videoScanCount +
    AVG_SCRIPT_GEN_OUTPUT_TOKENS_PER_SCRIPT * scriptCount;
  const geminiEstimatedUsd = estimateGeminiCost(GEMINI_MODEL, geminiInputTokens, geminiOutputTokens);

  return {
    apifyEstimatedUsd,
    geminiEstimatedUsd,
    totalEstimatedUsd: Math.round((apifyEstimatedUsd + geminiEstimatedUsd) * 100000) / 100000,
  };
}

async function fetchPromptTemplate(userId: string, key: 'hashtag' | 'video_analysis' | 'script_gen') {
  const template = await PromptTemplate.findOne({ userId, key }).sort({ isDefault: -1, createdAt: -1 });
  if (!template) {
    throw new Error(
      `Không tìm thấy PromptTemplate cho key="${key}" (userId=${userId}) - cần chạy "npm run seed" để tạo template mặc định.`
    );
  }
  return template;
}

// ============================================================
// STAGE 1 - generating_hashtags
// ============================================================

const HASHTAG_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      tag: { type: 'string' },
      reason: { type: 'string' },
      score: { type: 'number' },
    },
    required: ['tag', 'reason', 'score'],
  },
} as const;

export async function runStage1GenerateHashtags(job: IResearchJob, emit: EmitFn): Promise<void> {
  await checkCancelled(job);
  await setStatus(job, 'generating_hashtags');

  // Idempotent cho resumeResearchPipeline: nếu đã có suggestedHashtags từ lần
  // chạy trước (crash giữa lúc xong Stage 1 và lúc Stage 2 kịp đổi status),
  // KHÔNG gọi lại Gemini - tốn thêm tiền vô ích cho việc đã xong.
  let hashtags = job.suggestedHashtags;

  if (hashtags.length > 0) {
    console.log(`[Pipeline] Stage 1 (resume): đã có ${hashtags.length} suggestedHashtags từ trước - bỏ qua gọi Gemini lại.`);
    await pushProgress(job, 'generating_hashtags', `Resume: dùng lại ${hashtags.length} gợi ý hashtag đã có`, 50, emit);
  } else {
    await pushProgress(job, 'generating_hashtags', 'Bắt đầu sinh gợi ý hashtag từ sản phẩm...', 0, emit);

    const product = await ProductBrief.findById(job.productId);
    if (!product) {
      throw new Error(`Không tìm thấy ProductBrief (id=${job.productId}) cho job này`);
    }

    const brandProfile = job.brandProfileId ? await BrandProfile.findById(job.brandProfileId) : null;
    const template = await fetchPromptTemplate(job.userId.toString(), 'hashtag');

    const userPrompt = fillTemplate(template.userPromptTemplate, {
      productName: product.name,
      productCategory: product.category,
      brandName: brandProfile?.brandName ?? '(chưa có brand profile)',
      usp: product.usp,
      painPoints: product.painPoints ?? '',
      targetAudience: product.targetAudience ?? '',
    });

    const { text, usage } = await callGeminiJson({
      label: 'Stage1 generateHashtags',
      model: resolveModel(template),
      systemPrompt: template.systemPrompt,
      userPrompt,
      temperature: template.temperature,
      responseSchema: HASHTAG_RESPONSE_SCHEMA,
    });

    addGeminiUsage(job, usage);

    const parsed: unknown = JSON.parse(text);
    hashtags = HashtagSuggestionsSchema.parse(parsed);

    job.suggestedHashtags = hashtags;
    await withDbRetry(() => job.save(), 'Stage1 save suggestedHashtags');

    await pushProgress(
      job,
      'generating_hashtags',
      `Đã sinh ${hashtags.length} gợi ý hashtag (Gemini: ${usage.inputTokens} in / ${usage.outputTokens} out token, ~$${usage.estimatedUsd})`,
      100,
      emit
    );
  }

  const logAndEmitSelected = (tags: string[], reason: string) => {
    // discoveryLimit là số item MỖI HASHTAG (xem env.ts) - cảnh báo chi phí
    // TRƯỚC khi sang stage 2, đúng yêu cầu "chặn được nếu cần".
    const estimatedDiscoveryItems = tags.length * APIFY_DISCOVERY_LIMIT;
    const estimatedApifyCost = estimateApifyCost(estimatedDiscoveryItems, false) + estimateApifyCost(5, true);
    console.log(
      `[Pipeline] Stage 1 xong - ${reason}: [${tags.join(', ')}]. ` +
        `Ước tính chi phí Apify cho Stage 2 (PASS 1 ~${estimatedDiscoveryItems} item + PASS 2 ~5 item tải video) ` +
        `≈ $${estimatedApifyCost} (ước tính thô).`
    );
    emit('stage_complete', { jobId: job._id, stage: 'generating_hashtags', selectedHashtags: tags, estimatedApifyCost });
  };

  if (job.selectedHashtags.length > 0) {
    // Hashtag đã được chọn từ trước - do tự động chọn ở 1 lần chạy trước đó
    // (resume), HOẶC do người dùng chọn thủ công qua
    // POST /api/research/jobs/:id/hashtags trong khi job đang ở trạng thái
    // awaiting_hashtag_selection. Cả 2 trường hợp đều phải đi tiếp sang stage
    // 2 ngay, KHÔNG được quay lại dừng chờ chọn hashtag lần nữa.
    logAndEmitSelected(job.selectedHashtags, 'hashtag đã chọn');
  } else if (job.autoSelectTop3) {
    const top3 = [...hashtags].sort((a, b) => b.score - a.score).slice(0, 3).map((h) => h.tag);
    job.selectedHashtags = top3;
    await withDbRetry(() => job.save(), 'Stage1 save selectedHashtags');
    logAndEmitSelected(top3, 'tự chọn top 3 hashtag');
  } else {
    await setStatus(job, 'awaiting_hashtag_selection');
    console.log(`[Pipeline] Stage 1 xong - autoSelectTop3=false, DỪNG chờ người dùng chọn hashtag (jobId=${job._id}).`);
    emit('stage_complete', { jobId: job._id, stage: 'awaiting_hashtag_selection', suggestedHashtags: hashtags });
  }
}

// ============================================================
// STAGE 2 - scraping
// ============================================================

export async function runStage2Scraping(job: IResearchJob, emit: EmitFn): Promise<void> {
  await checkCancelled(job);
  await setStatus(job, 'scraping');
  const jobId = String(job._id);
  const userId = job.userId.toString();

  const tiktokService = new TikTokService();
  let rawVideos: ApifyTikTokResult[];

  // Idempotent cho resume, MỨC 1 (raw data): nếu đã có rawScrapedVideos lưu
  // sẵn từ lần chạy trước (Apify đã trả kết quả, chỉ chưa lưu hết từng
  // TrendVideo thì bị chết) -> dùng lại NGUYÊN, TUYỆT ĐỐI không gọi lại
  // Apify. Đây chính là sự cố thật 2026-07-27: job chết giữa lúc lưu video
  // thứ 3/5, dữ liệu Apify đã trả về (đã tốn tiền) nhưng chưa kịp lưu.
  if (job.rawScrapedVideos && job.rawScrapedVideos.length > 0) {
    console.log(
      `[Pipeline] Stage 2 (resume MỨC 1): đã có ${job.rawScrapedVideos.length} raw video từ Apify lưu sẵn - ` +
        'bỏ qua gọi lại Apify hoàn toàn.'
    );
    rawVideos = job.rawScrapedVideos as unknown as ApifyTikTokResult[];
    await pushProgress(job, 'scraping', `Resume: dùng lại ${rawVideos.length} video Apify đã lưu sẵn`, 40, emit);
  } else {
    await pushProgress(job, 'scraping', `Bắt đầu cào video cho hashtag: [${job.selectedHashtags.join(', ')}]`, 0, emit);

    if (job.selectedHashtags.length === 0) {
      throw new Error('Không có hashtag nào được chọn (selectedHashtags rỗng) - không thể cào video');
    }

    const result = await tiktokService.searchTrendVideosByHashtags(job.selectedHashtags, {
      topN: job.videoScanCount,
      maxAgeMonths: job.maxVideoAgeMonths,
    });

    if (result.videos.length === 0) {
      throw new Error(
        `Không tìm thấy video nào cho hashtag [${job.selectedHashtags.join(', ')}] - thử hashtag khác hoặc tăng APIFY_DISCOVERY_LIMIT`
      );
    }

    job.cost.apifyActualUsd += result.apifyActualUsd;
    recomputeTotalCost(job);
    // LƯU NGAY raw response TRƯỚC KHI xử lý từng video - dữ liệu này đã tốn
    // tiền Apify để lấy (xem docstring rawScrapedVideos trong ResearchJob.ts).
    job.rawScrapedVideos = result.videos as unknown as Record<string, unknown>[];
    await withDbRetry(() => job.save(), 'Stage2 save rawScrapedVideos');

    rawVideos = result.videos;

    await pushProgress(
      job,
      'scraping',
      `Đã lấy ${result.videos.length} video (tổng ${result.totalFetched} item thô trước khi lọc) và LƯU NGAY raw data. ` +
        `Chi phí Apify THẬT (2 pass): $${result.apifyActualUsd}`,
      40,
      emit
    );
  }

  // Idempotent MỨC 2 (từng video): video nào đã có TrendVideo cho đúng
  // {jobId, videoId} rồi thì bỏ qua, không gọi lại fetchTopComments/upsert.
  let savedCount = 0;
  let skippedCount = 0;

  for (const raw of rawVideos) {
    await checkCancelled(job);
    const normalized = normalizeToTrendVideo(raw, jobId, userId);

    const alreadyExists = await TrendVideo.exists({ jobId, videoId: normalized.videoId });
    if (alreadyExists) {
      skippedCount += 1;
      continue;
    }

    // Lấy comment TUẦN TỰ (không Promise.all) - cùng nguyên tắc tránh dồn
    // request Apify như Stage 3/4 tránh dồn request Gemini.
    const comments = await tiktokService.fetchTopComments(normalized.webVideoUrl, 20);

    await withDbRetry(
      () =>
        TrendVideo.findOneAndUpdate(
          { jobId, videoId: normalized.videoId },
          { $set: { ...normalized, topComments: comments } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
      `Stage2 save TrendVideo ${normalized.videoId}`
    );
    savedCount += 1;

    await pushProgress(
      job,
      'scraping',
      `Đã lưu video ${savedCount + skippedCount}/${rawVideos.length} (id=${normalized.videoId}, playCount=${normalized.playCount}) - ${comments.length} comment`,
      40 + Math.round(((savedCount + skippedCount) / rawVideos.length) * 60),
      emit
    );
  }

  console.log(
    `[Pipeline] Stage 2 xong - đã lưu ${savedCount} TrendVideo mới (bỏ qua ${skippedCount} đã có sẵn) cho job ${jobId}`
  );
  emit('stage_complete', {
    jobId: job._id,
    stage: 'scraping',
    videosCount: savedCount + skippedCount,
    apifyActualUsd: job.cost.apifyActualUsd,
  });
}

// ============================================================
// STAGE 3 - downloading
// ============================================================

/**
 * Tải TUẦN TỰ (concurrency=1) - KHÔNG Promise.all, tránh dồn request lên
 * Apify/yt-dlp cùng lúc. 1 video fail -> downloadStatus='text_only', log,
 * ĐI TIẾP video kế - không throw giữa vòng lặp. File tải về được GIỮ LẠI
 * trên đĩa (chưa cleanup) vì Stage 4 (analyzing) sẽ dùng ngay sau đó - dọn
 * dẹp là trách nhiệm của Stage 4 (finally: cleanupVideo), không phải ở đây.
 */
export async function runStage3Downloading(job: IResearchJob, emit: EmitFn): Promise<void> {
  await checkCancelled(job);
  await setStatus(job, 'downloading');
  const jobId = String(job._id);

  const videos = await TrendVideo.find({ jobId }).sort({ playCount: -1 });
  if (videos.length === 0) {
    throw new Error(`Không có TrendVideo nào cho job ${jobId} - Stage 2 có thể đã fail trước đó`);
  }

  await pushProgress(job, 'downloading', `Bắt đầu tải ${videos.length} video (tuần tự, tầng a -> b -> c)...`, 0, emit);

  let idx = 0;
  const tierCounts: Record<string, number> = {};

  for (const video of videos) {
    await checkCancelled(job);
    idx += 1;

    // Idempotent cho resume: video này đã được thử tải ở lần chạy trước
    // (downloadStatus khác 'pending') -> bỏ qua, không tải lại.
    if (video.downloadStatus !== 'pending') {
      tierCounts[`resume:${video.downloadStatus}`] = (tierCounts[`resume:${video.downloadStatus}`] ?? 0) + 1;
      await pushProgress(
        job,
        'downloading',
        `Video ${idx}/${videos.length} (id=${video.videoId}): resume, đã có downloadStatus=${video.downloadStatus} từ trước - bỏ qua`,
        Math.round((idx / videos.length) * 100),
        emit
      );
      continue;
    }

    const downloadable: DownloadableVideo = {
      videoId: video.videoId,
      webVideoUrl: video.webVideoUrl,
      downloadAddr: video.downloadAddr,
    };

    const result = await downloadVideo({ video: downloadable, jobId });

    video.downloadStatus = result.status;
    await withDbRetry(() => video.save(), `Stage3 save downloadStatus ${video.videoId}`);

    tierCounts[result.source] = (tierCounts[result.source] ?? 0) + 1;

    await pushProgress(
      job,
      'downloading',
      `Video ${idx}/${videos.length} (id=${video.videoId}): ${result.status} (tầng: ${result.source})`,
      Math.round((idx / videos.length) * 100),
      emit
    );
  }

  console.log(`[Pipeline] Stage 3 xong - phân bố tầng tải:`, tierCounts);
  emit('stage_complete', { jobId: job._id, stage: 'downloading', tierCounts });
}

// ============================================================
// STAGE 4 - analyzing
// ============================================================

export const MIN_VIDEOS_WITH_ANALYSIS = 2;

/**
 * Tải nội dung phụ đề (.vtt) về plain text - dùng làm transcript cho video
 * text_only (không có file để Gemini tự nghe). Phòng thủ hoàn toàn: bất kỳ
 * lỗi nào cũng trả undefined, KHÔNG throw, KHÔNG làm chết việc phân tích.
 */
async function fetchSubtitleText(
  subtitleLinks: Array<{ language: string; downloadLink: string }> | undefined
): Promise<string | undefined> {
  if (!subtitleLinks || subtitleLinks.length === 0) return undefined;

  const preferred = subtitleLinks.find((s) => s.language?.toLowerCase().includes('vi')) ?? subtitleLinks[0];

  try {
    const res = await fetch(preferred.downloadLink, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;

    const raw = await res.text();
    const text = raw
      .split('\n')
      .filter((line) => !line.startsWith('WEBVTT') && !/^\d+$/.test(line.trim()) && !line.includes('-->'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text || undefined;
  } catch (error) {
    console.warn('[Pipeline] fetchSubtitleText thất bại (không throw):', error instanceof Error ? error.message : error);
    return undefined;
  }
}

/**
 * Từng video TUẦN TỰ: downloaded_* -> analyzeVideo (video thật, confidence
 * high); text_only hoặc file đã mất trên đĩa (resume sau crash) ->
 * analyzeFromTextOnly (confidence low). 1 video lỗi -> log, ĐI TIẾP, KHÔNG
 * throw giữa vòng lặp - job CHỈ fail nếu < MIN_VIDEOS_WITH_ANALYSIS video có
 * analysis dùng được (kiểm tra ở cuối). finally: LUÔN cleanupVideo() file
 * tạm local, kể cả khi throw - deleteGeminiFile() đã được xử lý BÊN TRONG
 * analyzeVideo() (finally riêng của nó), không gọi lại ở đây.
 */
/**
 * analyzeVideoFn/analyzeFromTextOnlyFn injectable (mặc định = hàm thật từ
 * geminiVideoService.ts) - CHỈ để test dùng mock thay thế trực tiếp, không
 * cần mock module/require (đã thử và không ổn định khi chạy cùng lúc với
 * import ESM của chính file này - xem researchPipelineService.test.ts).
 * Production code không bao giờ truyền tham số thứ 3 này.
 */
export interface Stage4Deps {
  analyzeVideoFn: typeof analyzeVideo;
  analyzeFromTextOnlyFn: typeof analyzeFromTextOnly;
}

const defaultStage4Deps: Stage4Deps = {
  analyzeVideoFn: analyzeVideo,
  analyzeFromTextOnlyFn: analyzeFromTextOnly,
};

export async function runStage4Analyzing(
  job: IResearchJob,
  emit: EmitFn,
  deps: Stage4Deps = defaultStage4Deps
): Promise<void> {
  await checkCancelled(job);
  await setStatus(job, 'analyzing');
  const jobId = String(job._id);

  const videos = await TrendVideo.find({ jobId }).sort({ playCount: -1 });
  if (videos.length === 0) {
    throw new Error(`Không có TrendVideo nào cho job ${jobId}`);
  }

  await pushProgress(job, 'analyzing', 'Đọc PromptTemplate(video_analysis)...', 0, emit);
  const template = await fetchPromptTemplate(job.userId.toString(), 'video_analysis');

  // Tải kho hook/pain point ĐÃ DUYỆT 1 LẦN cho cả Stage 4 (Giai đoạn 6, Phase
  // 2) - đưa Gemini chọn ID khớp nhất thay vì tự bịa; state bị mutate dần khi
  // có entry 'learned' mới tạo, để video sau trong CÙNG job không tạo trùng.
  const userIdStr = job.userId.toString();
  const knowledgeLibrary = await loadApprovedKnowledgeLibrary(userIdStr);
  const knowledgeMatchState = buildKnowledgeMatchState(knowledgeLibrary);
  const hookLibraryText = formatLibraryForPrompt(knowledgeLibrary.hook);
  const painPointLibraryText = formatLibraryForPrompt(knowledgeLibrary.painPoint);
  // Giai đoạn 6 Phase 6: state chống lưu trùng "value comment" xuyên suốt cả
  // lượt Stage 4 - xem valueCommentService.ts.
  const valueCommentSeen = buildValueCommentSeenState();

  let idx = 0;
  let successCount = 0;

  for (const video of videos) {
    await checkCancelled(job);
    idx += 1;

    // Idempotent cho resume: video này đã phân tích xong ở lần chạy trước
    // (analyzedAt đã set) -> bỏ qua, không gọi lại Gemini (tốn tiền + có
    // thể đã xoá file tạm rồi nên không tải lại được nữa).
    if (video.analyzedAt) {
      successCount += 1;
      await pushProgress(
        job,
        'analyzing',
        `Video ${idx}/${videos.length} (id=${video.videoId}): resume, đã phân tích xong từ trước - bỏ qua`,
        Math.round((idx / videos.length) * 100),
        emit
      );
      continue;
    }

    const filePath = getVideoFilePath(jobId, video.videoId);
    const hasDownloadedFile = video.downloadStatus === 'downloaded_apify' || video.downloadStatus === 'downloaded_ytdlp';

    try {
      const fileExists = hasDownloadedFile
        ? await fs.stat(filePath).then(() => true).catch(() => false)
        : false;

      let analysisResult: Awaited<ReturnType<typeof analyzeVideo>>;

      if (fileExists) {
        analysisResult = await deps.analyzeVideoFn({
          filePath,
          mimeType: 'video/mp4',
          template,
          context: {
            caption: video.caption,
            playCount: video.playCount,
            diggCount: video.diggCount,
            hookLibrary: hookLibraryText,
            painPointLibrary: painPointLibraryText,
            topComments: video.topComments,
          },
        });
      } else {
        if (hasDownloadedFile) {
          console.warn(
            `[Pipeline] Stage 4: video ${video.videoId} có downloadStatus=${video.downloadStatus} nhưng file KHÔNG còn trên đĩa (${filePath}) - fallback text_only (có thể do resume sau crash)`
          );
        }

        const subtitles = await fetchSubtitleText(video.subtitleLinks);
        analysisResult = await deps.analyzeFromTextOnlyFn({
          context: {
            caption: video.caption,
            hashtags: video.hashtags,
            topComments: video.topComments,
            subtitles,
            hookLibrary: hookLibraryText,
            painPointLibrary: painPointLibraryText,
          },
          template,
        });
      }

      // Resolve knowledgeMatch THÔ Gemini trả về với kho THẬT trong DB (đối
      // chiếu ID có sẵn, tạo entry 'learned'+'pending' mới nếu Gemini đề
      // xuất pattern chưa có) - xem knowledgeMatchService.ts. Đè lại field
      // knowledgeMatch bằng kết quả ĐÃ RESOLVE trước khi lưu, để phần đọc lại
      // sau này (Phase 3 - thống kê xu hướng) dùng ID/discCode đáng tin cậy.
      const resolvedKnowledgeMatch = await resolveKnowledgeMatch({
        userId: userIdStr,
        raw: analysisResult.analysis.knowledgeMatch,
        state: knowledgeMatchState,
      });

      // Giai đoạn 6 Phase 6: lưu "value comment" AI tự đề xuất (không cần
      // duyệt) - chỉ chấp nhận bình luận khớp verbatim với topComments THẬT
      // của chính video này, xem valueCommentService.ts.
      await saveValueComments({
        userId: userIdStr,
        videoId: video.videoId,
        topComments: video.topComments,
        raw: analysisResult.analysis.valueComments,
        seenNormalized: valueCommentSeen,
      });

      // Lưu analysis NGAY sau khi Gemini trả về, KHÔNG đợi xử lý xong cả 5
      // video mới ghi 1 lượt - đây là dữ liệu đã tốn tiền Gemini để lấy.
      video.analysis = { ...analysisResult.analysis, knowledgeMatch: resolvedKnowledgeMatch };
      video.analysisConfidence = analysisResult.analysis.analysisConfidence;
      video.analyzedAt = new Date();
      await withDbRetry(() => video.save(), `Stage4 save analysis ${video.videoId}`);

      addGeminiUsage(job, analysisResult.usage);
      await withDbRetry(() => job.save(), `Stage4 save cost ${video.videoId}`);

      successCount += 1;

      await pushProgress(
        job,
        'analyzing',
        `Video ${idx}/${videos.length} (${video.videoId}): xong (confidence=${video.analysisConfidence}, ` +
          `${analysisResult.usage.inputTokens} in/${analysisResult.usage.outputTokens} out token)`,
        Math.round((idx / videos.length) * 100),
        emit
      );
    } catch (error) {
      console.error(
        `[Pipeline] Stage 4: video ${video.videoId} LỖI phân tích, bỏ qua, ĐI TIẾP:`,
        error instanceof Error ? error.message : error
      );
      await pushProgress(
        job,
        'analyzing',
        `Video ${idx}/${videos.length} (${video.videoId}): LỖI, bỏ qua`,
        Math.round((idx / videos.length) * 100),
        emit
      );
    } finally {
      await cleanupVideo(filePath);
    }
  }

  if (successCount < MIN_VIDEOS_WITH_ANALYSIS) {
    throw new Error(
      `Chỉ có ${successCount}/${videos.length} video phân tích thành công - cần tối thiểu ${MIN_VIDEOS_WITH_ANALYSIS} video ` +
        'để sinh kịch bản đáng tin cậy. Job dừng lại, không sinh kịch bản từ quá ít dữ liệu.'
    );
  }

  console.log(`[Pipeline] Stage 4 xong - ${successCount}/${videos.length} video phân tích thành công`);
  emit('stage_complete', { jobId: job._id, stage: 'analyzing', successCount, total: videos.length });

  // Giai đoạn 6 Phase 3: dừng lại chờ người dùng xem xu hướng + chọn combo
  // hook/pain point/DISC cho từng kịch bản - TRỪ khi đã chọn từ trước (resume,
  // cùng pattern job.selectedHashtags ở Stage 1). `videos` ở đây là CHÍNH các
  // object đã bị mutate video.analysis trong vòng lặp trên (cùng reference),
  // không cần query lại DB.
  if (job.selectedCombos.length > 0) {
    console.log(
      `[Pipeline] Stage 4 (resume): đã có ${job.selectedCombos.length} selectedCombos từ trước - bỏ qua tính lại xu hướng.`
    );
    return;
  }

  const analyzedVideos = videos.filter((v) => v.analysis);
  const trendStats = await computeTrendStats(analyzedVideos);
  const suggestedCombos = buildSuggestedCombos(trendStats, job.scriptCount);

  job.trendStats = trendStats;
  job.suggestedCombos = suggestedCombos;
  await setStatus(job, 'awaiting_combo_selection');

  await pushProgress(
    job,
    'awaiting_combo_selection',
    `Đã phân tích xong ${successCount} video - chờ chọn combo hook/pain point/DISC cho ${job.scriptCount} kịch bản`,
    100,
    emit
  );

  console.log(`[Pipeline] Stage 4 xong - DỪNG chờ người dùng chọn combo (jobId=${jobId}).`);
  emit('stage_complete', { jobId: job._id, stage: 'awaiting_combo_selection', trendStats, suggestedCombos });
}

// ============================================================
// STAGE 5 - generating_scripts
// ============================================================

/**
 * KHÔNG đặt minItems/maxItems ở đây (đã thử rồi bỏ - xem BUG THẬT bên dưới).
 * Số lượng ĐÚNG job.selectedCombos.length được ép qua text prompt
 * ({{scriptCount}} trong userPromptTemplate) + đối chiếu/cắt bớt/throw rõ
 * ràng SAU KHI parse response (xem runStage5GenerateScripts, dùng
 * GeneratedScriptsArraySchema trong types/pipeline.ts).
 *
 * LỊCH SỬ 2 BUG THẬT liên tiếp ở đúng chỗ này, ghi lại để không lặp lại:
 * (1) Ban đầu KHÔNG có minItems/maxItems -> Gemini thỉnh thoảng sinh THIẾU
 *     item dù prompt ghi rõ số lượng (job 6a6c10ef..., scriptCount=10) ->
 *     zod bắt được NHƯNG sau khi tiền Gemini đã tốn, job fail toàn bộ.
 * (2) Thêm minItems/maxItems để "sửa" (1) -> Gemini API trả lỗi CỨNG
 *     `400 INVALID_ARGUMENT: Request contains an invalid argument` - đây là
 *     giới hạn KHÔNG ghi rõ trong doc chính thức của Gemini (chỉ thấy report
 *     cộng đồng): minItems/maxItems trên 1 responseSchema lồng nhau phức tạp
 *     có thể bị từ chối thẳng, khiến Stage 5 fail 100% MỌI lần gọi (còn tệ
 *     hơn (1), vốn chỉ thỉnh thoảng thiếu item).
 * -> Quay lại KHÔNG dùng minItems/maxItems, xử lý sai lệch số lượng bằng code
 * (cắt bớt nếu thừa, throw rõ ràng nếu thiếu - xem runStage5GenerateScripts).
 */
const SCRIPT_GEN_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      hook: { type: 'string' },
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tStart: { type: 'number' },
            tEnd: { type: 'number' },
            voiceover: { type: 'string' },
            visual: { type: 'string' },
            textOnScreen: { type: 'string' },
          },
          required: ['tStart', 'tEnd', 'voiceover', 'visual', 'textOnScreen'],
        },
      },
      cta: { type: 'string' },
      caption: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
      shotList: { type: 'array', items: { type: 'string' } },
      learnedFrom: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['title', 'hook', 'body', 'cta', 'caption', 'hashtags', 'shotList', 'learnedFrom', 'confidence'],
  },
} as const;

const DISC_LABELS: Record<'D' | 'I' | 'S' | 'C', string> = {
  D: 'D - Dominance (Quyết đoán)',
  I: 'I - Influence (Cảm xúc/Xã hội)',
  S: 'S - Steadiness (Ổn định/An toàn)',
  C: 'C - Conscientiousness (Phân tích/Dữ liệu)',
};

/**
 * Tải sẵn (1 lần, theo lô) toàn bộ KnowledgeEntry được `combos` tham chiếu tới
 * (hook + pain point theo ID cụ thể, disc theo discCode) - dùng để: (1) dựng
 * comboContext cho prompt Gemini, (2) gắn snapshot tên/mô tả THẬT vào
 * Idea/Script sau khi Gemini trả lời, KHÔNG tin Gemini tự nhắc lại tên entry.
 */
interface ComboKnowledgeMaps {
  hookMap: Map<string, IKnowledgeEntry>;
  painPointMap: Map<string, IKnowledgeEntry>;
  discMap: Map<string, IKnowledgeEntry>;
}

async function loadComboKnowledgeMaps(userId: string, combos: IResearchJobCombo[]): Promise<ComboKnowledgeMaps> {
  const hookIds = [...new Set(combos.map((c) => c.hookEntryId).filter((id): id is string => !!id))];
  const painPointIds = [...new Set(combos.map((c) => c.painPointEntryId).filter((id): id is string => !!id))];

  const [hooks, painPoints, discEntries] = await Promise.all([
    hookIds.length > 0 ? KnowledgeEntry.find({ _id: { $in: hookIds } }) : Promise.resolve([]),
    painPointIds.length > 0 ? KnowledgeEntry.find({ _id: { $in: painPointIds } }) : Promise.resolve([]),
    KnowledgeEntry.find({ userId, storeType: 'disc', status: 'approved' }),
  ]);

  return {
    hookMap: new Map(hooks.map((h) => [String(h._id), h])),
    painPointMap: new Map(painPoints.map((p) => [String(p._id), p])),
    discMap: new Map(discEntries.filter((d) => d.discCode).map((d) => [d.discCode as string, d])),
  };
}

function describeKnowledgeEntry(entry: IKnowledgeEntry | undefined): string {
  if (!entry) return '';
  return `${entry.name} - ${entry.description}${entry.example ? ` (VD thực tế: "${entry.example}")` : ''}`;
}

/**
 * Dựng phần prompt liệt kê ĐÚNG combo cho từng slot kịch bản, theo ĐÚNG thứ tự
 * `combos` (index i -> kịch bản thứ i+1) - đây là điểm THAY THẾ hệ "5 góc tiếp
 * cận" cố định cũ: giờ mỗi kịch bản bị RÀNG BUỘC bởi 1 bộ hook/pain point/DISC
 * cụ thể thay vì Gemini tự chọn góc. Slot nào combo để null (người dùng không
 * chỉ định) -> để Gemini tự do quyết định riêng phần đó.
 */
function buildComboContext(combos: IResearchJobCombo[], maps: ComboKnowledgeMaps): string {
  return combos
    .map((combo, i) => {
      const hookText = combo.hookEntryId
        ? describeKnowledgeEntry(maps.hookMap.get(combo.hookEntryId))
        : 'KHÔNG chỉ định - tự chọn công thức hook phù hợp nhất với sản phẩm và bối cảnh xu hướng';
      const painPointText = combo.painPointEntryId
        ? describeKnowledgeEntry(maps.painPointMap.get(combo.painPointEntryId))
        : 'KHÔNG chỉ định - tự chọn nỗi đau khách hàng phù hợp nhất với sản phẩm';
      const discEntry = combo.discCode ? maps.discMap.get(combo.discCode) : undefined;
      const discText = combo.discCode
        ? discEntry
          ? describeKnowledgeEntry(discEntry)
          : DISC_LABELS[combo.discCode]
        : 'KHÔNG chỉ định - tự chọn giọng văn phù hợp nhất';

      return (
        `Kịch bản ${i + 1}:\n` +
        `- Hook BẮT BUỘC dùng: ${hookText}\n` +
        `- Pain point BẮT BUỘC khai thác: ${painPointText}\n` +
        `- Kiểu khách hàng (DISC) BẮT BUỘC nhắm tới: ${discText}`
      );
    })
    .join('\n\n');
}

function buildProductContext(product: IProductBrief): string {
  const parts = [`Tên sản phẩm: ${product.name}`, `Ngành hàng: ${product.category}`, `USP: ${product.usp}`];
  if (product.painPoints) parts.push(`Pain point đã biết: ${product.painPoints}`);
  if (product.targetAudience) parts.push(`Đối tượng phù hợp: ${product.targetAudience}`);
  if (product.usageInstructions) parts.push(`Cách dùng & liều dùng (trích dẫn đúng, không tự suy đoán): ${product.usageInstructions}`);
  if (product.originCountry) parts.push(`Xuất xứ: ${product.originCountry}`);
  if (product.certifications) parts.push(`Chứng nhận/kiểm nghiệm: ${product.certifications}`);
  if (product.price) parts.push(`Giá bán thường: ${product.price.toLocaleString('vi-VN')}đ`);
  if (product.promoPrice) parts.push(`Giá ưu đãi hiện tại: ${product.promoPrice.toLocaleString('vi-VN')}đ`);
  if (product.promotionOffer) parts.push(`Quà tặng/ưu đãi: ${product.promotionOffer}`);
  if (product.safetyNotes) parts.push(`Lưu ý an toàn/khi nào cần hỏi bác sĩ (PHẢI nhắc nếu liên quan): ${product.safetyNotes}`);
  if (product.faqContent) parts.push(`FAQ: ${product.faqContent}`);
  if (product.keywords && product.keywords.length > 0) parts.push(`Từ khoá: ${product.keywords.join(', ')}`);
  return parts.join('\n');
}

function buildTrendContext(videos: ITrendVideo[]): string {
  return videos
    .map((v, i) => {
      const analysis = v.analysis as VideoAnalysis | undefined;
      const commentsText =
        v.topComments && v.topComments.length > 0
          ? v.topComments
              .slice(0, 5)
              .map((c) => `  - "${c.text}" (${c.likeCount} like, @${c.authorHandle})`)
              .join('\n')
          : '  (không có comment)';

      return [
        `--- Video #${i + 1} (id=${v.videoId}, playCount=${v.playCount}, độ tin cậy phân tích=${v.analysisConfidence ?? 'unknown'}) ---`,
        `Caption: ${v.caption}`,
        analysis ? `Hook 3 giây đầu: ${analysis.hook?.firstThreeSeconds ?? ''}` : '',
        analysis ? `Giả thuyết viral: ${analysis.viralHypothesis ?? ''}` : '',
        analysis ? `CTA gốc: ${analysis.cta ?? ''}` : '',
        `Bình luận nổi bật (pain point THẬT bằng ngôn ngữ khách hàng):\n${commentsText}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

/**
 * Gộp ProductBrief + BrandProfile (đặc biệt doList/dontList/complianceNotes -
 * ràng buộc CỨNG, nhúng nguyên văn vào prompt) + video đã phân tích + toàn bộ
 * topComments + ĐÚNG job.selectedCombos (hook/pain point/DISC đã chọn ở bước
 * awaiting_combo_selection, thay cho hệ "5 góc tiếp cận" cố định cũ) -> Gemini
 * sinh đúng job.selectedCombos.length {idea, script}, mỗi cái bám sát 1 combo
 * theo ĐÚNG thứ tự. Tạo Idea (status='draft') + Script (mỗi idea 1 script)
 * tương ứng.
 */
export async function runStage5GenerateScripts(job: IResearchJob, emit: EmitFn): Promise<void> {
  await checkCancelled(job);
  await setStatus(job, 'generating_scripts');
  const jobId = String(job._id);

  // Idempotent cho resume: đã tạo script ở lần chạy trước rồi (crash ngay
  // trước khi kịp set status='completed') -> không sinh lại lần 2.
  if (job.resultScriptIds.length > 0) {
    console.log(`[Pipeline] Stage 5 (resume): job đã có ${job.resultScriptIds.length} script từ trước - bỏ qua sinh lại.`);
    await setStatus(job, 'completed');
    emit('done', { jobId: job._id, resultIdeaIds: job.resultIdeaIds, resultScriptIds: job.resultScriptIds, cost: job.cost });
    return;
  }

  if (job.selectedCombos.length === 0) {
    throw new Error(`Không có combo (hook/pain point/DISC) nào được chọn cho job ${jobId} - không thể sinh kịch bản`);
  }

  await pushProgress(job, 'generating_scripts', 'Tổng hợp dữ liệu từ sản phẩm + brand + video đã phân tích...', 0, emit);

  const videos = await TrendVideo.find({ jobId, analysis: { $exists: true } }).sort({ playCount: -1 });
  if (videos.length < MIN_VIDEOS_WITH_ANALYSIS) {
    throw new Error(
      `Chỉ có ${videos.length} video có analysis - cần tối thiểu ${MIN_VIDEOS_WITH_ANALYSIS} để sinh kịch bản đáng tin cậy`
    );
  }

  const product = await ProductBrief.findById(job.productId);
  if (!product) {
    throw new Error(`Không tìm thấy ProductBrief (id=${job.productId}) cho job này`);
  }

  const brandProfile = job.brandProfileId ? await BrandProfile.findById(job.brandProfileId) : null;
  const template = await fetchPromptTemplate(job.userId.toString(), 'script_gen');
  const knowledgeMaps = await loadComboKnowledgeMaps(job.userId.toString(), job.selectedCombos);
  // Giai đoạn 6 Phase 6: kho "value comment" - giới hạn N bình luận mới nhất
  // (xem MAX_VALUE_COMMENTS_FOR_PROMPT trong valueCommentService.ts) để không
  // phình token cost khi kho lớn dần theo thời gian.
  const valueComments = await loadRecentValueComments(job.userId.toString());

  const userPrompt = fillTemplate(template.userPromptTemplate, {
    productContext: buildProductContext(product),
    brandName: brandProfile?.brandName ?? '(chưa có brand profile)',
    toneOfVoice: brandProfile?.toneOfVoice ?? '',
    dontList: brandProfile?.dontList && brandProfile.dontList.length > 0 ? brandProfile.dontList.join('; ') : '(không có ràng buộc đặc biệt)',
    doList: brandProfile?.doList && brandProfile.doList.length > 0 ? brandProfile.doList.join('; ') : '',
    complianceNotes: brandProfile?.complianceNotes ?? '',
    trendContext: buildTrendContext(videos),
    scriptCount: job.selectedCombos.length,
    comboContext: buildComboContext(job.selectedCombos, knowledgeMaps),
    valueCommentBank: formatValueCommentBankForPrompt(valueComments),
  });

  const expectedCount = job.selectedCombos.length;
  let generatedScripts: GeneratedScript[];

  // Idempotent MỨC 1 (raw data): đã có rawGeneratedScripts lưu sẵn (Gemini đã
  // trả kết quả, chỉ chưa tạo hết Idea/Script thì bị chết) -> dùng lại
  // NGUYÊN, không gọi lại Gemini - dữ liệu này đã tốn tiền để sinh ra.
  if (job.rawGeneratedScripts && job.rawGeneratedScripts.length > 0) {
    console.log(
      `[Pipeline] Stage 5 (resume MỨC 1): đã có ${job.rawGeneratedScripts.length} kịch bản Gemini lưu sẵn - bỏ qua gọi lại Gemini.`
    );
    generatedScripts = job.rawGeneratedScripts as unknown as GeneratedScript[];
  } else {
    await pushProgress(
      job,
      'generating_scripts',
      `Gọi Gemini sinh ${expectedCount} ý tưởng + kịch bản theo combo đã chọn...`,
      30,
      emit
    );

    const { text, usage } = await callGeminiJson({
      label: 'Stage5 generateScripts',
      model: resolveModel(template),
      systemPrompt: template.systemPrompt,
      userPrompt,
      temperature: template.temperature,
      responseSchema: SCRIPT_GEN_RESPONSE_SCHEMA,
    });

    addGeminiUsage(job, usage);

    const parsed: unknown = JSON.parse(text);
    let parsedScripts = GeneratedScriptsArraySchema.parse(parsed);

    // Không còn minItems/maxItems ở responseSchema (xem docstring
    // SCRIPT_GEN_RESPONSE_SCHEMA) - tự đối chiếu số lượng SAU khi parse: thừa
    // thì cắt bớt (an toàn, không mất kịch bản nào trong số combo đã chọn),
    // thiếu thì throw rõ ràng (không thể tự bịa thêm kịch bản cho combo còn
    // lại - sẽ lệch chỉ số combo<->script).
    if (parsedScripts.length > expectedCount) {
      console.warn(
        `[Pipeline] Stage 5: Gemini trả về ${parsedScripts.length} kịch bản, nhiều hơn ${expectedCount} combo đã chọn - cắt bớt, chỉ giữ ${expectedCount} kịch bản đầu (đúng thứ tự combo).`
      );
      parsedScripts = parsedScripts.slice(0, expectedCount);
    }
    if (parsedScripts.length < expectedCount) {
      throw new Error(
        `Gemini chỉ trả về ${parsedScripts.length}/${expectedCount} kịch bản - không đủ để khớp 1-1 với từng combo đã chọn. Thử lại job (Stage 5 sẽ gọi lại Gemini).`
      );
    }
    generatedScripts = parsedScripts;

    // LƯU NGAY kết quả Gemini TRƯỚC KHI tạo Idea/Script - dữ liệu đã tốn
    // tiền Gemini để sinh ra (xem docstring rawGeneratedScripts trong ResearchJob.ts).
    job.rawGeneratedScripts = generatedScripts as unknown as Record<string, unknown>[];
    await withDbRetry(() => job.save(), 'Stage5 save rawGeneratedScripts');

    await pushProgress(job, 'generating_scripts', `Gemini trả về ${generatedScripts.length} kịch bản, đang lưu...`, 70, emit);
  }

  // Idempotent MỨC 2 (từng item): resultScriptIds.length đóng vai trò "đã
  // xử lý xong bao nhiêu item" - resume tiếp tục từ đúng chỗ dở, không tạo
  // trùng Idea/Script cho item đã xong.
  for (let i = 0; i < generatedScripts.length; i++) {
    if (job.resultScriptIds.length > i) {
      continue;
    }

    const gs = generatedScripts[i];
    const combo = job.selectedCombos[i];
    const hookEntry = combo.hookEntryId ? knowledgeMaps.hookMap.get(combo.hookEntryId) : undefined;
    const painPointEntry = combo.painPointEntryId ? knowledgeMaps.painPointMap.get(combo.painPointEntryId) : undefined;

    const comboSummary =
      [
        hookEntry ? `Hook: ${hookEntry.name}` : null,
        painPointEntry ? `Pain point: ${painPointEntry.name}` : null,
        combo.discCode ? `DISC: ${DISC_LABELS[combo.discCode]}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'AI tự do lựa chọn (không có combo cụ thể)';

    const idea = await withDbRetry(
      () =>
        Idea.create({
          userId: job.userId,
          title: gs.title,
          description: comboSummary,
          source: 'research-pipeline',
          priority: 'medium',
          status: 'draft',
          productId: job.productId,
        }),
      `Stage5 create Idea ${i}`
    );

    const contentText = [
      `HOOK: ${gs.hook}`,
      ...gs.body.map(
        (b) =>
          `[${b.tStart}s-${b.tEnd}s] ${b.voiceover} (Hình ảnh: ${b.visual}${b.textOnScreen ? `; Chữ trên màn hình: ${b.textOnScreen}` : ''})`
      ),
      `CTA: ${gs.cta}`,
    ].join('\n');

    const script = await withDbRetry(
      () =>
        Script.create({
          userId: job.userId,
          ideaId: idea._id,
          title: gs.title,
          content: contentText,
          format: 'short',
          callToAction: gs.cta,
          generatedBy: 'ai',
          status: 'draft',
          hookEntryId: combo.hookEntryId ?? undefined,
          hookName: hookEntry?.name,
          painPointEntryId: combo.painPointEntryId ?? undefined,
          targetPainPoint: painPointEntry?.description,
          discCode: combo.discCode ?? undefined,
          body: gs.body,
          caption: gs.caption,
          hashtags: gs.hashtags,
          shotList: gs.shotList,
          learnedFrom: gs.learnedFrom,
          confidence: gs.confidence,
        }),
      `Stage5 create Script ${i}`
    );

    job.resultIdeaIds.push(idea._id);
    job.resultScriptIds.push(script._id);
    await withDbRetry(() => job.save(), `Stage5 save result index ${i}`);
  }
  await setStatus(job, 'completed');

  await pushProgress(
    job,
    'generating_scripts',
    `Hoàn tất - đã tạo ${job.resultIdeaIds.length} idea + ${job.resultScriptIds.length} script. ` +
      `Tổng chi phí ước tính: $${job.cost.totalEstimatedUsd} (Apify thật: $${job.cost.apifyActualUsd}, Gemini ước tính: $${job.cost.geminiEstimatedUsd})`,
    100,
    emit
  );

  console.log(
    `[Pipeline] Stage 5 xong - job ${jobId} COMPLETED. Apify thật=$${job.cost.apifyActualUsd}, Gemini ước tính=$${job.cost.geminiEstimatedUsd}`
  );
  emit('done', { jobId: job._id, resultIdeaIds: job.resultIdeaIds, resultScriptIds: job.resultScriptIds, cost: job.cost });
}

// ============================================================
// ORCHESTRATOR - runResearchPipeline / resumeResearchPipeline
// ============================================================

const STAGE_ORDER: ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'scraping',
  'downloading',
  'analyzing',
  'generating_scripts',
];

export function stageIndexForStatus(status: ResearchJobStatus): number {
  const idx = STAGE_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

/**
 * Điểm vào DUY NHẤT để chạy pipeline. Đọc job.status hiện tại để biết bắt
 * đầu từ stage nào - vì mỗi stage đều tự kiểm tra "đã làm chưa" trước khi
 * làm lại (xem ghi chú "Idempotent cho resume" ở từng stage), gọi hàm này
 * nhiều lần trên cùng 1 job (kể cả từ đầu) đều an toàn về mặt CHI PHÍ, không
 * trả tiền 2 lần cho phần đã xong.
 *
 * Lỗi ở BẤT KỲ stage nào (không riêng gì Stage 5) đều: set status='failed',
 * ghi error{stage,message,at} bằng tiếng Việt dễ hiểu, dọn mọi file tạm còn
 * sót của job (cleanupJobTempFiles), rồi throw lại cho caller (Giai đoạn 3C
 * sẽ bắt lỗi này để trả về SSE/HTTP).
 */
export async function runResearchPipeline(jobId: string, emit: EmitFn = defaultEmit): Promise<void> {
  const job = await ResearchJob.findById(jobId);
  if (!job) {
    throw new Error(`Không tìm thấy ResearchJob (id=${jobId})`);
  }

  if (job.status === 'completed') {
    console.log(`[Pipeline] Job ${jobId} đã completed từ trước - không chạy lại (tránh tốn tiền vô ích).`);
    return;
  }

  if (job.status === 'cancelled') {
    console.log(`[Pipeline] Job ${jobId} đã bị dừng theo yêu cầu người dùng trước đó - không tự chạy lại.`);
    return;
  }

  // Job từng 'failed' - resume từ ĐÚNG stage đã lỗi (lưu trong error.stage),
  // KHÔNG phải làm lại từ đầu. Nếu vì lý do gì đó error.stage rỗng/lạ, an
  // toàn nhất là coi như status hiện tại (rơi về stage 1).
  const effectiveStatus: ResearchJobStatus =
    job.status === 'failed' && job.error?.stage && STAGE_ORDER.includes(job.error.stage as ResearchJobStatus)
      ? (job.error.stage as ResearchJobStatus)
      : job.status;

  const startIndex = stageIndexForStatus(effectiveStatus);
  console.log(
    `[Pipeline] runResearchPipeline(${jobId}): bắt đầu/resume từ stage index ${startIndex} ` +
      `(status hiện tại="${job.status}", effectiveStatus="${effectiveStatus}")`
  );

  try {
    if (startIndex <= 1) {
      await runStage1GenerateHashtags(job, emit);
    }

    if (job.status === 'awaiting_hashtag_selection') {
      console.log(
        `[Pipeline] Job ${jobId} DỪNG chờ người dùng chọn hashtag - gọi lại runResearchPipeline(jobId) sau khi đã set selectedHashtags.`
      );
      return;
    }

    if (stageIndexForStatus(job.status) <= 2) {
      await runStage2Scraping(job, emit);
    }
    if (stageIndexForStatus(job.status) <= 3) {
      await runStage3Downloading(job, emit);
    }
    if (stageIndexForStatus(job.status) <= 4) {
      await runStage4Analyzing(job, emit);
    }

    if (job.status === 'awaiting_combo_selection') {
      console.log(
        `[Pipeline] Job ${jobId} DỪNG chờ người dùng chọn combo - gọi lại runResearchPipeline(jobId) sau khi đã set selectedCombos.`
      );
      return;
    }

    if (stageIndexForStatus(job.status) <= 5) {
      await runStage5GenerateScripts(job, emit);
    }
  } catch (error) {
    const stage = job.status;

    // Dừng theo yêu cầu người dùng (KHÁC lỗi thật) - status='cancelled',
    // không ghi job.error, không log console.error, KHÔNG throw lại (đây là
    // luồng bình thường, không phải sự cố cần .catch() ở call site xử lý).
    if (error instanceof PipelineCancelledError) {
      job.status = 'cancelled';
      await withDbRetry(() => job.save(), 'runResearchPipeline mark cancelled');

      console.log(`[Pipeline] Job ${jobId} đã DỪNG theo yêu cầu người dùng ở stage "${stage}".`);
      emit('cancelled', { jobId: job._id, stage });

      const { deletedCount: cancelledDeletedCount } = await cleanupJobTempFiles(jobId);
      if (cancelledDeletedCount > 0) {
        console.log(`[Pipeline] Đã dọn ${cancelledDeletedCount} file tạm còn sót của job ${jobId} sau khi dừng.`);
      }

      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    job.status = 'failed';
    job.error = { stage, message, at: new Date() };
    await withDbRetry(() => job.save(), 'runResearchPipeline mark failed');

    console.error(`[Pipeline] Job ${jobId} THẤT BẠI ở stage "${stage}": ${message}`);
    emit('error', { jobId: job._id, stage, message });

    const { deletedCount } = await cleanupJobTempFiles(jobId);
    if (deletedCount > 0) {
      console.log(`[Pipeline] Đã dọn ${deletedCount} file tạm còn sót của job ${jobId} trước khi thoát.`);
    }

    throw error;
  }
}

/**
 * Alias có chủ đích cho runResearchPipeline - cùng logic hệt nhau (đọc
 * status hiện tại, mỗi stage tự bỏ qua phần đã xong). Tách tên riêng để gọi
 * ý rõ ràng ở call site: "đây là lần GỌI LẠI sau khi job đã dừng/lỗi",
 * không phải lần chạy đầu tiên.
 */
export async function resumeResearchPipeline(jobId: string, emit: EmitFn = defaultEmit): Promise<void> {
  console.log(`[Pipeline] resumeResearchPipeline(${jobId}) - chạy lại từ stage đang dở, KHÔNG làm lại từ đầu.`);
  return runResearchPipeline(jobId, emit);
}
