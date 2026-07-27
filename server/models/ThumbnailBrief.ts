import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IThumbnailBrief extends Document {
  userId: Types.ObjectId;
  scriptId: Types.ObjectId;
  concept: string;
  textSuggestion: string;
  colorScheme: string;
  composition: string;
  aiPrompt: string;
  generatedBy?: string;
  status: 'draft' | 'approved' | 'rejected';
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const thumbnailBriefSchema = new Schema<IThumbnailBrief>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script', required: true },
    concept: { type: String, required: true },
    textSuggestion: String,
    colorScheme: String,
    composition: String,
    aiPrompt: String,
    generatedBy: { type: String, enum: ['user', 'ai'], default: 'user' },
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected'],
      default: 'draft',
    },
    feedback: String,
  },
  { timestamps: true }
);

thumbnailBriefSchema.index({ userId: 1, scriptId: 1 });

export default mongoose.model<IThumbnailBrief>('ThumbnailBrief', thumbnailBriefSchema);
