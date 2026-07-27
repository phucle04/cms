import mongoose, { Schema, Document, Types } from 'mongoose';

export type TrendVideoDownloadStatus =
  | 'pending'
  | 'downloaded_apify'
  | 'downloaded_ytdlp'
  | 'text_only'
  | 'failed';

const DOWNLOAD_STATUSES: TrendVideoDownloadStatus[] = [
  'pending',
  'downloaded_apify',
  'downloaded_ytdlp',
  'text_only',
  'failed',
];

export interface ITrendVideoSubtitleLink {
  language: string;
  downloadLink: string;
}

export interface ITrendVideoComment {
  text: string;
  likeCount: number;
  authorHandle: string;
}

export interface ITrendVideo extends Document {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  videoId: string;
  webVideoUrl: string;
  caption: string;
  hashtags: string[];
  playCount: number;
  diggCount: number;
  shareCount: number;
  commentCount: number;
  collectCount: number;
  createTimeISO: string;
  authorName: string;
  authorHandle: string;
  authorFollowers: number;
  thumbnailUrl: string;
  downloadAddr?: string;
  subtitleLinks: ITrendVideoSubtitleLink[];
  musicName: string;
  downloadStatus: TrendVideoDownloadStatus;
  analysis?: Record<string, unknown>;
  analysisConfidence?: 'high' | 'low';
  analyzedAt?: Date;
  topComments: ITrendVideoComment[];
  createdAt: Date;
  updatedAt: Date;
}

const trendVideoSchema = new Schema<ITrendVideo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'ResearchJob', required: true },
    videoId: { type: String, required: true },
    webVideoUrl: { type: String, required: true },
    caption: String,
    hashtags: [String],
    playCount: { type: Number, default: 0 },
    diggCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    collectCount: { type: Number, default: 0 },
    createTimeISO: String,
    authorName: String,
    authorHandle: String,
    authorFollowers: { type: Number, default: 0 },
    thumbnailUrl: String,
    downloadAddr: String,
    subtitleLinks: [
      {
        language: String,
        downloadLink: String,
      },
    ],
    musicName: String,
    downloadStatus: { type: String, enum: DOWNLOAD_STATUSES, default: 'pending' },
    analysis: Schema.Types.Mixed,
    analysisConfidence: { type: String, enum: ['high', 'low'] },
    analyzedAt: Date,
    topComments: [
      {
        text: String,
        likeCount: Number,
        authorHandle: String,
      },
    ],
  },
  { timestamps: true }
);

trendVideoSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

trendVideoSchema.index({ jobId: 1, videoId: 1 }, { unique: true });

export default mongoose.model<ITrendVideo>('TrendVideo', trendVideoSchema);
