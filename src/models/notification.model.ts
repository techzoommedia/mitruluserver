import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'friend_request'
  | 'message'
  | 'call'
  | 'follow'
  | 'system';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  actor?: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  teluguTitle?: string;
  body: string;
  teluguBody?: string;
  data?: Record<string, any>;
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'friend_request', 'message', 'call', 'follow', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    teluguTitle: { type: String, default: '' },
    body: { type: String, required: true },
    teluguBody: { type: String, default: '' },
    data: { type: Schema.Types.Mixed, default: {} },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false, index: true },
  },
  { collection: 'notifications', timestamps: true }
);

export const NotificationModel: mongoose.Model<INotification> =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>('Notification', NotificationSchema);

export default NotificationModel;

