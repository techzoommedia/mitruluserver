import mongoose, { Schema, Document } from 'mongoose';

export interface ICallSession extends Document {
  callId: string;
  roomName: string;
  callerId: string;
  callerName: string;
  callerTeluguName?: string;
  callerHandle: string;
  callerAvatar: string;
  targetUserId: string;
  targetUserName?: string;
  targetUserTeluguName?: string;
  targetUserAvatar?: string;
  callType: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'timeout';
  durationSeconds?: number;
  rating?: number;
  feedback?: string;
  endedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const CallSessionSchema = new Schema<ICallSession>(
  {
    callId: { type: String, required: true, unique: true, index: true },
    roomName: { type: String, required: true, index: true },
    callerId: { type: String, required: true, index: true },
    callerName: { type: String, required: true },
    callerTeluguName: { type: String },
    callerHandle: { type: String, required: true },
    callerAvatar: { type: String, default: '' },
    targetUserId: { type: String, required: true, index: true },
    targetUserName: { type: String },
    targetUserTeluguName: { type: String },
    targetUserAvatar: { type: String },
    callType: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'declined', 'ended', 'timeout'],
      default: 'ringing',
      index: true,
    },
    durationSeconds: { type: Number, default: 0 },
    rating: { type: Number },
    feedback: { type: String, default: '' },
    endedAt: { type: Date },
  },
  { collection: 'callsessions', timestamps: true }
);

export const CallSessionModel: mongoose.Model<ICallSession> =
  (mongoose.models.CallSession as mongoose.Model<ICallSession>) ||
  mongoose.model<ICallSession>('CallSession', CallSessionSchema);
