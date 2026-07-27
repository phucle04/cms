import mongoose, { Schema, Document, Types} from 'mongoose';

export interface IIdea extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  source: string;
  priority: 'low' | 'medium' | 'high';
  // 'draft' thêm cho idea do pipeline research tự sinh (Giai đoạn 3, chờ
  // người dùng duyệt trước khi coi là 'new'/actionable) - không đổi default,
  // idea tạo tay qua createIdea() vẫn mặc định 'new' như cũ.
  status: 'draft' | 'new' | 'in progress' | 'done' | 'discarded';
  productId?: Types.ObjectId;
  relatedTrends?: Types.ObjectId[];
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
      enum: ['draft', 'new', 'in progress', 'done', 'discarded'],
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
