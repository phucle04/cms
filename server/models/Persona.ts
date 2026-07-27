import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPersona extends Document {
  userId: Types.ObjectId;
  type: 'main' | 'sub';
  name: string;
  age: string;
  background: string;
  painPoints: string[];
  interests: string[];
  motivations: string[];
  createdAt: Date;
  updatedAt: Date;
}

const personaSchema = new Schema<IPersona>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['main', 'sub'], default: 'sub' },
    name: { type: String, required: true },
    age: String,
    background: String,
    painPoints: [String],
    interests: [String],
    motivations: [String],
  },
  { timestamps: true }
);

personaSchema.index({ userId: 1, type: 1 });

export default mongoose.model<IPersona>('Persona', personaSchema);
