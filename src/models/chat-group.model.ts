import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatGroup extends Document {
  id: string; // URL-safe slug e.g. 'telugu', 'hyderabad', 'cinema'
  name: string;
  teluguName: string;
  description: string;
  avatar: string;
  category: string;
  isPublic: boolean;
  isHold: boolean;
  holdReason?: string;
  heldAt?: Date | null;
  heldBy?: string;
  rules?: string;
  customMemberCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatGroupSchema = new Schema<IChatGroup>(
  {
    id: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    teluguName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    avatar: { type: String, default: '/mitrulu-logo.webp' },
    category: { type: String, default: 'Community', index: true },
    isPublic: { type: Boolean, default: true },
    isHold: { type: Boolean, default: false, index: true },
    holdReason: { type: String, default: '' },
    heldAt: { type: Date, default: null },
    heldBy: { type: String, default: '' },
    rules: { type: String, default: '' },
    customMemberCount: { type: Number, default: 0 },
  },
  {
    collection: 'chat_groups',
    timestamps: true,
  }
);

export const ChatGroupModel: Model<IChatGroup> =
  mongoose.models.ChatGroup || mongoose.model<IChatGroup>('ChatGroup', ChatGroupSchema);

export default ChatGroupModel;
