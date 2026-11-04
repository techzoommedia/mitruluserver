import mongoose, { Schema, Document, Model } from 'mongoose';

export type MessageStatus = 'sent' | 'delivered' | 'seen';
export type MediaType = 'image' | 'video' | 'audio' | 'file';

export interface IDirectMessage extends Document {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderTeluguName?: string;
  targetUserId: string;
  targetUserName: string;
  targetUserAvatar?: string;
  targetUserHandle?: string;
  targetUserTeluguName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  audioDuration?: number;
  timestamp: number;
  status: MessageStatus;
  conversationKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DirectMessageSchema = new Schema<IDirectMessage>(
  {
    id: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true, trim: true },
    senderAvatar: { type: String, default: '' },
    senderHandle: { type: String, default: '' },
    senderTeluguName: { type: String, default: '' },
    targetUserId: { type: String, required: true, index: true },
    targetUserName: { type: String, required: true, trim: true },
    targetUserAvatar: { type: String, default: '' },
    targetUserHandle: { type: String, default: '' },
    targetUserTeluguName: { type: String, default: '' },
    text: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'file'] },
    audioDuration: { type: Number },
    timestamp: { type: Number, required: true, index: true },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent', index: true },
    conversationKey: { type: String, required: true, index: true },
  },
  {
    collection: 'directmessages',
    timestamps: true,
  }
);

// High-performance compound indexes for zero-latency queries & realtime sync
DirectMessageSchema.index({ conversationKey: 1, timestamp: -1 });
DirectMessageSchema.index({ targetUserId: 1, status: 1 });
DirectMessageSchema.index({ senderId: 1, timestamp: -1 });
DirectMessageSchema.index({ targetUserId: 1, timestamp: -1 });
DirectMessageSchema.index({ senderId: 1, targetUserId: 1, timestamp: -1 });

export function buildConversationKey(userA: string, userB: string): string {
  const a = String(userA || '').trim().toLowerCase();
  const b = String(userB || '').trim().toLowerCase();
  return [a, b].sort().join(':');
}

export const DirectMessageModel: Model<IDirectMessage> =
  (mongoose.models.DirectMessage as Model<IDirectMessage>) ||
  mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema);

