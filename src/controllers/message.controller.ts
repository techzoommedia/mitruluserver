import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { messageService } from '../services/message.service';

export function getAuthUserId(req: Request): string | null {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      return String(decoded.userId || decoded.id || '');
    } catch {
      // invalid token
    }
  }

  // Check header or query fallback for internal or client pairing
  const customHeader = req.headers['x-mitrulu-userid'];
  if (customHeader) {
    return String(customHeader);
  }

  return null;
}

export class MessageController {
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req);
      if (!myId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required' });
        return;
      }

      const partnerId = req.query.partnerId as string;
      if (!partnerId) {
        res.status(400).json({ error: 'partnerId is required' });
        return;
      }

      const limit = parseInt(req.query.limit as string, 10) || 30;
      const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

      const result = await messageService.getMessages(myId, partnerId, limit, before);
      res.json(result);
    } catch (error: any) {
      console.error('[MessageController.getMessages error]:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch messages' });
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const authId = getAuthUserId(req);
      const senderId = authId || req.body.senderId;

      if (!senderId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required' });
        return;
      }

      const {
        id,
        targetUserId,
        text,
        senderName,
        senderAvatar,
        senderHandle,
        senderTeluguName,
        targetUserName,
        targetUserAvatar,
        targetUserHandle,
        targetUserTeluguName,
        mediaUrl,
        mediaType,
        audioDuration,
        timestamp,
        status,
      } = req.body;

      if (!targetUserId || !text?.trim()) {
        res.status(400).json({ error: 'targetUserId and text are required' });
        return;
      }

      const message = await messageService.sendMessage({
        id,
        senderId,
        senderName,
        senderAvatar,
        senderHandle,
        senderTeluguName,
        targetUserId,
        targetUserName,
        targetUserAvatar,
        targetUserHandle,
        targetUserTeluguName,
        text,
        mediaUrl,
        mediaType,
        audioDuration,
        timestamp,
        status,
      });

      res.json({ success: true, message });
    } catch (error: any) {
      console.error('[MessageController.sendMessage error]:', error);
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  }

  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req);
      if (!myId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required' });
        return;
      }

      const conversations = await messageService.getConversations(myId);
      res.json({ success: true, conversations });
    } catch (error: any) {
      console.error('[MessageController.getConversations error]:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch conversations' });
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req);
      if (!myId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required' });
        return;
      }

      const { partnerId, status, messageId } = req.body;
      if (!partnerId || !status || !['delivered', 'seen'].includes(status)) {
        res.status(400).json({ error: 'partnerId and valid status (delivered|seen) are required' });
        return;
      }

      const result = await messageService.updateStatus(myId, partnerId, status, messageId);
      res.json(result);
    } catch (error: any) {
      console.error('[MessageController.updateStatus error]:', error);
      res.status(500).json({ error: error.message || 'Failed to update message status' });
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req);
      if (!myId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required' });
        return;
      }

      const partnerId = req.query.partnerId as string;
      if (!partnerId) {
        res.status(400).json({ error: 'partnerId is required' });
        return;
      }

      const result = await messageService.deleteConversation(myId, partnerId);
      res.json(result);
    } catch (error: any) {
      console.error('[MessageController.deleteConversation error]:', error);
      res.status(500).json({ error: error.message || 'Failed to delete conversation' });
    }
  }
}

export const messageController = new MessageController();

