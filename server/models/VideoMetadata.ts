import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVideoMetadata extends Document {
  userId: Types.ObjectId;
  scriptId: Types.ObjectId;
  title: string;
  description: string;
  tags: string[];
  category: string;
  language: string;
  duration: number;
  generatedBy?: string;
  status: 'draft' | 'approved' | 'rejected';
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoMetadataSchema = new Schema<IVideoMetadata>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [String],
    category: String,
    language: { type: String, default: 'en' },
    duration: Number,
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

videoMetadataSchema.index({ userId: 1, scriptId: 1 });

export default mongoose.model<IVideoMetadata>('VideoMetadata', videoMetadataSchema);
