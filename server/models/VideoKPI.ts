import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVideoKPI extends Document {
  userId: Types.ObjectId;
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
  scriptId?: Types.ObjectId;
}

const videoKPISchema = new Schema<IVideoKPI>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    views: { type: Number, required: true, default: 0 },
    likes: { type: Number, required: true, default: 0 },
    comments: { type: Number, required: true, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    watchTime: { type: Number, default: 0 },
    retention: { type: Number, min: 0, max: 100, default: 0 },
    ctr: { type: Number, min: 0, max: 100, default: 0 },
    orders: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    rank: {
      type: String,
      enum: ['S', 'A', 'B', 'C', 'D'],
      default: 'D',
    },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

videoKPISchema.index({ userId: 1, timestamp: -1 });
videoKPISchema.index({ userId: 1, rank: 1 });

export default mongoose.model<IVideoKPI>('VideoKPI', videoKPISchema);
