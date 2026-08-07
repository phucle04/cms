// Product and Content Models
export interface ProductBrief {
  id: string;
  name: string;
  category: string;
  usp: string;
  painPoints: string;
  faqContent?: string;
  keywords?: string[];
  // Trường bổ sung để AI viết kịch bản video short chính xác (đối tượng dùng,
  // liều dùng, giá, an toàn) thay vì tự suy đoán - xem server/models/ProductBrief.ts
  targetAudience?: string;
  usageInstructions?: string;
  originCountry?: string;
  certifications?: string;
  price?: number;
  promoPrice?: number;
  promotionOffer?: string;
  safetyNotes?: string;
  status: 'active' | 'archived';
  // Cổng tuân thủ quảng cáo (Nghị định 100/2014/NĐ-CP): sản phẩm cho trẻ dưới
  // 24 tháng tuổi bị chặn tạo research job tự động, cần duyệt thủ công.
  // Optional để tương thích sản phẩm cũ tạo trước khi có trường này.
  ageCategory?: 'under_24m' | '24m_plus' | 'not_applicable';
  createdAt: Date;
  updatedAt: Date;
}

// Kho tri thức "playbook" cho AI sinh kịch bản (hook / pain point / DISC) -
// khớp server/models/KnowledgeEntry.ts.
export type KnowledgeStoreType = 'hook' | 'pain_point' | 'disc';
export type KnowledgeSource = 'uploaded' | 'learned';
export type KnowledgeStatus = 'approved' | 'pending';
export type DiscCode = 'D' | 'I' | 'S' | 'C';

export const DISC_LABELS: Record<DiscCode, string> = {
  D: 'D - Quyết đoán / số liệu',
  I: 'I - Cảm xúc / xã hội',
  S: 'S - An toàn / ổn định',
  C: 'C - Phân tích / dữ liệu',
};

export interface KnowledgeEntry {
  id: string;
  storeType: KnowledgeStoreType;
  name: string;
  description: string;
  example?: string;
  discCode?: DiscCode;
  source: KnowledgeSource;
  status: KnowledgeStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
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
  | 'awaiting_combo_selection'
  | 'generating_scripts'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchJobSuggestedHashtag {
  tag: string;
  reason: string;
  score: number;
}

// Giai đoạn 6 Phase 3: thay cho "5 góc tiếp cận" cố định - mỗi kịch bản gắn
// với 1 bộ (hook, pain point, DISC) riêng từ kho tri thức. null = không chỉ
// định, để AI tự quyết định phần đó.
export interface ResearchJobCombo {
  hookEntryId: string | null;
  painPointEntryId: string | null;
  discCode: DiscCode | null;
}

export interface ResearchJobTrendStatEntry {
  entryId: string;
  name: string;
  count: number;
}

export interface ResearchJobTrendStats {
  topHooks: ResearchJobTrendStatEntry[];
  topPainPoints: ResearchJobTrendStatEntry[];
  discDistribution: { D: number; I: number; S: number; C: number };
  videosClassified: number;
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
  // true = đã gửi yêu cầu dừng nhưng pipeline (đang chạy nền) chưa kịp dừng
  // hẳn - status vẫn là stage đang chạy dở cho tới khi pipeline tự phát hiện.
  cancelRequested?: boolean;
  autoSelectTop3: boolean;
  suggestedHashtags: ResearchJobSuggestedHashtag[];
  selectedHashtags: string[];
  videoScanCount: number;
  scriptCount: number;
  // Lọc video theo tuổi (tháng, VD 6/12/24/36) - null/không set = không giới
  // hạn. Video cũ hơn ngưỡng này (hoặc thiếu ngày đăng) bị loại ngay lúc quét,
  // không bao giờ vào tới bước tải/phân tích - xem server/models/ResearchJob.ts.
  maxVideoAgeMonths?: number | null;
  trendStats?: ResearchJobTrendStats;
  suggestedCombos: ResearchJobCombo[];
  selectedCombos: ResearchJobCombo[];
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
  // Giai đoạn 6 Phase 4: kịch bản giờ gắn với ĐÚNG 1 combo (hook, pain point,
  // DISC) đã chọn ở bước awaiting_combo_selection - thay cho "angle" cố định
  // trước đây. *Name là tên entry tại thời điểm sinh kịch bản (snapshot, không
  // đổi theo nếu entry gốc bị sửa/xoá sau này). targetPainPoint giữ nguyên tên
  // field cũ nhưng giờ lấy từ description của painPointEntryId, không phải do
  // AI tự bịa.
  hookEntryId?: string;
  hookName?: string;
  painPointEntryId?: string;
  targetPainPoint?: string;
  discCode?: DiscCode;
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

// Nhật ký video ĐÃ ĐĂNG THẬT lên TikTok (Giai đoạn 6 Phase 5) - khớp
// server/models/VideoKPI.ts. Đóng vòng phản hồi cho kho kiến thức: mỗi lần
// ghi nhận sẽ +1 usageCount cho hook/pain point/DISC THẬT SỰ đã dùng.
export interface VideoKPI {
  id: string;
  userId: string;
  videoUrl: string;
  scriptId?: string;
  hookEntryId?: string;
  hookName?: string;
  painPointEntryId?: string;
  painPointName?: string;
  discCode?: DiscCode;
  views: number;
  likes: number;
  comments: number;
  retentionRate: number;
  completionRate: number;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Kho "value comment" (Giai đoạn 6 Phase 6) - khớp server/models/ValueComment.ts.
// AI tự lưu lúc phân tích video, không có cổng duyệt - chỉ xem + xoá.
export interface ValueComment {
  id: string;
  userId: string;
  text: string;
  reason: string;
  sourceVideoId?: string;
  sourceAuthorHandle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileTargetAudience {
  ageRange: string;
  gender: string;
  roles: string[];
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
