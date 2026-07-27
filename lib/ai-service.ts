import * as Types from './types';

// Mock AI Service - simulates calls to an AI agent
// In production, replace these functions with actual API calls

export interface AIConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// Default mock config
let config: AIConfig = {
  apiEndpoint: 'https://api.example.com',
  apiKey: 'mock-key',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
};

export function setAIConfig(newConfig: Partial<AIConfig>) {
  config = { ...config, ...newConfig };
}

export function getAIConfig(): AIConfig {
  return config;
}

// Simulate API delay
async function delay(ms: number = 2000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate content ideas from a product
export async function generateIdeas(product: Types.ProductBrief): Promise<Omit<Types.Idea, 'id'>[]> {
  await delay(2500);
  
  const ideas = [
    {
      title: `Unboxing: ${product.name}`,
      description: `Showcase the unboxing experience and first impressions of ${product.name}. Highlight the packaging design and initial product reveal.`,
      source: 'AI Generated',
      priority: 'high',
      status: 'new' as const,
      productId: product.id,
    },
    {
      title: `${product.name} vs Competitors`,
      description: `Direct comparison video showing how ${product.name} outperforms similar products. Focus on unique selling points.`,
      source: 'AI Generated',
      priority: 'high',
      status: 'new' as const,
      productId: product.id,
    },
    {
      title: `Tutorial: How to use ${product.name}`,
      description: `Step-by-step tutorial covering all features of ${product.name}. Perfect for users new to the product category.`,
      source: 'AI Generated',
      priority: 'medium',
      status: 'new' as const,
      productId: product.id,
    },
    {
      title: `Real-world application of ${product.name}`,
      description: `Show ${product.name} being used in real-life scenarios. Document results and transformations.`,
      source: 'AI Generated',
      priority: 'medium',
      status: 'new' as const,
      productId: product.id,
    },
    {
      title: `${product.name} - Common mistakes to avoid`,
      description: `Educational content highlighting mistakes users make and how to avoid them for best results.`,
      source: 'AI Generated',
      priority: 'medium',
      status: 'new' as const,
      productId: product.id,
    },
  ];

  return ideas;
}

// Generate a full script
export async function generateScript(
  product: Types.ProductBrief,
  idea: Types.Idea,
  formula?: Types.ScriptFormula
): Promise<Omit<Types.Script, 'id'>> {
  await delay(3000);

  const scenes: Types.ScriptScene[] = [
    {
      time: '0-3s',
      visuals: 'Hook: Eye-catching B-roll of product in action',
      audio: 'Upbeat music, voiceover: "Are you missing out?"',
      textOverlay: 'WATCH THIS',
      notes: 'Grab attention immediately',
    },
    {
      time: '3-10s',
      visuals: 'Product close-ups showing details and features',
      audio: 'Voiceover explaining main benefit',
      textOverlay: product.usp,
      notes: 'Highlight unique selling points',
    },
    {
      time: '10-25s',
      visuals: 'Demonstration of product use',
      audio: 'Voiceover: "Here\'s how it works..."',
      textOverlay: 'HOW IT WORKS',
      notes: 'Show product in action',
    },
    {
      time: '25-35s',
      visuals: 'Before/after or transformation footage',
      audio: 'Uplifting music, testimonial voiceover',
      textOverlay: 'REAL RESULTS',
      notes: 'Social proof segment',
    },
    {
      time: '35-42s',
      visuals: 'CTA: Product shot with logo',
      audio: 'Call to action voiceover',
      textOverlay: 'LINK IN BIO',
      notes: 'Strong finish with CTA',
    },
  ];

  return {
    title: `${idea.title} - Full Script`,
    description: idea.description,
    videoId: `script-${Date.now()}`,
    productId: product.id,
    ideaId: idea.id,
    formulaId: formula?.id,
    format: 'Short-form (15-60s)',
    scenes,
    status: 'draft' as const,
  };
}

// Generate metadata
export async function generateMetadata(
  script: Types.Script,
  product: Types.ProductBrief
): Promise<Omit<Types.VideoMetadata, 'id'>> {
  await delay(2000);

  return {
    scriptId: script.id,
    titleVariants: [
      script.title,
      `You won't believe what ${product.name} can do...`,
      `${product.name} changed everything (SHOCKING)`,
      `How to use ${product.name} the RIGHT way`,
    ],
    description: `Discover the power of ${product.name}. ${product.usp}. Watch to learn more! Link in bio.`,
    hashtags: ['#ProductReview', '#Tutorial', '#MustWatch', '#ProductDemo', product.name.split(' ').map(w => `#${w}`).join(' ')],
    keywords: product.keywords || ['product', 'demo', 'tutorial'],
    bestPostingTime: '7-9 PM',
    engagementHooks: [
      'Start with a question',
      'Show results immediately',
      'Use trending sound',
    ],
  };
}

// Generate thumbnail brief
export async function generateThumbnailBrief(script: Types.Script): Promise<Omit<Types.ThumbnailBrief, 'id'>> {
  await delay(1500);

  return {
    scriptId: script.id,
    concept: 'Bold contrasting colors with shocked facial expression',
    textSuggestion: ['SHOCKING', 'NEW', 'FREE'].join(' or '),
    colorScheme: 'Red and yellow with dark background',
    composition: 'Rule of thirds: subject off-center, text in corner',
    aiPrompt: 'A shocked person holding a product, bold red and yellow text saying SHOCKING, professional lighting, trending thumbnail style',
  };
}

// Generate win/loss analysis
export async function generateAnalysis(
  kpis: Types.VideoKPI[],
  dateRange: { start: Date; end: Date }
): Promise<Omit<Types.WinLossAnalysis, 'id'>> {
  await delay(3500);

  const wins = kpis.filter(k => ['S', 'A'].includes(k.rank));
  const losses = kpis.filter(k => ['D', 'C'].includes(k.rank));

  return {
    dateRange: dateRange,
    performanceOverview: `Analyzed ${kpis.length} videos. ${wins.length} top performers, ${losses.length} underperformers.`,
    patterns: [
      'Videos with hooks in first 3 seconds perform 3x better',
      'Longer-form content (30-60s) generates more saves',
      'Tuesday-Thursday posts have higher engagement',
      'Trending sounds boost visibility by 45%',
    ],
    gaps: [
      'Limited storytelling in product demos',
      'CTAs often too subtle or late in video',
      'Insufficient variety in content formats',
    ],
    recommendations: [
      'Implement stronger hooks based on audience pain points',
      'Test mid-roll CTAs instead of just end-of-video',
      'Increase frequency of tutorial-style content',
      'Collaborate with micro-influencers for authenticity',
    ],
    nextSteps: 'Test recommendations on next 5 videos, measure impact',
  };
}

// Analyze competitor
export async function analyzeCompetitor(
  competitor: Types.Competitor,
  videos: Types.ViralVideo[]
): Promise<{
  patterns: string[];
  gaps: string[];
  contentSuggestions: string[];
  opportunities: string[];
}> {
  await delay(2500);

  return {
    patterns: [
      'Most successful videos feature product demonstrations',
      'High engagement on user testimonial content',
      'Consistent posting schedule on Tuesdays and Thursdays',
      'Average video length: 25-35 seconds for maximum retention',
    ],
    gaps: [
      'Limited behind-the-scenes content',
      'Few comparison videos against alternatives',
      'Minimal educational/tutorial format',
      'Could expand to Instagram Reels and TikTok',
    ],
    contentSuggestions: [
      'Create detailed product feature breakdowns',
      'Produce weekly tips and tricks series',
      'Develop case studies and success stories',
      'Make "reaction" videos to industry trends',
    ],
    opportunities: [
      'Untapped audience: Gen Z market segment',
      'Potential partnership with micro-influencers',
      'Cross-promotion opportunities on emerging platforms',
      'Educational webinar series could drive authority',
    ],
  };
}

// Test AI connection
export async function testConnection(): Promise<boolean> {
  try {
    await delay(1000);
    // In production, make a real API call
    return true;
  } catch (error) {
    return false;
  }
}
