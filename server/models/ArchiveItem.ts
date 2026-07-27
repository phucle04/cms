import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IArchiveItem extends Document {
  userId: Types.ObjectId;
  itemType: 'product' | 'trend' | 'script' | 'idea' | 'report';
  itemId: string;
  itemData: Record<string, any>;
  reason: string;
  archivedAt: Date;
  restorableUntil?: Date;
}

const archiveItemSchema = new Schema<IArchiveItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    itemType: {
      type: String,
      enum: ['product', 'trend', 'script', 'idea', 'report'],
      required: true,
    },
    itemId: { type: String, required: true },
    itemData: { type: Schema.Types.Mixed, required: true },
    reason: String,
    archivedAt: { type: Date, default: Date.now },
    restorableUntil: Date,
  },
  { timestamps: true }
);

archiveItemSchema.index({ userId: 1, itemType: 1, archivedAt: -1 });

export default mongoose.model<IArchiveItem>('ArchiveItem', archiveItemSchema);
