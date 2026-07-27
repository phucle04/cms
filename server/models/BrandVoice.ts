import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * @deprecated Thay thế bởi BrandProfile (server/models/BrandProfile.ts), đã hấp
 * thụ field `tone`/`personality`/`doList`/`dontList`/`ctaSamples` vào
 * `toneOfVoice`/`doList`/`dontList` của BrandProfile. Giữ lại model này để
 * tương thích ngược (không có controller/route nào còn dùng nó tính đến
 * 2026-07-27), dự kiến sẽ xoá hẳn ở một đợt dọn dẹp sau. Đừng tạo controller
 * hoặc route mới trỏ vào model này — dùng BrandProfile.
 */
export interface IBrandVoice extends Document {
  userId: Types.ObjectId;
  tone: string;
  personality: string[];
  doList: string[];
  dontList: string[];
  ctaSamples: string[];
  updatedAt: Date;
}

const brandVoiceSchema = new Schema<IBrandVoice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    tone: { type: String, required: true },
    personality: [String],
    doList: [String],
    dontList: [String],
    ctaSamples: [String],
  },
  { timestamps: true }
);

export default mongoose.model<IBrandVoice>('BrandVoice', brandVoiceSchema);
