import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWinLossAnalysis extends Document {
  userId: Types.ObjectId;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  performanceOverview: string;
  patterns: string[];
  gaps: string[];
  recommendations: string[];
  nextSteps: string;
  generatedAt: Date;
}

const winLossAnalysisSchema = new Schema<IWinLossAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dateRangeStart: { type: Date, required: true },
    dateRangeEnd: { type: Date, required: true },
    performanceOverview: { type: String, required: true },
    patterns: [String],
    gaps: [String],
    recommendations: [String],
    nextSteps: String,
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

winLossAnalysisSchema.index({ userId: 1, dateRangeEnd: -1 });

export default mongoose.model<IWinLossAnalysis>('WinLossAnalysis', winLossAnalysisSchema);
