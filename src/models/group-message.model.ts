import mongoose, { Schema, Document, Model } from 'mongoose';

export type GroupMediaType = 'image' | 'video' | 'audio' | 'file';

export interface IGroupMessage extends Document {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderTeluguName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: GroupMediaType;
  timestamp: number;
  deletedFor?: string[];
  isEdited?: boolean;
  editedAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const GroupMessageSchema = new Schema<IGroupMessage>(
  {
    id: { type: String, required: true, unique: true, index: true },
    groupId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true, trim: true },
    senderAvatar: { type: String, default: '' },
    senderHandle: { type: String, default: '' },
    senderTeluguName: { type: String, default: '' },
    text: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'file'] },
    timestamp: { type: Number, required: true, index: true },
    deletedFor: { type: [String], default: [], index: true },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Number },
  },
  {
    collection: 'group_messages',
    timestamps: true,
  }
);

// High performance compound index for paginated group chats
GroupMessageSchema.index({ groupId: 1, timestamp: -1 });

export const GroupMessageModel: Model<IGroupMessage> =
  mongoose.models.GroupMessage ||
  mongoose.model<IGroupMessage>('GroupMessage', GroupMessageSchema);

export default GroupMessageModel;

