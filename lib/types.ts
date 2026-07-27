// Brand and Audience Models
export interface BrandVoice {
  id: string;
  tone: string;
  personality: string[];
  dos: string[];
  donts: string[];
  ctaSamples: string[];
  updatedAt: string;
}

export interface Persona {
  id: string;
  name: string;
  painPoints: string[];
  goals: string[];
  behaviors: string[];
}

export interface AudiencePersona {
  id: string;
  mainPersona: Persona;
  subPersonas: Persona[];
  updatedAt: string;
}

// Research and Compliance Models
export interface ComplianceRule {
  id: string;
  category: string;
  rule: string;
  bannedWords: string[];
  alternatives: string[];
}

export interface StoreBrandInfo {
  id: string;
  storeName: string;
  branches: string[];
  promotions: string[];
  contactInfo: string;
  updatedAt: string;
}

export interface KeywordGroup {
  id: string;
  type: 'seo' | 'hashtag' | 'voice-search';
  keywords: string[];
}

export interface KeywordSet {
  id: string;
  groups: KeywordGroup[];
  updatedAt: string;
}

// Trend and Competitor Models
export interface Trend {
  id: string;
  name: string;
  category: string;
  source: string;
  relevance: 'high' | 'medium' | 'low';
  contentIdeas: string[];
  status: 'new' | 'hot' | 'cold' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  platform: string;
  handle: string;
  followers: number;
  averageViews: number;
  strengths: string[];
  weaknesses: string[];
  analysisDate: string;
}

export interface ViralVideo {
  id: string;
  competitorId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  hook: string;
  structure: string;
  sound: string;
  uploadDate: string;
}

export interface CommentMining {
  id: string;
  source: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  theme: string;
  date: string;
}

// Product and Content Models
export interface ProductBrief {
  id: string;
  name: string;
  category: string;
  usp: string;
  painPoints: string;
  faqContent?: string;
  socialProof?: string;
  comparison?: string;
  shootingTips?: string;
  mediaUrl?: string;
  keywords?: string[];
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'in progress' | 'done' | 'discarded';
  productId?: string;
}

export interface TikTokVideo {
  id: string;
  url: string;
  views: number;
  caption: string;
  captionsUrl?: string;
}

export interface CompetitorTranscript {
  views: number;
  transcript: string;
}

export interface TrendResearchResult {
  hashtags: string[];
  videos: TikTokVideo[];
  transcripts: CompetitorTranscript[];
}

export interface ContentCalendarEvent {
  id: string;
  ideaId: string;
  date: string;
  contentType: string;
  assignee?: string;
  status: 'planned' | 'in-progress' | 'completed';
}

export interface ContentCalendar {
  id: string;
  week: string;
  events: ContentCalendarEvent[];
  updatedAt: string;
}

// Script and Production Models
export interface ScriptFormula {
  id: string;
  name: string;
  description: string;
  structure: string;
  exampleScript?: string;
  tags: string[];
}

export interface ScriptSegment {
  seconds: number;
  voiceover: string;
  textOverlay: string;
  visual: string;
  sound: string;
}

export interface Script {
  id: string;
  ideaId: string;
  title: string;
  formulaId?: string;
  segments: ScriptSegment[];
  totalDuration: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  id: string;
  scriptId: string;
  shots: Array<{
    shotNumber: number;
    description: string;
    duration: number;
    notes: string;
  }>;
  updatedAt: string;
}

export interface AudioGuide {
  id: string;
  contentType: string;
  soundRecommendations: string[];
  musicGenres: string[];
  effectSuggestions: string[];
  updatedAt: string;
}

// Optimization and Marketing Models
export interface VideoMetadata {
  id: string;
  scriptId: string;
  title: string;
  description: string;
  hashtags: string[];
  keywords: string[];
  cta: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThumbnailBrief {
  id: string;
  scriptId: string;
  mainSubject: string;
  colorPalette: string[];
  textElements: string[];
  emotionalTone: string;
  comparisonExamples: string[];
  updatedAt: string;
}

// Analytics Models
export interface VideoKPI {
  id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTime: number;
  retention: number;
  ctr: number;
  orders: number;
  revenue: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  timestamp: Date;
}

export interface WinLossAnalysis {
  id: string;
  dateRange: { start: Date; end: Date };
  performanceOverview: string;
  patterns: string[];
  gaps: string[];
  recommendations: string[];
  nextSteps: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  category: string;
  relatedKPIs: string[];
  createdAt: string;
}

// Archive Model
export interface ArchiveItem {
  id: string;
  itemType: 'product' | 'trend' | 'script' | 'report';
  itemId: string;
  itemData: any;
  reason: string;
  archivedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Settings and AI Models
export interface AppSettings {
  id: string;
  aiApiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
  aiTemperature: number;
  autoArchiveOldTrends: boolean;
  autoArchiveDays: number;
  updatedAt: string;
}

export interface AIGeneratedContent {
  id?: string;
  type: 'script' | 'metadata' | 'analysis';
  content: string;
  sourceData: any;
  status: 'draft' | 'approved' | 'rejected';
  createdAt: string;
}

// Module State Types
export interface ModuleState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  selectedId?: string;
  searchQuery: string;
  filters: Record<string, any>;
}

export interface TabItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
}

// ============================================================
// Research Pipeline (khớp CHÍNH XÁC với server/models/*.ts +
// server/types/*.ts của backend Giai đoạn 2-3) - dùng cho UI Giai đoạn 4.
// KHÔNG dùng chung với các type mock phía trên (BrandVoice, Script cũ...)
// vì shape khác hẳn dữ liệu thật từ MongoDB.
// ============================================================

export type ResearchJobStatus =
  | 'queued'
  | 'generating_hashtags'
  | 'awaiting_hashtag_selection'
  | 'scraping'
  | 'downloading'
  | 'analyzing'
  | 'generating_scripts'
  | 'completed'
  | 'failed';

export interface ResearchJobSuggestedHashtag {
  tag: string;
  reason: string;
  score: number;
}

export interface ResearchJobProgressEntry {
  stage: string;
  message: string;
  percent: number;
  at: string;
}

export interface ResearchJobError {
  stage: string;
  message: string;
  at: string;
}

export interface ResearchJobCost {
  apifyEstimatedUsd: number;
  apifyActualUsd: number;
  geminiInputTokens: number;
  geminiOutputTokens: number;
  geminiEstimatedUsd: number;
  totalEstimatedUsd: number;
}

export interface ResearchJob {
  id: string;
  userId: string;
  // Có thể là id (string) hoặc object đã populate tuỳ endpoint gọi.
  productId: string | ProductBrief;
  brandProfileId?: string | BrandProfile;
  status: ResearchJobStatus;
  autoSelectTop3: boolean;
  suggestedHashtags: ResearchJobSuggestedHashtag[];
  selectedHashtags: string[];
  progress: ResearchJobProgressEntry[];
  resultIdeaIds: string[];
  resultScriptIds: string[];
  error?: ResearchJobError;
  cost: ResearchJobCost;
  createdAt: string;
  updatedAt: string;
}

export interface TrendVideoTopComment {
  text: string;
  likeCount: number;
  authorHandle: string;
}

// Khớp GeminiVideoAnalysisOutputSchema/VideoAnalysisSchema ở
// server/types/videoAnalysis.ts - KHÔNG phải shape đơn giản trong prompt mẫu.
export interface TrendVideoAnalysisStructureItem {
  tStart: number;
  tEnd: number;
  whatHappens: string;
  purpose: string;
}

export interface TrendVideoAnalysis {
  hook: {
    firstThreeSeconds: string;
    visualHook: string;
    spokenHook: string;
  };
  structure: TrendVideoAnalysisStructureItem[];
  production: {
    shotTypes: string[];
    lighting: string;
    props: string[];
    musicStyle: string;
    textOnScreen: string[];
  };
  viralHypothesis: string;
  cta: string;
  transcript: string;
  analysisConfidence: 'high' | 'low';
}

export type TrendVideoDownloadStatus = 'pending' | 'downloaded_apify' | 'downloaded_ytdlp' | 'text_only' | 'failed';

export interface TrendVideo {
  id: string;
  jobId: string;
  videoId: string;
  webVideoUrl: string;
  caption: string;
  hashtags: string[];
  playCount: number;
  diggCount: number;
  shareCount: number;
  commentCount: number;
  collectCount: number;
  authorName: string;
  authorHandle: string;
  authorFollowers: number;
  thumbnailUrl: string;
  downloadStatus: TrendVideoDownloadStatus;
  analysis?: TrendVideoAnalysis;
  analysisConfidence?: 'high' | 'low';
  topComments: TrendVideoTopComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchScriptBodySegment {
  tStart: number;
  tEnd: number;
  voiceover: string;
  visual: string;
  textOnScreen: string;
}

// Script THẬT từ backend (server/models/Script.ts) - khác hẳn Types.Script
// (mock) ở trên, giữ tên riêng để không đụng nhau.
export interface ResearchScript {
  id: string;
  userId: string;
  ideaId: string;
  title: string;
  content: string;
  format: 'short' | 'long' | 'bullet';
  callToAction: string;
  generatedBy?: string;
  status: 'draft' | 'approved' | 'rejected';
  feedback?: string;
  angle?: string;
  targetPainPoint?: string;
  body?: ResearchScriptBodySegment[];
  caption?: string;
  hashtags?: string[];
  shotList?: string[];
  learnedFrom?: string[];
  confidence?: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileTargetAudience {
  ageRange: string;
  gender: string;
  roles: string[];
  painPoints: string[];
}

export interface BrandProfileStoreInfo {
  branches: unknown[];
  hotline: string;
  website: string;
  currentPromotions: string[];
}

export interface BrandProfile {
  id: string;
  brandName: string;
  tagline?: string;
  industry: string;
  targetAudience: BrandProfileTargetAudience;
  toneOfVoice: string;
  doList: string[];
  dontList: string[];
  complianceNotes?: string;
  storeInfo: BrandProfileStoreInfo;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PromptTemplateKey = 'hashtag' | 'video_analysis' | 'script_gen';

export interface PromptTemplate {
  id: string;
  key: PromptTemplateKey;
  name: string;
  niche: string;
  systemPrompt: string;
  userPromptTemplate: string;
  aiModel: string;
  temperature: number;
  isDefault: boolean;
  isSystemSeed: boolean;
  createdAt: string;
  updatedAt: string;
}
