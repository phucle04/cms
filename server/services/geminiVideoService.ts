import { GoogleGenAI, ApiError, createUserContent, createPartFromUri } from '@google/genai';
import { GEMINI_MODEL, GEMINI_MAX_RETRIES } from '../config/env';
import { VideoAnalysisSchema, type VideoAnalysis } from '../types/videoAnalysis';

/**
 * Service THUẦN cho Gemini Files API + multimodal analysis. Không tự ghi DB,
 * không tự đọc PromptTemplate từ DB - nhận `template` đã fetch sẵn làm tham
 * số, để dễ test bằng mock và để pipeline (Giai đoạn 3) toàn quyền quyết định
 * lấy template nào. BẮT BUỘC dùng SDK @google/genai (ai.files.*,
 * ai.models.generateContent) - KHÔNG copy cách gọi fetch REST thô của
 * tiktok-ai, chỉ port ý tưởng poll/retry của họ.
 */

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('FATAL: GEMINI_API_KEY is missing - không thể gọi Gemini Files API');
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// b) withGeminiRetry - backoff cố định + jitter, CHỈ retry 429/503
// ============================================================

const BASE_DELAYS_MS = [5000, 15000, 30000, 60000, 90000];
const JITTER_RATIO = 0.2;

function withJitter(ms: number): number {
  const delta = ms * JITTER_RATIO;
  return Math.round(ms - delta + Math.random() * delta * 2);
}

export async function withGeminiRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxRetries = Math.max(1, GEMINI_MAX_RETRIES);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error instanceof ApiError ? error.status : undefined;
      const isRetryable = status === 429 || status === 503;
      const hasAttemptsLeft = attempt < maxRetries - 1;

      if (!isRetryable || !hasAttemptsLeft) {
        throw error;
      }

      const delay = withJitter(BASE_DELAYS_MS[Math.min(attempt, BASE_DELAYS_MS.length - 1)]);
      console.warn(
        `[Gemini retry] ${label}: lần ${attempt + 1}/${maxRetries} thất bại (HTTP ${status}), chờ ${delay}ms rồi thử lại...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================
// a) waitForFileActive - poll mỗi 3s, tối đa 40 lần (~2 phút)
// ============================================================

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

export async function waitForFileActive(
  fileName: string,
  getFile: (name: string) => Promise<{ state?: string }> = (name) => getClient().files.get({ name })
): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const file = await getFile(fileName);

      if (file.state === 'ACTIVE') return;
      if (file.state === 'FAILED') {
        throw new Error(`GEMINI_FILE_FAILED: Gemini xử lý file thất bại (state=FAILED): ${fileName}`);
      }
      // Trạng thái khác (PROCESSING, ...) -> tiếp tục poll.
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('GEMINI_FILE_FAILED')) {
        throw error;
      }
      // Lỗi mạng tạm thời -> nuốt và thử lại, nhưng vẫn tính vào 40 lần.
    }
  }

  throw new Error(
    `Gemini xử lý file quá thời gian chờ (~2 phút, ${MAX_POLL_ATTEMPTS} lần poll, mỗi lần cách nhau ${POLL_INTERVAL_MS}ms) cho file: ${fileName}`
  );
}

// ============================================================
// c) uploadVideoToGemini - upload qua SDK, LUÔN chờ ACTIVE trước khi return
// ============================================================

export async function uploadVideoToGemini(filePath: string, mimeType: string): Promise<string> {
  const client = getClient();

  const uploaded = await client.files.upload({
    file: filePath,
    config: { mimeType },
  });

  if (!uploaded.name) {
    throw new Error(`Gemini không trả về file name sau khi upload: ${filePath}`);
  }

  await waitForFileActive(uploaded.name);

  if (!uploaded.uri) {
    throw new Error(`Gemini không trả về file uri sau khi upload: ${filePath}`);
  }

  return uploaded.uri;
}

// ============================================================
// d) deleteGeminiFile - best-effort, KHÔNG throw (an toàn gọi trong finally)
// ============================================================

function toFileResourceName(fileNameOrUri: string): string {
  if (fileNameOrUri.startsWith('files/')) return fileNameOrUri;
  // Gemini file URI dạng .../v1beta/files/{id} - lấy 2 segment cuối làm
  // resource name mà ai.files.delete()/get() cần ("files/{id}").
  const parts = fileNameOrUri.split('/');
  return parts.slice(-2).join('/');
}

export async function deleteGeminiFile(fileNameOrUri: string): Promise<void> {
  const name = toFileResourceName(fileNameOrUri);
  try {
    await getClient().files.delete({ name });
  } catch (error) {
    console.warn(
      `[Gemini] Không xoá được file trên Gemini Files API (${name}), có thể phải dọn thủ công:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ============================================================
// e) + f) analyzeVideo / analyzeFromTextOnly
// ============================================================

export interface PromptTemplateLike {
  systemPrompt: string;
  userPromptTemplate: string;
  aiModel?: string;
  temperature?: number;
}

export interface VideoAnalysisContext {
  caption: string;
  playCount: number;
  diggCount: number;
  transcript?: string;
}

export interface TextOnlyAnalysisContext {
  caption: string;
  hashtags: string[];
  topComments: Array<{ text: string; likeCount: number; authorHandle: string }>;
  subtitles?: string;
}

// JSON schema (OpenAPI-subset) ép Gemini trả structured output theo đúng
// GeminiVideoAnalysisOutputSchema ở server/types/videoAnalysis.ts. Giữ 2 cái
// đồng bộ thủ công - đổi field ở 1 chỗ thì phải đổi luôn chỗ kia.
const GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    hook: {
      type: 'object',
      properties: {
        firstThreeSeconds: { type: 'string' },
        visualHook: { type: 'string' },
        spokenHook: { type: 'string' },
      },
      required: ['firstThreeSeconds', 'visualHook', 'spokenHook'],
    },
    structure: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tStart: { type: 'number' },
          tEnd: { type: 'number' },
          whatHappens: { type: 'string' },
          purpose: { type: 'string' },
        },
        required: ['tStart', 'tEnd', 'whatHappens', 'purpose'],
      },
    },
    production: {
      type: 'object',
      properties: {
        shotTypes: { type: 'array', items: { type: 'string' } },
        lighting: { type: 'string' },
        props: { type: 'array', items: { type: 'string' } },
        musicStyle: { type: 'string' },
        textOnScreen: { type: 'array', items: { type: 'string' } },
      },
      required: ['shotTypes', 'lighting', 'props', 'musicStyle', 'textOnScreen'],
    },
    viralHypothesis: { type: 'string' },
    cta: { type: 'string' },
    transcript: { type: 'string' },
  },
  required: ['hook', 'structure', 'production', 'viralHypothesis', 'cta', 'transcript'],
} as const;

function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    key in values ? String(values[key]) : ''
  );
}

function resolveModel(template: PromptTemplateLike): string {
  return template.aiModel && template.aiModel.trim() !== '' ? template.aiModel : GEMINI_MODEL;
}

async function callGeminiStructured(params: {
  label: string;
  model: string;
  systemPrompt: string;
  temperature?: number;
  contents: ReturnType<typeof createUserContent>[];
}): Promise<string> {
  return withGeminiRetry(async () => {
    const client = getClient();
    const response = await client.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: {
        systemInstruction: params.systemPrompt,
        temperature: params.temperature,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA,
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

    return text;
  }, params.label);
}

/**
 * Phân tích video thật đã tải về. Upload diễn ra NGOÀI withGeminiRetry (chỉ
 * lời gọi generateContent mới retry) - port đúng hành vi tiktok-ai đã chạy
 * thực tế, tránh việc upload lại cùng 1 file nhiều lần khi retry.
 */
export async function analyzeVideo(params: {
  filePath: string;
  mimeType: string;
  template: PromptTemplateLike;
  context: VideoAnalysisContext;
}): Promise<VideoAnalysis> {
  const { filePath, mimeType, template, context } = params;

  const fileUri = await uploadVideoToGemini(filePath, mimeType);

  try {
    const userPrompt = fillTemplate(template.userPromptTemplate, {
      caption: context.caption,
      playCount: context.playCount,
      diggCount: context.diggCount,
      transcript: context.transcript || '(không có transcript)',
    });

    const raw = await callGeminiStructured({
      label: 'analyzeVideo',
      model: resolveModel(template),
      systemPrompt: template.systemPrompt,
      temperature: template.temperature,
      contents: [createUserContent([userPrompt, createPartFromUri(fileUri, mimeType)])],
    });

    const parsed: unknown = JSON.parse(raw);
    const validated = VideoAnalysisSchema.omit({ analysisConfidence: true }).parse(parsed);

    return { ...validated, analysisConfidence: 'high' };
  } finally {
    await deleteGeminiFile(fileUri);
  }
}

/**
 * Phân tích chỉ bằng text khi không tải được video (cả 2 tầng download đều
 * fail). Cùng schema output với analyzeVideo nhưng analysisConfidence='low',
 * và system instruction yêu cầu Gemini để trống field chỉ suy luận được từ
 * hình ảnh thay vì bịa.
 */
export async function analyzeFromTextOnly(params: {
  context: TextOnlyAnalysisContext;
  template: PromptTemplateLike;
}): Promise<VideoAnalysis> {
  const { context, template } = params;

  const userPrompt = fillTemplate(template.userPromptTemplate, {
    caption: context.caption,
    playCount: '(không rõ - không tải được video)',
    diggCount: '(không rõ - không tải được video)',
    transcript: context.subtitles || '(không có transcript/phụ đề)',
  });

  const extraContext = [
    `Hashtag: ${context.hashtags.length > 0 ? context.hashtags.join(', ') : '(không có)'}`,
    context.topComments.length > 0
      ? `Bình luận nổi bật:\n${context.topComments
          .map((c) => `- ${c.authorHandle || 'ẩn danh'}: "${c.text}" (${c.likeCount} like)`)
          .join('\n')}`
      : 'Bình luận nổi bật: (không có)',
    'LƯU Ý QUAN TRỌNG: Không có file video để xem - chỉ có caption, hashtag, bình luận, và transcript/phụ đề (nếu có). Với các field chỉ có thể suy luận được từ hình ảnh thực tế của video (visualHook, production.shotTypes, production.lighting, production.props, production.textOnScreen), hãy để TRỐNG (chuỗi rỗng "" hoặc mảng rỗng []) thay vì bịa đặt.',
  ].join('\n\n');

  const raw = await callGeminiStructured({
    label: 'analyzeFromTextOnly',
    model: resolveModel(template),
    systemPrompt: template.systemPrompt,
    temperature: template.temperature,
    contents: [createUserContent([`${userPrompt}\n\n${extraContext}`])],
  });

  const parsed: unknown = JSON.parse(raw);
  const validated = VideoAnalysisSchema.omit({ analysisConfidence: true }).parse(parsed);

  return { ...validated, analysisConfidence: 'low' };
}
