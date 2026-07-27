import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrend extends Document {
  userId: Types.ObjectId;
  name: string;
  description: string;
  status: 'new' | 'hot' | 'cold' | 'archived';
  source: string;
  relevance: 'high' | 'medium' | 'low';
  opportunities: string[];
  createdAt: Date;
  updatedAt: Date;
}

const trendSchema = new Schema<ITrend>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ['new', 'hot', 'cold', 'archived'],
      default: 'new',
    },
    source: String,
    relevance: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    opportunities: [String],
  },
  { timestamps: true }
);

trendSchema.index({ userId: 1, status: 1 });

export default mongoose.model<ITrend>('Trend', trendSchema);
