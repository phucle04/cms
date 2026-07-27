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
