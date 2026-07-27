import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScript extends Document {
  userId: Types.ObjectId;
  ideaId: Types.ObjectId;
  title: string;
  content: string;
  format: 'short' | 'long' | 'bullet';
  duration?: number;
  voiceOver?: string;
  keyMessages: string[];
  callToAction: string;
  generatedBy?: string;
  status: 'draft' | 'approved' | 'rejected';
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scriptSchema = new Schema<IScript>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ideaId: { type: Schema.Types.ObjectId, ref: 'Idea', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    format: {
      type: String,
      enum: ['short', 'long', 'bullet'],
      default: 'short',
    },
    duration: Number,
    voiceOver: String,
    keyMessages: [String],
    callToAction: String,
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

scriptSchema.index({ userId: 1, ideaId: 1, status: 1 });

export default mongoose.model<IScript>('Script', scriptSchema);
