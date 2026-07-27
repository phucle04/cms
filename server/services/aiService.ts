import { GoogleGenAI } from "@google/genai";
import { IProductBrief } from '../models/ProductBrief';
import { IIdea } from '../models/Idea';
import { CompetitorTranscript } from '../types';
// GEMINI_MODEL là nguồn sự thật DUY NHẤT cho model Gemini - đọc process.env
// trực tiếp ở đây nữa thì lại tạo ra 2 nguồn lệch nhau. Import GEMINI_MODEL
// đã tự throw ngay lúc import nếu thiếu (fail-fast) - xem server/config/env.ts.
import { GEMINI_MODEL } from '../config/env';


// Validate AI configuration at startup
export function validateAIConfig(): void {
  const provider = process.env.AI_PROVIDER || 'mock';
  const apiKey = process.env.GEMINI_API_KEY;

  if (provider !== 'gemini') {
    throw new Error(
      'FATAL: AI_PROVIDER must be "gemini" - mock data fallback is disabled for production integrity'
    );
  }

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('FATAL: GEMINI_API_KEY is missing or empty in .env - AI features will not work');
  }

  // Không cần tự kiểm tra GEMINI_MODEL ở đây nữa: import GEMINI_MODEL ở trên
  // đã throw ngay lúc module này được nạp nếu biến env thiếu/rỗng.
  console.log(`[AI Config] Provider: ${provider}, Model: ${GEMINI_MODEL}`);
}

// Structured shape the model must fill in. Splitting the script into
// hook / body / cta gives the model actual "slots" to follow the viral
// structure, instead of forcing everything into one description string.
interface IdeaSchema {
  title: string;
  hook: string;
  body: string;
  cta: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'new';
}

/**
 * Strip ```json / ``` code fences some Gemini responses include even when
 * explicitly told not to. Prevents JSON.parse from throwing on otherwise
 * valid content.
 */
function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

export class AIService {
  private client: GoogleGenAI | null;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.model = GEMINI_MODEL;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    return this.client;
  }

  /**
   * Build prompt for idea generation with complete product context.
   *
   * NOTE: this only references fields that actually exist on IProductBrief
   * (name, category, usp, painPoints, faqContent, socialProof,
   * shootingTips, keywords). If you want the model to genuinely analyze
   * competitor transcripts or a defined Brand Voice / Customer Persona,
   * those need to be real fields on IProductBrief and passed in here -
   * otherwise the model is just inventing them, which is misleading.
   */
  private buildIdeaPrompt(product: IProductBrief, count: number, competitorTranscripts: CompetitorTranscript[] = []): string {
    const parts: string[] = [];

    parts.push(`Generate exactly ${count} creative, actionable short-form video content ideas for this product.`);

    parts.push('\nProduct Details:');
    if (product.name) parts.push(`- Name: ${product.name}`);
    if (product.category) parts.push(`- Category: ${product.category}`);
    if (product.usp) parts.push(`- USP: ${product.usp}`);
    if (product.painPoints) parts.push(`- Pain Points: ${product.painPoints}`);
    if (product.faqContent) parts.push(`- FAQ: ${product.faqContent}`);
    if (product.socialProof) parts.push(`- Social Proof: ${product.socialProof}`);
    if (product.shootingTips) parts.push(`- Shooting Tips: ${product.shootingTips}`);
    if (product.keywords && product.keywords.length > 0) {
      parts.push(`- Keywords: ${product.keywords.join(', ')}`);
    }

    if (competitorTranscripts.length > 0) {
      parts.push('\nObserved Viral Patterns (from real transcript context):');
      competitorTranscripts.slice(0, 5).forEach((item, index) => {
        const transcript = item.transcript?.slice(0, 1000) || '';
        parts.push(`- Transcript ${index + 1} (views: ${item.views}): ${transcript}`);
      });
      parts.push('Use these patterns as evidence-based inspiration. Do not copy them verbatim; create fresh concepts that reflect recurring hook, pacing, and payoff patterns.');
    }

    parts.push('\nRole:');
    parts.push('You are a Senior TikTok Content Strategist with expertise in viral short-form video, consumer psychology, storytelling, and direct response marketing.');

    parts.push('\nTask:');
    parts.push('Analyze the product information above and design completely original video concepts. Do not rewrite or copy any existing transcript - each idea must be a new concept.');

    parts.push('\nEach idea must have three distinct script sections:');
    parts.push('- hook: the first 1-3 seconds that stops the scroll and creates curiosity or tension.');
    parts.push('- body: the main content that develops the idea, weaves in the product USP naturally, and builds toward a payoff.');
    parts.push('- cta: a short, natural call to action (e.g. try it, comment, save, share).');

    parts.push('\nRequirements for every idea:');
    parts.push('- Sound like a real TikTok creator talking, not an ad script.');
    parts.push('- Naturally include the product USP - do not force it in awkwardly.');
    parts.push('- Optimize for watch time and engagement (open loops, pattern interrupts, payoff).');
    parts.push('- Vary the format across ideas (e.g. POV, testimonial, myth-busting, demo, Q&A, day-in-the-life).');

    parts.push('\nReturn ONLY a JSON array with no markdown, no explanations, just raw JSON.');

    return parts.join('\n');
  }

  private getFallbackHashtags(product: IProductBrief): string[] {
    const base = [
      product.name?.toLowerCase(),
      product.category?.toLowerCase(),
      product.usp?.toLowerCase(),
      product.painPoints?.toLowerCase(),
    ].filter(Boolean) as string[];

    const keywords = (product.keywords || []).map((item) => item.toLowerCase());
    const derived = [...base, ...keywords]
      .flatMap((item) => item.split(/[^a-z0-9]+/).filter(Boolean))
      .filter((item, index, arr) => item.length > 2 && arr.indexOf(item) === index)
      .slice(0, 8);

    return derived.map((item) => `#${item}`);
  }

  private getFallbackIdeas(product: IProductBrief, count: number): IIdea[] {
    const titles = [
      `${product.name} in a real-life scenario`,
      `3 reasons ${product.name} is worth trying`,
      `What nobody tells you about ${product.name}`,
      `${product.name} before and after`,
      `POV: using ${product.name} in your routine`,
    ];

    return titles.slice(0, count).map((title, index) => ({
      title,
      description: `Hook: ${title}\n\nBody: Show a relatable problem, introduce ${product.name || 'the product'}, and explain the payoff in a quick, natural format.\n\nCTA: Save this for later or try it today.`,
      source: 'fallback-mock',
      priority: index % 2 === 0 ? 'high' : 'medium',
      status: 'new',
      productId: product._id,
    } as any));
  }

  private getFallbackTranscript(videoUrl: string): string {
    const label = videoUrl.split('/').pop() || 'video';
    return `Fallback transcript for ${label}: this content uses a strong hook, a relatable problem, a quick payoff, and a direct CTA.`;
  }

  /**
   * Generate video content ideas using Gemini with structured output
   */
  async generateIdeas(product: IProductBrief, count: number = 5, competitorTranscripts: CompetitorTranscript[] = []): Promise<IIdea[]> {
    try {
      const prompt = this.buildIdeaPrompt(product, count, competitorTranscripts);

      if (!this.client) {
        return this.getFallbackIdeas(product, count);
      }

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          systemInstruction: `You are a creative video content strategist. Generate exactly ${count} content ideas as a JSON array.
Each idea must have: title (string), hook (string), body (string), cta (string), priority ('high'|'medium'|'low'), status ('draft'|'new').
Return ONLY valid JSON array, no markdown code blocks, no explanations.`,
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: Math.max(4096, Math.min(16384, count * 700 + Math.ceil(prompt.length / 4))),
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                hook: { type: 'string' },
                body: { type: 'string' },
                cta: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                status: { type: 'string', enum: ['draft', 'new'] },
              },
              required: ['title', 'hook', 'body', 'cta', 'priority', 'status'],
            },
          },
        },
      });

      // Check for safety block
      if (response.promptFeedback?.blockReason) {
        throw new Error(
          `Content blocked by Gemini safety filter: ${response.promptFeedback.blockReason}`
        );
      }

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        throw new Error(
          `Gemini response was cut off (finishReason: MAX_TOKENS) before completing the JSON. ` +
          `Try lowering "count" (currently ${count}) or increasing maxOutputTokens.`
        );
      }

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini API');
      }

      const text = stripJsonFences(rawText);

      let ideas: IdeaSchema[];
      try {
        ideas = JSON.parse(text);
      } catch (parseError) {
        console.error('[AI] Failed to parse Gemini response:', text);
        const looksTruncated = /Unterminated string|Unexpected end of JSON input/i.test(
          parseError instanceof Error ? parseError.message : ''
        );
        throw new Error(
          looksTruncated
            ? `Gemini response appears truncated mid-JSON (likely hit the token limit). ` +
              `Try lowering "count" (currently ${count}) or increasing maxOutputTokens. ` +
              `Original error: ${parseError instanceof Error ? parseError.message : 'unknown'}`
            : `Invalid JSON response from Gemini: ${parseError instanceof Error ? parseError.message : 'unknown'}`
        );
      }

      if (!Array.isArray(ideas)) {
        throw new Error('Gemini response is not an array');
      }

      if (ideas.length !== count) {
        console.warn(`[AI] Expected ${count} ideas, got ${ideas.length} - proceeding with available ideas`);
      }

      return ideas.map((idea) => {
        const description = [
          idea.hook ? `Hook: ${idea.hook}` : null,
          idea.body ? `Body: ${idea.body}` : null,
          idea.cta ? `CTA: ${idea.cta}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');

        return {
          title: idea.title || 'Untitled Idea',
          description: description || '',
          source: 'gemini-ai',
          priority: idea.priority || 'medium',
          status: 'new',
          productId: product._id,
        } as any;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
        console.warn('[AI] Gemini rate limit hit, falling back to mock ideas');
        return this.getFallbackIdeas(product, count);
      }

      console.warn('[AI] Idea generation failed, falling back to mock ideas:', errorMessage);
      return this.getFallbackIdeas(product, count);
    }
  }

  async generateHashtags(product: IProductBrief): Promise<string[]> {
    try {
      if (!this.client) {
        return this.getFallbackHashtags(product);
      }

      const prompt = `Extract 6-10 TikTok-style hashtags for this product. Return ONLY a JSON array of strings.\n\nProduct: ${product.name}\nCategory: ${product.category}\nUSP: ${product.usp}\nPain Points: ${product.painPoints || ''}`;

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      });

      const rawText = response.text || '[]';
      const parsed = JSON.parse(stripJsonFences(rawText));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item): item is string => typeof item === 'string').map((item) => item.startsWith('#') ? item : `#${item}`);
      }
    } catch (error) {
      console.warn('[AI] Hashtag generation failed, using fallback hashtags:', error);
    }

    return this.getFallbackHashtags(product);
  }

  async transcribeVideo(videoUrl: string): Promise<string> {
    try {
      if (!this.client) {
        return this.getFallbackTranscript(videoUrl);
      }

      const videoResp = await fetch(videoUrl);
      if (!videoResp.ok) {
        throw new Error(`Unable to fetch video: ${videoResp.status}`);
      }

      const buffer = Buffer.from(await videoResp.arrayBuffer());

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'video/mp4', data: buffer.toString('base64') } },
            { text: 'Transcribe all spoken dialogue in this video, in the original language. Return plain text only.' },
          ],
        }],
      });

      return response.text || this.getFallbackTranscript(videoUrl);
    } catch (error) {
      console.warn('[AI] Video transcription failed, using fallback transcript:', error);
      return this.getFallbackTranscript(videoUrl);
    }
  }

  /**
   * Generate video script using Gemini
   */
  async generateScript(
    ideaTitle: string,
    ideaDescription: string,
    format: 'short' | 'long' | 'bullet' = 'short'
  ): Promise<string> {
    try {
      const formatDesc =
        format === 'short'
          ? '15-30 second YouTube Short'
          : format === 'long'
            ? '5-10 minute long-form video'
            : 'bullet points for storyboarding';

      const prompt = `Write a compelling ${formatDesc} script for this content idea:
Title: ${ideaTitle}
Description: ${ideaDescription}

Structure the script clearly into paragraphs (e.g. Hook, Body, CTA), separated by blank lines.
Return only the script text, no explanations or metadata.`;

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return response.text || '';
    } catch (error) {
      console.error('[AI] Script generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate SEO metadata using Gemini
   */
  async generateMetadata(
    title: string,
    description: string
  ): Promise<{ title: string; description: string; tags: string[] }> {
    try {
      const prompt = `Generate SEO-optimized metadata for a video:
Current Title: ${title}
Current Description: ${description}

Return JSON with: title (string, max 60 chars), description (string, max 150 chars), tags (array of strings, 5-10 items).`;

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini API');
      }
      const metadata = JSON.parse(stripJsonFences(rawText));

      return {
        title: metadata.title || title,
        description: metadata.description || description,
        tags: metadata.tags || [],
      };
    } catch (error) {
      console.error('[AI] Metadata generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail design brief using Gemini
   */
  async generateThumbnailBrief(scriptContent: string): Promise<string> {
    try {
      const prompt = `Create a detailed thumbnail design brief for this video script:
${scriptContent}

Provide specific guidance on: visual concept, color scheme, text overlay, composition, emotional tone.`;

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return response.text || '';
    } catch (error) {
      console.error('[AI] Thumbnail brief generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate performance analysis from KPIs using Gemini
   */
  async generateAnalysis(
    kpis: any[],
    dateRange: { start: Date; end: Date }
  ): Promise<{
    performanceOverview: string;
    patterns: string[];
    gaps: string[];
    recommendations: string[];
    nextSteps: string;
  }> {
    try {
      const avgViews = kpis.length
        ? (kpis.reduce((sum, k) => sum + (k.views || 0), 0) / kpis.length).toFixed(0)
        : 0;
      const avgEngagement = kpis.length
        ? (kpis.reduce((sum, k) => sum + (k.likes || 0) + (k.comments || 0), 0) / kpis.length).toFixed(0)
        : 0;

      const prompt = `Analyze these video analytics and provide insights:
Period: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}
Sample Size: ${kpis.length} videos
Average Views: ${avgViews}
Average Engagement (likes + comments): ${avgEngagement}

Return JSON with: performanceOverview (string), patterns (array), gaps (array), recommendations (array), nextSteps (string).`;

      const response = await this.getClient().models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini API');
      }
      return JSON.parse(stripJsonFences(rawText));
    } catch (error) {
      console.error('[AI] Analysis generation failed:', error);
      throw error;
    }
  }
}

export default AIService;