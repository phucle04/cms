import mongoose, { Schema, Document,Types } from 'mongoose';

export interface IProductBrief extends Document {
  userId: Types.ObjectId;
  name: string;
  category: string;
  usp: string;
  painPoints: string;
  faqContent?: string;
  socialProof?: string;
  comparison?: string;
  shootingTips?: string;
  mediaUrl?: string;
  keywords?: string[];
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const productBriefSchema = new Schema<IProductBrief>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    usp: { type: String, required: true },
    painPoints: String,
    faqContent: String,
    socialProof: String,
    comparison: String,
    shootingTips: String,
    mediaUrl: String,
    keywords: [String],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

productBriefSchema.index({ userId: 1, status: 1 });
productBriefSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});
export default mongoose.model<IProductBrief>('ProductBrief', productBriefSchema);
