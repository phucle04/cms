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
