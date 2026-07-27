import mongoose, { Schema, Document } from 'mongoose';
import bcryptjs from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  settings: {
    aiProvider: string;
    aiApiKey: string;
    aiModel: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      default: 'editor',
    },
    settings: {
      aiProvider: { type: String, default: 'mock' },
      aiApiKey: { type: String, default: '' },
      aiModel: { type: String, default: 'gpt-4' },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
  } catch (error: any) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return await bcryptjs.compare(password, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
