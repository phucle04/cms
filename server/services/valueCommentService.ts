import ValueComment from '../models/ValueComment';

/**
 * Đóng vòng kho "value comment" (Giai đoạn 6 Phase 6): lưu bình luận Gemini
 * đề xuất lúc phân tích video (Stage 4) - CHỐNG HALLUCINATION bằng cách chỉ
 * chấp nhận text khớp VERBATIM (chuẩn hoá diacritic-insensitive) với 1 bình
 * luận THẬT trong topComments của chính video đó, cùng nguyên tắc như
 * knowledgeMatchService.ts không tin mù Gemini. Sau đó nạp lại kho này (giới
 * hạn N mới nhất) vào prompt Stage 5 để gợi ý tái dùng cho sản phẩm khác.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export interface RawValueComment {
  text: string;
  reason: string;
}

export interface TopComment {
  text: string;
  likeCount: number;
  authorHandle: string;
}

/**
 * State dùng chung xuyên suốt 1 lượt Stage 4 (nhiều video) - tránh lưu trùng
 * lặp cùng 1 bình luận nhiều lần nếu (hiếm khi) nó xuất hiện ở nhiều video
 * trong CÙNG job, cùng pattern với KnowledgeMatchState.
 */
export function buildValueCommentSeenState(): Set<string> {
  return new Set<string>();
}

export async function saveValueComments(params: {
  userId: string;
  videoId: string;
  topComments: TopComment[];
  raw: RawValueComment[];
  seenNormalized: Set<string>;
}): Promise<void> {
  const { userId, videoId, topComments, raw, seenNormalized } = params;
  if (!raw || raw.length === 0) return;

  for (const item of raw) {
    if (!item.text || !item.text.trim()) continue;

    const normalizedText = normalize(item.text);
    const matched = topComments.find((c) => normalize(c.text) === normalizedText);
    if (!matched) {
      console.warn(
        `[ValueComment] Bỏ qua bình luận Gemini đề xuất nhưng KHÔNG khớp verbatim với topComments thật (video ${videoId})`
      );
      continue;
    }

    if (seenNormalized.has(normalizedText)) continue;

    const alreadyExists = await ValueComment.exists({ userId, normalizedText });
    if (alreadyExists) {
      seenNormalized.add(normalizedText);
      continue;
    }

    await ValueComment.create({
      userId,
      text: matched.text,
      normalizedText,
      reason: item.reason?.trim() || '(không có lý do cụ thể)',
      sourceVideoId: videoId,
      sourceAuthorHandle: matched.authorHandle,
    });
    seenNormalized.add(normalizedText);
  }
}

const MAX_VALUE_COMMENTS_FOR_PROMPT = 20;

/**
 * Nạp lại N bình luận mới nhất (giới hạn cứng, tránh kho lớn dần vô hạn làm
 * phình token cost mỗi lần sinh kịch bản - xem AVG_SCRIPT_GEN_INPUT_TOKENS
 * trong researchPipelineService.ts) để đưa vào prompt Stage 5.
 */
export async function loadRecentValueComments(userId: string): Promise<Array<{ text: string; reason: string }>> {
  const comments = await ValueComment.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_VALUE_COMMENTS_FOR_PROMPT);
  return comments.map((c) => ({ text: c.text, reason: c.reason }));
}

export function formatValueCommentBankForPrompt(comments: Array<{ text: string; reason: string }>): string {
  if (comments.length === 0) {
    return '(kho đang trống - chưa có bình luận nào được lưu)';
  }
  return comments.map((c) => `- "${c.text}" (lý do: ${c.reason})`).join('\n');
}
