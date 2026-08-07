import mongoose, { Schema, Document, Types } from 'mongoose';
import { DEFAULT_VIDEO_SCAN_COUNT, DEFAULT_SCRIPT_COUNT } from '../config/env';

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

const RESEARCH_JOB_STATUSES: ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'awaiting_hashtag_selection',
  'scraping',
  'downloading',
  'analyzing',
  'awaiting_combo_selection',
  'generating_scripts',
  'completed',
  'failed',
  'cancelled',
];

export interface IResearchJobSuggestedHashtag {
  tag: string;
  reason: string;
  score: number;
}

export interface IResearchJobProgressEntry {
  stage: string;
  message: string;
  percent: number;
  at: Date;
}

export interface IResearchJobError {
  stage: string;
  message: string;
  at: Date;
}

// Giai đoạn 6 Phase 3: thay cho "5 góc tiếp cận" cố định trước đây - mỗi kịch
// bản giờ gắn với ĐÚNG 1 bộ (hook, pain point, DISC) riêng, chọn từ kho tri
// thức (xem server/models/KnowledgeEntry.ts). null = không chỉ định cho slot
// đó (AI tự do quyết định phần đó khi sinh kịch bản).
export interface IResearchJobCombo {
  hookEntryId: string | null;
  painPointEntryId: string | null;
  discCode: 'D' | 'I' | 'S' | 'C' | null;
}

export interface IResearchJobTrendStatEntry {
  entryId: string;
  name: string;
  count: number;
}

export interface IResearchJobTrendStats {
  topHooks: IResearchJobTrendStatEntry[];
  topPainPoints: IResearchJobTrendStatEntry[];
  discDistribution: { D: number; I: number; S: number; C: number };
  videosClassified: number;
}

/**
 * Theo dõi chi phí THẬT của job - hệ thống này tiêu tiền thật mỗi lần chạy
 * (Apify + Gemini), đây là yêu cầu vận hành, không phải tính năng phụ.
 * apifyEstimatedUsd/geminiEstimatedUsd: ước tính TRƯỚC khi gọi (log để cảnh
 * báo sớm). apifyActualUsd: chi phí THẬT đọc qua Apify Actor API sau khi
 * chạy (xem tiktokService.ts::fetchApifyRunCost). geminiEstimatedUsd: Gemini
 * không có endpoint tra chi phí thật sau khi gọi như Apify, nên vẫn là ước
 * tính dựa trên token usage x đơn giá published của model - không có
 * "geminiActualUsd" tương ứng.
 */
export interface IResearchJobCost {
  apifyEstimatedUsd: number;
  apifyActualUsd: number;
  geminiInputTokens: number;
  geminiOutputTokens: number;
  geminiEstimatedUsd: number;
  totalEstimatedUsd: number;
}

export interface IResearchJob extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  brandProfileId?: Types.ObjectId;
  status: ResearchJobStatus;
  /**
   * Cờ yêu cầu dừng (Giai đoạn 5, dừng job ở bất kỳ giai đoạn nào) - set qua
   * POST /research/jobs/:id/cancel, pipeline đang chạy tự kiểm tra cờ này
   * giữa các bước/vòng lặp (xem checkCancelled() trong
   * researchPipelineService.ts) rồi dừng lại êm, KHÔNG throw như lỗi thật.
   */
  cancelRequested: boolean;
  autoSelectTop3: boolean;
  suggestedHashtags: IResearchJobSuggestedHashtag[];
  selectedHashtags: string[];
  // Giai đoạn 6 Phase 3: số video sẽ tải THẬT+phân tích (PASS 2, phần tốn
  // tiền nhất - thay cho hardcode topN=5 trước đây) và số kịch bản sẽ sinh.
  videoScanCount: number;
  scriptCount: number;
  // Lọc video theo tuổi (tính bằng THÁNG, VD 6/12/24/36) - video có ngày đăng
  // (createTimeISO) cũ hơn ngưỡng này, HOẶC thiếu hẳn createTimeISO, bị loại
  // NGAY ở PASS 1 (discoverTrendVideos trong tiktokService.ts), trước khi
  // chọn top N để tải/phân tích - xem docstring filterByMinCreateTime().
  // null/undefined = không giới hạn (giữ hành vi cũ).
  maxVideoAgeMonths?: number | null;
  // Thống kê xu hướng tính từ các video vừa phân tích xong (top hook/pain
  // point theo tần suất + % phân bố DISC) - tính 1 LẦN khi vừa xong Stage 4,
  // dùng để gợi ý suggestedCombos và hiển thị cho người dùng tham khảo.
  trendStats?: IResearchJobTrendStats;
  suggestedCombos: IResearchJobCombo[];
  // Combo THẬT người dùng xác nhận (giữ nguyên gợi ý hoặc tự chọn lại từ toàn
  // bộ kho) - Stage 5 dùng đúng danh sách này để sinh kịch bản (Phase 4).
  selectedCombos: IResearchJobCombo[];
  progress: IResearchJobProgressEntry[];
  apifyRunId?: string;
  apifyKvStoreId?: string;
  /**
   * Bản sao THÔ (raw) của kết quả searchTrendVideosByHashtags() (đã qua PASS
   * 1+2, gồm cả downloadAddr/subtitleLinks), lưu NGAY sau khi Apify trả kết
   * quả và TRƯỚC khi xử lý từng video. Lý do (sự cố thật 2026-07-27): dữ
   * liệu này đã tốn tiền Apify để lấy - nếu chết giữa lúc lưu từng
   * TrendVideo, resumeResearchPipeline phải đọc lại từ đây, TUYỆT ĐỐI không
   * gọi lại Apify. Type để Mixed (không dùng ApifyTikTokResult cụ thể) vì
   * đây chỉ là cache thô để resume, không phải dữ liệu cần query có cấu trúc.
   */
  rawScrapedVideos?: Record<string, unknown>[];
  /**
   * Tương tự rawScrapedVideos nhưng cho Stage 5: bản sao THÔ 5 kịch bản
   * Gemini trả về, lưu NGAY trước khi tạo Idea/Script. Nếu chết giữa lúc tạo
   * Idea/Script (ví dụ xong item 3/5) thì resume đọc lại từ đây, không gọi
   * lại Gemini - dữ liệu này cũng đã tốn tiền để sinh ra.
   */
  rawGeneratedScripts?: Record<string, unknown>[];
  resultIdeaIds: Types.ObjectId[];
  resultScriptIds: Types.ObjectId[];
  error?: IResearchJobError;
  cost: IResearchJobCost;
  createdAt: Date;
  updatedAt: Date;
}

const researchJobSchema = new Schema<IResearchJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'ProductBrief', required: true },
    brandProfileId: { type: Schema.Types.ObjectId, ref: 'BrandProfile' },
    status: { type: String, enum: RESEARCH_JOB_STATUSES, default: 'queued' },
    cancelRequested: { type: Boolean, default: false },
    autoSelectTop3: { type: Boolean, default: true },
    suggestedHashtags: [
      {
        tag: { type: String, required: true },
        reason: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
    selectedHashtags: [String],
    videoScanCount: { type: Number, default: DEFAULT_VIDEO_SCAN_COUNT },
    scriptCount: { type: Number, default: DEFAULT_SCRIPT_COUNT },
    maxVideoAgeMonths: { type: Number, default: null },
    trendStats: {
      topHooks: [{ entryId: String, name: String, count: Number }],
      topPainPoints: [{ entryId: String, name: String, count: Number }],
      discDistribution: { D: Number, I: Number, S: Number, C: Number },
      videosClassified: Number,
    },
    suggestedCombos: [
      {
        hookEntryId: { type: String, default: null },
        painPointEntryId: { type: String, default: null },
        discCode: { type: String, enum: ['D', 'I', 'S', 'C', null], default: null },
      },
    ],
    selectedCombos: [
      {
        hookEntryId: { type: String, default: null },
        painPointEntryId: { type: String, default: null },
        discCode: { type: String, enum: ['D', 'I', 'S', 'C', null], default: null },
      },
    ],
    progress: [
      {
        stage: { type: String, required: true },
        message: { type: String, required: true },
        percent: { type: Number, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    apifyRunId: String,
    apifyKvStoreId: String,
    rawScrapedVideos: [Schema.Types.Mixed],
    rawGeneratedScripts: [Schema.Types.Mixed],
    resultIdeaIds: [{ type: Schema.Types.ObjectId, ref: 'Idea' }],
    resultScriptIds: [{ type: Schema.Types.ObjectId, ref: 'Script' }],
    error: {
      stage: String,
      message: String,
      at: Date,
    },
    cost: {
      apifyEstimatedUsd: { type: Number, default: 0 },
      apifyActualUsd: { type: Number, default: 0 },
      geminiInputTokens: { type: Number, default: 0 },
      geminiOutputTokens: { type: Number, default: 0 },
      geminiEstimatedUsd: { type: Number, default: 0 },
      totalEstimatedUsd: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

researchJobSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

researchJobSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IResearchJob>('ResearchJob', researchJobSchema);
