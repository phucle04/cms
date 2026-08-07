import { z } from 'zod';

/**
 * Shape BẮT BUỘC Gemini phải trả về (ép qua responseSchema trong
 * geminiVideoService.ts), rồi được validate lại bằng zod ở đây trước khi tin
 * dùng - không tin mù structured output, Gemini vẫn có thể trả sai schema.
 */
export const GeminiVideoAnalysisOutputSchema = z.object({
  hook: z.object({
    firstThreeSeconds: z.string(),
    visualHook: z.string(),
    spokenHook: z.string(),
  }),
  structure: z.array(
    z.object({
      tStart: z.number(),
      tEnd: z.number(),
      whatHappens: z.string(),
      purpose: z.string(),
    })
  ),
  production: z.object({
    shotTypes: z.array(z.string()),
    lighting: z.string(),
    props: z.array(z.string()),
    musicStyle: z.string(),
    textOnScreen: z.array(z.string()),
  }),
  viralHypothesis: z.string(),
  cta: z.string(),
  transcript: z.string(),
  // Khớp video này với kho hook/pain point/DISC (Giai đoạn 6, Phase 2) - dùng
  // string rỗng "" thay vì null/optional cho MỌI field "không áp dụng", theo
  // đúng quy ước đã có sẵn trong file này cho các field chỉ suy luận được từ
  // hình ảnh (xem analyzeFromTextOnly ở geminiVideoService.ts) - Gemini
  // structured output ổn định hơn với string bắt buộc so với nullable/optional.
  // *EntryId do Gemini chọn được RESOLVE lại (đối chiếu kho thật, tạo entry
  // mới 'pending' nếu là *NewName hợp lệ) ở knowledgeMatchService.ts trước khi
  // lưu xuống DB - xem TrendVideo.analysis.knowledgeMatch.
  knowledgeMatch: z.object({
    hookEntryId: z.string(),
    hookNewName: z.string(),
    hookNewDescription: z.string(),
    hookNewExample: z.string(),
    painPointEntryId: z.string(),
    painPointNewName: z.string(),
    painPointNewDescription: z.string(),
    painPointNewExample: z.string(),
    discCode: z.string(),
  }),
  // Giai đoạn 6 Phase 6: bình luận THẬT (trích verbatim từ danh sách bình
  // luận đưa vào prompt) mà Gemini đánh giá là có thể tái dùng cho kịch bản
  // SẢN PHẨM KHÁC sau này (kho "value comment") - xem valueCommentService.ts
  // đối chiếu lại verbatim với topComments thật trước khi lưu, không tin mù.
  // Mảng rỗng nếu không có bình luận nào nổi bật.
  valueComments: z.array(
    z.object({
      text: z.string(),
      reason: z.string(),
    })
  ),
});

export type GeminiVideoAnalysisOutput = z.infer<typeof GeminiVideoAnalysisOutputSchema>;

/**
 * VideoAnalysis = output Gemini (đã validate) + analysisConfidence do CODE
 * của ta gán (không phải Gemini tự báo cáo): 'high' khi phân tích có video
 * thật (analyzeVideo), 'low' khi chỉ có text (analyzeFromTextOnly). Đây là
 * shape lưu vào TrendVideo.analysis.
 */
export const VideoAnalysisSchema = GeminiVideoAnalysisOutputSchema.extend({
  analysisConfidence: z.enum(['high', 'low']),
});

export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;
