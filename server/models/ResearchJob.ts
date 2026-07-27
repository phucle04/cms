import mongoose, { Schema, Document, Types } from 'mongoose';

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

const RESEARCH_JOB_STATUSES: ResearchJobStatus[] = [
  'queued',
  'generating_hashtags',
  'awaiting_hashtag_selection',
  'scraping',
  'downloading',
  'analyzing',
  'generating_scripts',
  'completed',
  'failed',
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
  autoSelectTop3: boolean;
  suggestedHashtags: IResearchJobSuggestedHashtag[];
  selectedHashtags: string[];
  progress: IResearchJobProgressEntry[];
  apifyRunId?: string;
  apifyKvStoreId?: string;
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
    autoSelectTop3: { type: Boolean, default: true },
    suggestedHashtags: [
      {
        tag: { type: String, required: true },
        reason: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
    selectedHashtags: [String],
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
