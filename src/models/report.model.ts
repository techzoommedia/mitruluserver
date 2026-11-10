import mongoose, { Schema, Document } from 'mongoose';

export type ReportSeverity = 'red' | 'orange' | 'yellow' | 'blue' | 'grey';
export type ReportTargetType = 'post' | 'comment' | 'profile' | 'message' | 'call' | 'story';
export type ReportStatus = 'pending' | 'hidden_pending_review' | 'escalated' | 'resolved' | 'dismissed' | 'appealed';

export interface IReport extends Document {
  reportNumber: string;
  targetType: ReportTargetType;
  targetId: string;
  reporterId?: mongoose.Types.ObjectId;
  reporterDetails?: {
    name: string;
    handle: string;
    mitraId?: string;
    email?: string;
  };
  reportedUserId?: mongoose.Types.ObjectId;
  reportedUserDetails?: {
    name: string;
    handle: string;
    mitraId?: string;
    avatar?: string;
  };
  severity: ReportSeverity;
  category: string;
  reason?: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportSchema = new Schema<IReport>(
  {
    reportNumber: { type: String, required: true, unique: true },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'profile', 'message', 'call', 'story'],
      required: true,
    },
    targetId: { type: String, required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User' },
    reporterDetails: {
      name: { type: String, default: '' },
      handle: { type: String, default: '' },
      mitraId: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reportedUserDetails: {
      name: { type: String, default: '' },
      handle: { type: String, default: '' },
      mitraId: { type: String, default: '' },
      avatar: { type: String, default: '' },
    },
    severity: {
      type: String,
      enum: ['red', 'orange', 'yellow', 'blue', 'grey'],
      default: 'yellow',
    },
    category: { type: String, required: true },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'hidden_pending_review', 'escalated', 'resolved', 'dismissed', 'appealed'],
      default: 'pending',
    },
  },
  { collection: 'reports', timestamps: true }
);

export const ReportModel: mongoose.Model<IReport> =
  (mongoose.models.Report as mongoose.Model<IReport>) || mongoose.model<IReport>('Report', ReportSchema);

export default ReportModel;

