import mongoose, { Schema, Document, Types } from 'mongoose';

export type PromptTemplateKey = 'hashtag' | 'video_analysis' | 'script_gen';

const PROMPT_TEMPLATE_KEYS: PromptTemplateKey[] = ['hashtag', 'video_analysis', 'script_gen'];

export interface IPromptTemplate extends Document {
  userId: Types.ObjectId;
  key: PromptTemplateKey;
  name: string;
  niche: string;
  systemPrompt: string;
  userPromptTemplate: string;
  // Đặt tên "aiModel" chứ không phải "model": field tên "model" đụng độ với
  // method Document.model() có sẵn trong type định nghĩa của Mongoose, gây
  // lỗi biên dịch TS2430 dưới strict mode.
  aiModel: string;
  temperature: number;
  isDefault: boolean;
  isSystemSeed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const promptTemplateSchema = new Schema<IPromptTemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, enum: PROMPT_TEMPLATE_KEYS, required: true },
    name: { type: String, required: true },
    niche: String,
    // Chứa placeholder kiểu {{productName}}, {{brandName}}, ... được service
    // ở Giai đoạn 2+ thay thế bằng dữ liệu thật trước khi gửi cho Gemini.
    systemPrompt: { type: String, required: true },
    userPromptTemplate: { type: String, required: true },
    // Để rỗng ("") nghĩa là dùng GEMINI_MODEL mặc định từ env, không hardcode ở đây.
    aiModel: { type: String, default: '' },
    temperature: { type: Number, default: 0.7 },
    isDefault: { type: Boolean, default: false },
    isSystemSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

promptTemplateSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

promptTemplateSchema.index({ userId: 1, key: 1, isDefault: 1 });

export default mongoose.model<IPromptTemplate>('PromptTemplate', promptTemplateSchema);
