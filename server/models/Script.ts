import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScriptBodySegment {
  tStart: number;
  tEnd: number;
  voiceover: string;
  visual: string;
  textOnScreen: string;
}

export interface IScript extends Document {
  userId: Types.ObjectId;
  ideaId: Types.ObjectId;
  title: string;
  content: string;
  format: 'short' | 'long' | 'bullet';
  duration?: number;
  voiceOver?: string;
  keyMessages: string[];
  callToAction: string;
  generatedBy?: string;
  status: 'draft' | 'approved' | 'rejected';
  feedback?: string;
  // Field mở rộng cho kịch bản do pipeline research sinh ra (Giai đoạn 3,
  // researchPipelineService.ts Stage 5) - content/callToAction ở trên vẫn
  // được điền (bản text rút gọn, tương thích ngược với UI/tính năng cũ đọc
  // 2 field đó), còn field dưới đây giữ đầy đủ cấu trúc gốc theo timeline.
  // Giai đoạn 6 Phase 4: thay "angle" cố định bằng combo (hook, pain point,
  // DISC) THẬT đã dùng để sinh kịch bản này - *EntryId tham chiếu
  // KnowledgeEntry, *Name/targetPainPoint là SNAPSHOT tên/mô tả tại thời điểm
  // sinh (không tự cập nhật nếu entry gốc bị sửa/xoá sau này).
  hookEntryId?: string;
  hookName?: string;
  painPointEntryId?: string;
  targetPainPoint?: string;
  discCode?: 'D' | 'I' | 'S' | 'C';
  body?: IScriptBodySegment[];
  caption?: string;
  hashtags?: string[];
  shotList?: string[];
  learnedFrom?: string[];
  confidence?: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

const scriptSchema = new Schema<IScript>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ideaId: { type: Schema.Types.ObjectId, ref: 'Idea', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    format: {
      type: String,
      enum: ['short', 'long', 'bullet'],
      default: 'short',
    },
    duration: Number,
    voiceOver: String,
    keyMessages: [String],
    callToAction: String,
    generatedBy: { type: String, enum: ['user', 'ai'], default: 'user' },
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected'],
      default: 'draft',
    },
    feedback: String,
    hookEntryId: String,
    hookName: String,
    painPointEntryId: String,
    targetPainPoint: String,
    discCode: { type: String, enum: ['D', 'I', 'S', 'C'] },
    body: [
      {
        tStart: Number,
        tEnd: Number,
        voiceover: String,
        visual: String,
        textOnScreen: String,
      },
    ],
    caption: String,
    hashtags: [String],
    shotList: [String],
    learnedFrom: [String],
    confidence: { type: String, enum: ['high', 'medium', 'low'] },
  },
  { timestamps: true }
);

scriptSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

scriptSchema.index({ userId: 1, ideaId: 1, status: 1 });

export default mongoose.model<IScript>('Script', scriptSchema);
