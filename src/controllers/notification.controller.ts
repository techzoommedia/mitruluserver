import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import NotificationModel from '../models/notification.model';
import UserModel from '../models/user.model';
import { socketManager } from '../sockets/socket.manager';
import {
  markPushDispatchedForMessage,
  resolveRecipientUser,
  sendPushToUser,
} from '../services/push.service';

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
      const { targetUserId, title, teluguTitle, body, teluguBody, message, link, data } = req.body || {};
      if (!targetUserId) {
        res.status(400).json({ success: false, error: 'targetUserId is required' });
        return;
      }

      const recipient = await resolveRecipientUser(String(targetUserId));
      if (!recipient?._id) {
        res.json({ success: true, deliveredCount: 0, reason: 'user_not_found' });
        return;
      }

      const recipientOid = new mongoose.Types.ObjectId(String(recipient._id));
      const actorIdStr = req.userId || message?.senderId;
      const actorOid =
        actorIdStr && mongoose.Types.ObjectId.isValid(String(actorIdStr))
          ? new mongoose.Types.ObjectId(String(actorIdStr))
          : undefined;

      const messageId = message?.id ? String(message.id) : undefined;
      const senderName = message?.senderName || 'Mitrudu';
      const senderTeluguName = message?.senderTeluguName || senderName;
      const senderHandle = message?.senderHandle || '';
      const senderAvatar = message?.senderAvatar || '';

      const rawBody = String(body || message?.text || 'You received a new message');
      const shortBody = rawBody.length > 80 ? `${rawBody.slice(0, 77)}...` : rawBody;
      const resolvedTitle = title || (message?.senderName ? `💬 ${senderName}` : 'New Message');
      const resolvedTeluguTitle =
        teluguTitle || (senderTeluguName ? `${senderTeluguName} నుండి సందేశం` : resolvedTitle);
      const resolvedLink =
        link ||
        (senderHandle || actorIdStr
          ? `/messages?user=${encodeURIComponent(String(senderHandle || actorIdStr))}`
          : '/messages');

      // Avoid duplicating DB & socket notification if MessageService already created one for this messageId
      let alreadySaved = false;
      if (messageId) {
        const existing = await NotificationModel.findOne({
          recipient: recipientOid,
          'data.messageId': messageId,
        })
          .select('_id')
          .lean();
        alreadySaved = Boolean(existing);
      }

      if (!alreadySaved) {
        const notif = await NotificationModel.create({
          recipient: recipientOid,
          actor: actorOid,
          type: 'message',
          title: resolvedTitle,
          teluguTitle: resolvedTeluguTitle,
          body: shortBody,
          teluguBody: teluguBody || shortBody,
          data: {
            ...(data || {}),
            ...(messageId ? { messageId } : {}),
            ...(actorIdStr ? { senderId: String(actorIdStr) } : {}),
            ...(senderHandle ? { senderHandle } : {}),
          },
          link: resolvedLink,
          isRead: false,
        });

        socketManager.emitToUser(String(recipientOid), 'notification:new', {
          notification: {
            id: notif._id.toString(),
            type: 'message',
            title: notif.title,
            teluguTitle: notif.teluguTitle,
            body: notif.body,
            teluguBody: notif.teluguBody,
            actor: actorIdStr
              ? {
                  id: String(actorIdStr),
                  name: senderName,
                  teluguName: senderTeluguName,
                  handle: senderHandle,
                  avatar: senderAvatar,
                }
              : undefined,
            link: notif.link,
            createdAt: notif.createdAt,
            isRead: false,
          },
        });
      }

      let deliveredCount = 0;
      if (!markPushDispatchedForMessage(messageId)) {
        const pushRes = await sendPushToUser(String(recipientOid), {
          type: 'message',
          title: resolvedTitle,
          body: shortBody,
          image: senderAvatar || undefined,
          link: resolvedLink,
          tag: `mitrulu-dm-${actorIdStr || recipientOid}`,
          priority: 'high',
          data: {
            type: 'message',
            action: 'direct_message',
            ...(messageId ? { messageId } : {}),
            ...(actorIdStr ? { senderId: String(actorIdStr) } : {}),
            senderName,
          },
        });
        deliveredCount = pushRes.deliveredCount;
      }

      res.json({ success: true, deliveredCount });
    } catch (err: any) {
      console.warn('[NotificationController.dispatchDmPush error]:', err?.message || err);
      res.json({ success: true, deliveredCount: 0 });
    }
  }
}

export const notificationController = new NotificationController();
export default notificationController;

