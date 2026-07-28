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
  // Cổng tuân thủ quảng cáo (Nghị định 100/2014/NĐ-CP): sản phẩm cho trẻ dưới
  // 24 tháng tuổi bị chặn tạo research job tự động, cần duyệt thủ công.
  // Optional để tương thích sản phẩm cũ tạo trước khi có trường này.
  ageCategory?: 'under_24m' | '24m_plus' | 'not_applicable';
  createdAt: Date;
  updatedAt: Date;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'new' | 'in progress' | 'done' | 'discarded';
  // GET /ideas và GET /ideas/:id populate field này thành ProductBrief đầy đủ;
  // POST/PUT trả về ObjectId dạng string (không populate). Luôn kiểm tra
  // `typeof productId === 'string'` trước khi đọc field của ProductBrief.
  productId?: string | ProductBrief;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompetitorTranscript {
  views: number;
  transcript: string;
}

// ============================================================
// Research Pipeline (khớp CHÍNH XÁC với server/models/*.ts +
// server/types/*.ts của backend Giai đoạn 2-3) - dùng cho UI Giai đoạn 4.
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

// Kết quả bộ quét từ khoá tuân thủ (G6a) - tính lúc đọc, không lưu DB.
// Đây là lớp lọc sơ bộ dựa trên khớp cụm từ, KHÔNG bắt được diễn đạt gián
// tiếp - xem docs/COSTS.md / CMS_OVERVIEW.md phần cổng tuân thủ.
export interface ComplianceFlag {
  phrase: string;
  source: 'dontList' | 'baseline';
  context: string;
  index: number;
}

export interface ResearchScript {
  id: string;
  userId: string;
  ideaId: string | Idea;
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
  complianceFlags?: ComplianceFlag[];
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
