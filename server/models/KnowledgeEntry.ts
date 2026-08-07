import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Kho tri thức "playbook" cho AI sinh kịch bản video short (Giai đoạn 6+):
 * 3 kho dùng chung 1 model, phân biệt bằng storeType - hook (công thức mở
 * đầu/giữ chân), pain_point (khung phân loại nỗi đau khách hàng), disc (kiểu
 * tính cách D/I/S/C để chọn giọng văn phù hợp). Mỗi kịch bản khi sinh ra sẽ
 * gắn với ĐÚNG 1 entry mỗi loại (xem Idea/Script.hookEntryId/painPointEntryId/
 * discEntryId), thay cho hệ "5 góc tiếp cận" cố định trước đây.
 */
export type KnowledgeStoreType = 'hook' | 'pain_point' | 'disc';
export type KnowledgeSource = 'uploaded' | 'learned';
export type KnowledgeStatus = 'approved' | 'pending';
export type DiscCode = 'D' | 'I' | 'S' | 'C';

export interface IKnowledgeEntry extends Document {
  userId: Types.ObjectId;
  storeType: KnowledgeStoreType;
  name: string;
  description: string;
  example?: string;
  // Chỉ có ý nghĩa khi storeType === 'disc' - mã kiểu tính cách chuẩn để sau
  // này đối chiếu/thống kê tỉ lệ (VD "40% video viral hợp kiểu D").
  discCode?: DiscCode;
  source: KnowledgeSource;
  // 'uploaded' (do người dùng tự nhập/upload) mặc định 'approved' luôn vì đã
  // được người dùng chọn lọc trước. 'learned' (AI tự phát hiện khi phân tích
  // video quét được) LUÔN bắt đầu ở 'pending' - phải người phụ trách duyệt
  // thủ công thì AI sinh kịch bản mới được dùng, tránh AI tự học sai rồi lấy
  // chính cái sai đó làm kiến thức cho lần sau.
  status: KnowledgeStatus;
  // Số lần entry này được dùng trong 1 video ĐÃ ĐĂNG thật (không phải số lần
  // AI generate ra) - tăng lên khi người dùng ghi nhận KPI 1 video có gắn
  // entry này (xem server/models/VideoKPI.ts ở phase sau). Dùng để sắp xếp
  // kho theo mức độ đã được kiểm chứng ngoài đời thực.
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeEntrySchema = new Schema<IKnowledgeEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeType: { type: String, enum: ['hook', 'pain_point', 'disc'], required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    example: String,
    discCode: { type: String, enum: ['D', 'I', 'S', 'C'] },
    source: { type: String, enum: ['uploaded', 'learned'], default: 'uploaded' },
    status: { type: String, enum: ['approved', 'pending'], default: 'approved' },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

knowledgeEntrySchema.index({ userId: 1, storeType: 1, usageCount: -1 });
knowledgeEntrySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export default mongoose.model<IKnowledgeEntry>('KnowledgeEntry', knowledgeEntrySchema);
