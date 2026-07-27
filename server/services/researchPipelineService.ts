import { GoogleGenAI } from '@google/genai';
import ResearchJob, { IResearchJob, ResearchJobStatus } from '../models/ResearchJob';
import ProductBrief, { IProductBrief } from '../models/ProductBrief';
import BrandProfile from '../models/BrandProfile';
import PromptTemplate from '../models/PromptTemplate';
import TrendVideo, { ITrendVideo } from '../models/TrendVideo';
import Idea from '../models/Idea';
import Script from '../models/Script';
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
import { HashtagSuggestionsSchema, GeneratedScriptsSchema } from '../types/pipeline';
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

export type PipelineEvent = 'progress' | 'stage_complete' | 'error' | 'done';
export type EmitFn = (event: PipelineEvent, payload: Record<string, unknown>) => void;

export const defaultEmit: EmitFn = (event, payload) => {
  console.log(`[Pipeline] emit(${event}):`, JSON.stringify(payload));
};

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
      targetAudience: brandProfile?.targetAudience?.painPoints?.join(', ') ?? '',
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

    const result = await tiktokService.searchTrendVideosByHashtags(job.selectedHashtags, { topN: 5 });

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
  await setStatus(job, 'analyzing');
  const jobId = String(job._id);

  const videos = await TrendVideo.find({ jobId }).sort({ playCount: -1 });
  if (videos.length === 0) {
    throw new Error(`Không có TrendVideo nào cho job ${jobId}`);
  }

  await pushProgress(job, 'analyzing', 'Đọc PromptTemplate(video_analysis)...', 0, emit);
  const template = await fetchPromptTemplate(job.userId.toString(), 'video_analysis');

  let idx = 0;
  let successCount = 0;

  for (const video of videos) {
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
          },
          template,
        });
      }

      // Lưu analysis NGAY sau khi Gemini trả về, KHÔNG đợi xử lý xong cả 5
      // video mới ghi 1 lượt - đây là dữ liệu đã tốn tiền Gemini để lấy.
      video.analysis = analysisResult.analysis;
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
}

// ============================================================
// STAGE 5 - generating_scripts
// ============================================================

const SCRIPT_GEN_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      angle: { type: 'string' },
      targetPainPoint: { type: 'string' },
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
    required: [
      'title',
      'angle',
      'targetPainPoint',
      'hook',
      'body',
      'cta',
      'caption',
      'hashtags',
      'shotList',
      'learnedFrom',
      'confidence',
    ],
  },
} as const;

function buildProductContext(product: IProductBrief): string {
  const parts = [`Tên sản phẩm: ${product.name}`, `Ngành hàng: ${product.category}`, `USP: ${product.usp}`];
  if (product.painPoints) parts.push(`Pain point đã biết: ${product.painPoints}`);
  if (product.faqContent) parts.push(`FAQ: ${product.faqContent}`);
  if (product.socialProof) parts.push(`Social proof: ${product.socialProof}`);
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
 * ràng buộc CỨNG, nhúng nguyên văn vào prompt) + 5 analysis + toàn bộ
 * topComments -> Gemini sinh đúng 5 {idea, script} theo 5 góc tiếp cận khác
 * nhau. Tạo Idea (status='draft') + Script (mỗi idea 1 script) tương ứng.
 */
export async function runStage5GenerateScripts(job: IResearchJob, emit: EmitFn): Promise<void> {
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

  const userPrompt = fillTemplate(template.userPromptTemplate, {
    productContext: buildProductContext(product),
    brandName: brandProfile?.brandName ?? '(chưa có brand profile)',
    toneOfVoice: brandProfile?.toneOfVoice ?? '',
    dontList: brandProfile?.dontList && brandProfile.dontList.length > 0 ? brandProfile.dontList.join('; ') : '(không có ràng buộc đặc biệt)',
    doList: brandProfile?.doList && brandProfile.doList.length > 0 ? brandProfile.doList.join('; ') : '',
    complianceNotes: brandProfile?.complianceNotes ?? '',
    trendContext: buildTrendContext(videos),
  });

  let generatedScripts: ReturnType<typeof GeneratedScriptsSchema.parse>;

  // Idempotent MỨC 1 (raw data): đã có rawGeneratedScripts lưu sẵn (Gemini đã
  // trả kết quả, chỉ chưa tạo hết Idea/Script thì bị chết) -> dùng lại
  // NGUYÊN, không gọi lại Gemini - dữ liệu này đã tốn tiền để sinh ra.
  if (job.rawGeneratedScripts && job.rawGeneratedScripts.length > 0) {
    console.log(
      `[Pipeline] Stage 5 (resume MỨC 1): đã có ${job.rawGeneratedScripts.length} kịch bản Gemini lưu sẵn - bỏ qua gọi lại Gemini.`
    );
    generatedScripts = job.rawGeneratedScripts as unknown as typeof generatedScripts;
  } else {
    await pushProgress(job, 'generating_scripts', 'Gọi Gemini sinh 5 ý tưởng + kịch bản...', 30, emit);

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
    generatedScripts = GeneratedScriptsSchema.parse(parsed);

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

    const idea = await withDbRetry(
      () =>
        Idea.create({
          userId: job.userId,
          title: gs.title,
          description: `[Góc tiếp cận: ${gs.angle}] ${gs.targetPainPoint}`,
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
          angle: gs.angle,
          targetPainPoint: gs.targetPainPoint,
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
    if (stageIndexForStatus(job.status) <= 5) {
      await runStage5GenerateScripts(job, emit);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = job.status;

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
