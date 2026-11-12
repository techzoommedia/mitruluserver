import { Request, Response } from 'express';
import { groupMessageService } from '../services/group-message.service';
import { getAuthUserId } from './message.controller';

export class GroupMessageController {
  async getGroups(_req: Request, res: Response): Promise<void> {
    try {
      const groups = await groupMessageService.getGroups();
      res.status(200).json({
        success: true,
        groups,
      });
    } catch (err: any) {
      console.error('[GroupMessageController getGroups error]:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch groups',
      });
    }
  }

  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || (req.query.groupId as string) || 'telugu').toLowerCase();
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 5), 100);
      const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
      const viewerId = getAuthUserId(req) || undefined;

      const messages = await groupMessageService.getMessages(groupId, limit, before, viewerId);

      res.status(200).json({
        success: true,
        groupId,
        messages,
      });
    } catch (err: any) {
      console.error('[GroupMessageController getMessages error]:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch group messages',
      });
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || 'telugu').toLowerCase();
      const { text, senderId, senderName, senderAvatar, senderHandle, senderTeluguName, mediaUrl, mediaType, id, timestamp } = req.body;

      if (!text && !mediaUrl) {
        res.status(400).json({ success: false, error: 'Text or media is required' });
        return;
      }

      if (!senderId) {
        res.status(400).json({ success: false, error: 'senderId is required' });
        return;
      }

      const message = await groupMessageService.sendGroupMessage({
        id,
        groupId,
        senderId,
        senderName: senderName || 'Mitrulu Member',
        senderAvatar,
        senderHandle,
        senderTeluguName,
        text: text || '',
        mediaUrl,
        mediaType,
        timestamp,
      });

      res.status(201).json({
        success: true,
        message,
      });
    } catch (err: any) {
      console.error('[GroupMessageController sendMessage error]:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to send group message',
      });
    }
  }

  async editMessage(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req) || req.body?.senderId;
      if (!myId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const messageId = req.params.messageId || req.body?.messageId;
      const { text } = req.body || {};
      if (!messageId || !text?.trim()) {
        res.status(400).json({ success: false, error: 'messageId and text are required' });
        return;
      }

      const message = await groupMessageService.editGroupMessage(String(myId), messageId, text);
      res.json({ success: true, message });
    } catch (err: any) {
      console.error('[GroupMessageController editMessage error]:', err);
      const status =
        err.message?.startsWith('Forbidden') ? 403 :
        err.message === 'Message not found' ? 404 : 500;
      res.status(status).json({ success: false, error: err.message || 'Failed to edit message' });
    }
  }

  async deleteSingleMessage(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req) || (req.query.userId as string) || req.body?.userId;
      if (!myId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const messageId = req.params.messageId || req.body?.messageId;
      if (!messageId) {
        res.status(400).json({ success: false, error: 'messageId is required' });
        return;
      }

      const mode = String(req.query.mode || req.body?.mode || 'for_me').toLowerCase();
      if (mode === 'unsend' || mode === 'both') {
        const result = await groupMessageService.unsendGroupMessage(String(myId), messageId);
        res.json(result);
        return;
      }

      const result = await groupMessageService.deleteGroupMessageForMe(String(myId), messageId);
      res.json(result);
    } catch (err: any) {
      console.error('[GroupMessageController deleteSingleMessage error]:', err);
      const status =
        err.message?.startsWith('Forbidden') ? 403 :
        err.message === 'Message not found' ? 404 : 500;
      res.status(status).json({ success: false, error: err.message || 'Failed to delete message' });
    }
  }

  async unsendMessage(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req) || req.body?.userId;
      if (!myId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const messageId = req.params.messageId || req.body?.messageId;
      if (!messageId) {
        res.status(400).json({ success: false, error: 'messageId is required' });
        return;
      }

      const result = await groupMessageService.unsendGroupMessage(String(myId), messageId);
      res.json(result);
    } catch (err: any) {
      console.error('[GroupMessageController unsendMessage error]:', err);
      const status =
        err.message?.startsWith('Forbidden') ? 403 :
        err.message === 'Message not found' ? 404 : 500;
      res.status(status).json({ success: false, error: err.message || 'Failed to unsend message' });
    }
  }

  async deleteMessageForMe(req: Request, res: Response): Promise<void> {
    try {
      const myId = getAuthUserId(req) || req.body?.userId;
      if (!myId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const messageId = req.params.messageId || req.body?.messageId;
      if (!messageId) {
        res.status(400).json({ success: false, error: 'messageId is required' });
        return;
      }

      const result = await groupMessageService.deleteGroupMessageForMe(String(myId), messageId);
      res.json(result);
    } catch (err: any) {
      console.error('[GroupMessageController deleteMessageForMe error]:', err);
      const status =
        err.message?.startsWith('Forbidden') ? 403 :
        err.message === 'Message not found' ? 404 : 500;
      res.status(status).json({ success: false, error: err.message || 'Failed to delete message for me' });
    }
  }
}

export const groupMessageController = new GroupMessageController();

