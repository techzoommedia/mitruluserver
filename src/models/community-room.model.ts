import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunityRoom extends Document {
  roomId: string;
  name: string;
  teluguTitle: string;
  language: string;
  type: 'audio' | 'video';
  topic: string;
  avatar: string;
  isStopped: boolean;
  stoppedReason?: string;
  admins: string[];
  tags: string[];
  maxParticipants: number;
  costCoins: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const CommunityRoomSchema = new Schema<ICommunityRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    teluguTitle: { type: String, required: true },
    language: { type: String, default: 'Telugu' },
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    topic: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isStopped: { type: Boolean, default: false },
    stoppedReason: { type: String, default: '' },
    admins: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    maxParticipants: { type: Number, default: 50 },
    costCoins: { type: Number, default: 0 },
  },
  { collection: 'communityrooms', timestamps: true }
);

export const CommunityRoomModel: mongoose.Model<ICommunityRoom> =
  (mongoose.models.CommunityRoom as mongoose.Model<ICommunityRoom>) ||
  mongoose.model<ICommunityRoom>('CommunityRoom', CommunityRoomSchema);
