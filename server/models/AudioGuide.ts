import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAudioGuide extends Document {
  userId: Types.ObjectId;
  scriptId: Types.ObjectId;
  voiceActorNotes: string;
  tonDirection: string;
  pacing: string;
  emotionalCues: string[];
  audioFileUrl?: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const audioGuideSchema = new Schema<IAudioGuide>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script', required: true },
    voiceActorNotes: String,
    tonDirection: String,
    pacing: String,
    emotionalCues: [String],
    audioFileUrl: String,
    duration: Number,
  },
  { timestamps: true }
);

audioGuideSchema.index({ userId: 1, scriptId: 1 });

export default mongoose.model<IAudioGuide>('AudioGuide', audioGuideSchema);
