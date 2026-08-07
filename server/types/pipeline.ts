import { z } from 'zod';

/**
 * Output Gemini phải trả cho Stage 1 (generating_hashtags) - ép qua
 * responseSchema trong researchPipelineService.ts rồi validate lại bằng zod
 * ở đây, không tin mù structured output.
 */
export const HashtagSuggestionSchema = z.object({
  tag: z.string(),
  reason: z.string(),
  score: z.number().min(0).max(100),
});
export type HashtagSuggestion = z.infer<typeof HashtagSuggestionSchema>;

export const HashtagSuggestionsSchema = z.array(HashtagSuggestionSchema).min(8).max(12);

/**
 * Output Gemini phải trả cho Stage 5 (generating_scripts) - Giai đoạn 6 Phase
 * 4: 1 phần tử ứng với ĐÚNG 1 combo (hook, pain point, DISC) đã chọn ở bước
 * awaiting_combo_selection (xem ResearchJob.selectedCombos), theo ĐÚNG thứ tự
 * - KHÔNG còn "angle"/"targetPainPoint" do Gemini tự bịa như hệ 5-góc-tiếp-cận
 * cũ, vì combo đã quy định sẵn hook/pain point/DISC cho từng slot (xem
 * buildComboContext trong researchPipelineService.ts). `confidence` do Gemini
 * tự đánh giá dựa trên chất lượng nguồn (video phân tích high/low confidence) -
 * không phải giá trị hệ thống tự gán như VideoAnalysis.analysisConfidence.
 */
export const GeneratedScriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  body: z.array(
    z.object({
      tStart: z.number(),
      tEnd: z.number(),
      voiceover: z.string(),
      visual: z.string(),
      textOnScreen: z.string(),
    })
  ),
  cta: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  shotList: z.array(z.string()),
  learnedFrom: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type GeneratedScript = z.infer<typeof GeneratedScriptSchema>;

/**
 * KHÔNG ràng buộc độ dài ở đây (khác `.length(count)` đã thử trước đó) - lý
 * do (BUG THẬT gặp production): Gemini API trả lỗi CỨNG 400 INVALID_ARGUMENT
 * ("Request contains an invalid argument") khi responseSchema phía
 * geminiVideoService/researchPipelineService.ts có `minItems`/`maxItems`
 * TRÊN 1 schema lồng nhau phức tạp (đây là giới hạn KHÔNG được ghi rõ trong
 * doc chính thức của Gemini, chỉ thấy report từ cộng đồng) - khiến Stage 5
 * fail 100% mọi lần gọi thay vì thỉnh thoảng thiếu item như trước. Số lượng
 * ĐÚNG job.selectedCombos.length giờ được ép qua text prompt (xem
 * {{scriptCount}} trong userPromptTemplate) + đối chiếu/cắt bớt/throw rõ ràng
 * TRONG CODE sau khi parse (xem runStage5GenerateScripts) - không dựa vào
 * Gemini responseSchema để ép số lượng nữa.
 */
export const GeneratedScriptsArraySchema = z.array(GeneratedScriptSchema);
