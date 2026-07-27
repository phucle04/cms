import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompetitor extends Document {
  userId: Types.ObjectId;
  name: string;
  platforms: Array<{
    name: string;
    followers: number;
    avgViews: number;
    engagementRate: number;
  }>;
  strengths: string[];
  weaknesses: string[];
  contentStyle: string;
  pricing?: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const competitorSchema = new Schema<ICompetitor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    platforms: [
      {
        name: String,
        followers: Number,
        avgViews: Number,
        engagementRate: Number,
      },
    ],
    strengths: [String],
    weaknesses: [String],
    contentStyle: String,
    pricing: String,
    notes: String,
  },
  { timestamps: true }
);

competitorSchema.index({ userId: 1 });

export default mongoose.model<ICompetitor>('Competitor', competitorSchema);
