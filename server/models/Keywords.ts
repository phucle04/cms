import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IKeywords extends Document {
  userId: Types.ObjectId;
  type: 'seo' | 'hashtag' | 'voice_search';
  keywords: string[];
  platform?: string;
  priority: 'high' | 'medium' | 'low';
  searchVolume?: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const keywordsSchema = new Schema<IKeywords>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['seo', 'hashtag', 'voice_search'],
      required: true,
    },
    keywords: [String],
    platform: String,
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    searchVolume: Number,
    notes: String,
  },
  { timestamps: true }
);

keywordsSchema.index({ userId: 1, type: 1 });

export default mongoose.model<IKeywords>('Keywords', keywordsSchema);
