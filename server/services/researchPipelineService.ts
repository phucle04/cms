import { GoogleGenAI } from '@google/genai';
import ResearchJob, { IResearchJob, ResearchJobStatus } from '../models/ResearchJob';
import ProductBrief from '../models/ProductBrief';
import BrandProfile from '../models/BrandProfile';
import PromptTemplate from '../models/PromptTemplate';
import { GEMINI_MODEL, APIFY_DISCOVERY_LIMIT } from '../config/env';
import { withGeminiRetry, estimateGeminiCost, type GeminiUsage, type PromptTemplateLike } from './geminiVideoService';
import { TikTokService, estimateApifyCost } from './tiktokService';
import { HashtagSuggestionsSchema } from '../types/pipeline';

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

async function pushProgress(
  job: IResearchJob,
  stage: string,
  message: string,
  percent: number,
  emit: EmitFn
): Promise<void> {
  job.progress.push({ stage, message, percent, at: new Date() });
  await job.save();
  emit('progress', { jobId: job._id, stage, message, percent });
}

async function setStatus(job: IResearchJob, status: ResearchJobStatus): Promise<void> {
  job.status = status;
  await job.save();
}

function addGeminiUsage(job: IResearchJob, usage: GeminiUsage): void {
  job.cost.geminiInputTokens += usage.inputTokens;
  job.cost.geminiOutputTokens += usage.outputTokens;
  job.cost.geminiEstimatedUsd += usage.estimatedUsd;
  recomputeTotalCost(job);
}

function recomputeTotalCost(job: IResearchJob): void {
  job.cost.totalEstimatedUsd = job.cost.apifyEstimatedUsd + job.cost.geminiEstimatedUsd;
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
  const hashtags = HashtagSuggestionsSchema.parse(parsed);

  job.suggestedHashtags = hashtags;
  await job.save();

  await pushProgress(
    job,
    'generating_hashtags',
    `Đã sinh ${hashtags.length} gợi ý hashtag (Gemini: ${usage.inputTokens} in / ${usage.outputTokens} out token, ~$${usage.estimatedUsd})`,
    100,
    emit
  );

  if (job.autoSelectTop3) {
    const top3 = [...hashtags].sort((a, b) => b.score - a.score).slice(0, 3).map((h) => h.tag);
    job.selectedHashtags = top3;
    await job.save();

    // discoveryLimit là số item MỖI HASHTAG (xem env.ts) - cảnh báo chi phí
    // TRƯỚC khi sang stage 2, đúng yêu cầu "chặn được nếu cần".
    const estimatedDiscoveryItems = top3.length * APIFY_DISCOVERY_LIMIT;
    const estimatedApifyCost = estimateApifyCost(estimatedDiscoveryItems, false) + estimateApifyCost(5, true);
    console.log(
      `[Pipeline] Stage 1 xong - tự chọn top 3 hashtag: [${top3.join(', ')}]. ` +
        `Ước tính chi phí Apify cho Stage 2 (PASS 1 ~${estimatedDiscoveryItems} item + PASS 2 ~5 item tải video) ` +
        `≈ $${estimatedApifyCost} (ước tính thô).`
    );
    emit('stage_complete', { jobId: job._id, stage: 'generating_hashtags', selectedHashtags: top3, estimatedApifyCost });
  } else {
    await setStatus(job, 'awaiting_hashtag_selection');
    console.log(`[Pipeline] Stage 1 xong - autoSelectTop3=false, DỪNG chờ người dùng chọn hashtag (jobId=${job._id}).`);
    emit('stage_complete', { jobId: job._id, stage: 'awaiting_hashtag_selection', suggestedHashtags: hashtags });
  }
}
