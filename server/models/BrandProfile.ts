import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBrandProfileTargetAudience {
  ageRange: string;
  gender: string;
  roles: string[];
  painPoints: string[];
}

export interface IBrandProfileStoreInfo {
  branches: unknown[];
  hotline: string;
  website: string;
  currentPromotions: string[];
}

export interface IBrandProfile extends Document {
  userId: Types.ObjectId;
  brandName: string;
  tagline?: string;
  industry: string;
  targetAudience: IBrandProfileTargetAudience;
  toneOfVoice: string;
  doList: string[];
  dontList: string[];
  complianceNotes?: string;
  storeInfo: IBrandProfileStoreInfo;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandProfileSchema = new Schema<IBrandProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    brandName: { type: String, required: true },
    tagline: String,
    industry: { type: String, required: true },
    targetAudience: {
      ageRange: String,
      gender: String,
      roles: [String],
      painPoints: [String],
    },
    toneOfVoice: { type: String, required: true },
    // dontList là ràng buộc CỨNG (pháp lý/compliance), không phải gợi ý -
    // mọi prompt sinh script ở Giai đoạn 2+ phải nhúng danh sách này nguyên văn.
    doList: [String],
    dontList: [String],
    complianceNotes: String,
    storeInfo: {
      branches: [Schema.Types.Mixed],
      hotline: String,
      website: String,
      currentPromotions: [String],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

brandProfileSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

brandProfileSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<IBrandProfile>('BrandProfile', brandProfileSchema);
