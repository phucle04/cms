import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStoryboard extends Document {
  userId: Types.ObjectId;
  scriptId: Types.ObjectId;
  scenes: Array<{
    order: number;
    description: string;
    duration: number;
    visualNotes?: string;
    transitions?: string;
  }>;
  status: 'draft' | 'approved';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const storyboardSchema = new Schema<IStoryboard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script', required: true },
    scenes: [
      {
        order: Number,
        description: String,
        duration: Number,
        visualNotes: String,
        transitions: String,
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'approved'],
      default: 'draft',
    },
    notes: String,
  },
  { timestamps: true }
);

storyboardSchema.index({ userId: 1, scriptId: 1 });

export default mongoose.model<IStoryboard>('Storyboard', storyboardSchema);
