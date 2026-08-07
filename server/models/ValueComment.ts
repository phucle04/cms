import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Kho "value comment" (Giai đoạn 6 Phase 6, điểm 5 trong spec gốc) - bình
 * luận THẬT trích từ video đã quét, được Gemini đánh giá là có thể tái dùng
 * cho kịch bản của SẢN PHẨM KHÁC sau này (VD: hài hước, đồng cảm sâu sắc, câu
 * chữ bắt trend). AI TỰ LƯU THẲNG lúc phân tích video (Stage 4), KHÔNG có
 * cổng duyệt (khác kho hook/pain_point 'learned' phải duyệt) - theo đúng
 * quyết định đã chốt với người dùng ("AI tự lưu thẳng, không cần duyệt, có
 * nút xoá") - xem valueCommentService.ts.
 */
export interface IValueComment extends Document {
  userId: Types.ObjectId;
  text: string;
  // Đã chuẩn hoá (bỏ dấu, thường hoá, bỏ khoảng trắng) - dùng để chống lưu
  // trùng lặp cùng 1 bình luận nhiều lần (xem valueCommentService.ts).
  normalizedText: string;
  reason: string;
  sourceVideoId?: string;
  sourceAuthorHandle?: string;
  createdAt: Date;
  updatedAt: Date;
}

const valueCommentSchema = new Schema<IValueComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    normalizedText: { type: String, required: true },
    reason: { type: String, required: true },
    sourceVideoId: String,
    sourceAuthorHandle: String,
  },
  { timestamps: true }
);

valueCommentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

valueCommentSchema.index({ userId: 1, normalizedText: 1 });
valueCommentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IValueComment>('ValueComment', valueCommentSchema);
