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
 * Output Gemini phải trả cho Stage 5 (generating_scripts) - đúng 5 phần tử,
 * mỗi phần tử 1 góc tiếp cận khác nhau. `confidence` do Gemini tự đánh giá
 * dựa trên chất lượng nguồn (video phân tích high/low confidence) - không
 * phải giá trị hệ thống tự gán như VideoAnalysis.analysisConfidence.
 */
export const GeneratedScriptSchema = z.object({
  title: z.string(),
  angle: z.string(),
  targetPainPoint: z.string(),
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

export const GeneratedScriptsSchema = z.array(GeneratedScriptSchema).length(5);
