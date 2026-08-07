import mongoose, { Schema, Document, Types } from 'mongoose';
import type { DiscCode } from './KnowledgeEntry';

/**
 * Nhật ký video ĐÃ ĐĂNG THẬT lên TikTok (Giai đoạn 6 Phase 5) - người phụ
 * trách tự điền lại sau khi đăng (link + số liệu), dùng để đóng vòng phản hồi
 * cho kho tri thức (xem KnowledgeEntry.usageCount): mỗi lần ghi nhận 1 video,
 * hook/pain point/DISC THẬT SỰ đã dùng được +1 usageCount, giúp kho tự xếp
 * hạng theo hiệu quả ngoài đời thay vì chỉ theo số lần AI generate ra.
 *
 * hookEntryId/painPointEntryId/discCode: TỰ ĐỘNG lấy từ Script gốc (nếu
 * scriptId trỏ tới 1 script do pipeline Phase 4 sinh ra, đã có sẵn combo) -
 * THỦ CÔNG (người dùng tự chọn) nếu không có script gốc, hoặc script gốc
 * không có combo (kịch bản tạo tay qua /ideation, generatedBy='user') - xem
 * videoKpiController.ts::createVideoKpi. *Name là snapshot tên entry tại thời
 * điểm ghi nhận, không tự cập nhật nếu entry gốc bị sửa/xoá sau này.
 */
export interface IVideoKPI extends Document {
  userId: Types.ObjectId;
  videoUrl: string;
  scriptId?: Types.ObjectId;
  hookEntryId?: string;
  hookName?: string;
  painPointEntryId?: string;
  painPointName?: string;
  discCode?: DiscCode;
  views: number;
  likes: number;
  comments: number;
  // % - "chỉ số giữ chân" (bao nhiêu % người xem còn ở lại qua từng mốc thời
  // gian, khác completionRate là % xem trọn hết video).
  retentionRate: number;
  completionRate: number;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const videoKPISchema = new Schema<IVideoKPI>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    videoUrl: { type: String, required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: 'Script' },
    hookEntryId: String,
    hookName: String,
    painPointEntryId: String,
    painPointName: String,
    discCode: { type: String, enum: ['D', 'I', 'S', 'C'] },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    retentionRate: { type: Number, min: 0, max: 100, default: 0 },
    completionRate: { type: Number, min: 0, max: 100, default: 0 },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

videoKPISchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

videoKPISchema.index({ userId: 1, postedAt: -1 });

export default mongoose.model<IVideoKPI>('VideoKPI', videoKPISchema);
