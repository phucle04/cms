import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompliance extends Document {
  userId: Types.ObjectId;
  ruleType: 'legal' | 'platform' | 'brand';
  rule: string;
  bannedWords: string[];
  alternatives: string[];
  severity: 'high' | 'medium' | 'low';
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const complianceSchema = new Schema<ICompliance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ruleType: {
      type: String,
      enum: ['legal', 'platform', 'brand'],
      required: true,
    },
    rule: { type: String, required: true },
    bannedWords: [String],
    alternatives: [String],
    severity: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    notes: String,
  },
  { timestamps: true }
);

complianceSchema.index({ userId: 1, ruleType: 1 });

export default mongoose.model<ICompliance>('Compliance', complianceSchema);
