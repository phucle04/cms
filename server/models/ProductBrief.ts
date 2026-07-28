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
  // Cổng tuân thủ (Giai đoạn 5, G6a): sản phẩm dinh dưỡng cho trẻ dưới 24
  // tháng tuổi chịu quy định quảng cáo riêng (Nghị định 100/2014/NĐ-CP) -
  // chặn tạo job nghiên cứu tự động, cần người phụ trách duyệt thủ công.
  // Optional để không phá dữ liệu cũ (sản phẩm có sẵn trước Giai đoạn 5).
  ageCategory?: 'under_24m' | '24m_plus' | 'not_applicable';
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
    ageCategory: { type: String, enum: ['under_24m', '24m_plus', 'not_applicable'] },
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
