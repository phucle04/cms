import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * @deprecated Thay thế bởi BrandProfile (server/models/BrandProfile.ts), đã hấp
 * thụ field `branches`/`currentPromo`/`promoDates`/`contactEmail`/`website` vào
 * `storeInfo.{branches,hotline,website,currentPromotions}` của BrandProfile.
 * Giữ lại model này để tương thích ngược (không có controller/route nào còn
 * dùng nó tính đến 2026-07-27), dự kiến sẽ xoá hẳn ở một đợt dọn dẹp sau.
 * Đừng tạo controller hoặc route mới trỏ vào model này — dùng BrandProfile.
 */
export interface IStoreInfo extends Document {
  userId: Types.ObjectId;
  branches: Array<{
    name: string;
    location: string;
    hours: string;
    phone: string;
  }>;
  currentPromo?: string;
  promoDates?: string;
  contactEmail: string;
  website?: string;
  socialLinks?: Record<string, string>;
  notes: string;
  updatedAt: Date;
}

const storeInfoSchema = new Schema<IStoreInfo>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    branches: [
      {
        name: String,
        location: String,
        hours: String,
        phone: String,
      },
    ],
    currentPromo: String,
    promoDates: String,
    contactEmail: String,
    website: String,
    socialLinks: Schema.Types.Mixed,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model<IStoreInfo>('StoreInfo', storeInfoSchema);
