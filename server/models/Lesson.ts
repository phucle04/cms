import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILesson extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  category: 'content' | 'strategy' | 'performance' | 'technical';
  source: 'analysis' | 'user' | 'ai';
  relatedAnalysisId?: Types.ObjectId;
  impact: 'high' | 'medium' | 'low';
  actionItems?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['content', 'strategy', 'performance', 'technical'],
      required: true,
    },
    source: {
      type: String,
      enum: ['analysis', 'user', 'ai'],
      default: 'user',
    },
    relatedAnalysisId: { type: Schema.Types.ObjectId, ref: 'WinLossAnalysis' },
    impact: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    actionItems: [String],
  },
  { timestamps: true }
);

lessonSchema.index({ userId: 1, category: 1 });

export default mongoose.model<ILesson>('Lesson', lessonSchema);
