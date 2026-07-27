import mongoose, { Schema, Document, Types} from 'mongoose';

export interface IIdea extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  source: string;
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'in progress' | 'done' | 'discarded';
  productId?: string;
  relatedTrends?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ideaSchema = new Schema<IIdea>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    source: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['new', 'in progress', 'done', 'discarded'],
      default: 'new',
    },
    productId: { type: Schema.Types.ObjectId, ref: 'ProductBrief' },
    relatedTrends: [{ type: Schema.Types.ObjectId, ref: 'Trend' }],
    notes: String,
  },
  { timestamps: true }
);

ideaSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

ideaSchema.index({ userId: 1, status: 1, priority: 1 });

export default mongoose.model<IIdea>('Idea', ideaSchema);
