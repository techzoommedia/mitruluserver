import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import NotificationModel from '../models/notification.model';
import UserModel from '../models/user.model';

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.json({ success: true, notifications: [], unreadCount: 0 });
        return;
      }

      const notifications: any[] = await NotificationModel.find({
        recipient: new mongoose.Types.ObjectId(currentUserId),
      })
        .populate('actor', 'name teluguName handle avatar isVerified')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const formatted = notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        teluguTitle: n.teluguTitle,
        body: n.body,
        teluguBody: n.teluguBody,
        actor: n.actor
          ? {
              id: n.actor._id.toString(),
              name: n.actor.name,
              teluguName: n.actor.teluguName,
              handle: n.actor.mitraId || n.actor.handle,
              avatar: n.actor.avatar,
            }
          : undefined,
        data: n.data,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt,
      }));

      const unreadCount = formatted.filter((n) => !n.isRead).length;
      res.json({ success: true, notifications: formatted, unreadCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { notificationId } = req.body;
      if (notificationId) {
        await NotificationModel.findByIdAndUpdate(notificationId, { isRead: true });
      } else {
        await NotificationModel.updateMany(
          { recipient: new mongoose.Types.ObjectId(currentUserId), isRead: false },
          { isRead: true }
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveFcmToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      const { token, platform = 'web', deviceName } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        await UserModel.findByIdAndUpdate(currentUserId, {
          $pull: { fcmTokens: { token } },
        });

        await UserModel.findByIdAndUpdate(currentUserId, {
          $push: {
            fcmTokens: {
              token,
              platform,
              deviceName,
              updatedAt: new Date(),
            },
          },
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async dispatchDmPush(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetUserId, title, body } = req.body;
      // Socket manager already relays in-app, this records background notification
      if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
        await NotificationModel.create({
          recipient: new mongoose.Types.ObjectId(targetUserId),
          actor: req.userId && mongoose.Types.ObjectId.isValid(req.userId) ? new mongoose.Types.ObjectId(req.userId) : undefined,
          type: 'message',
          title: title || 'New Message',
          body: body || 'You received a new message',
          isRead: false,
        });
      }
      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  }
}

export const notificationController = new NotificationController();
export default notificationController;

