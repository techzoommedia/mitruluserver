import { Request, Response } from 'express';
import { groupMessageService } from '../services/group-message.service';

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

      const messages = await groupMessageService.getMessages(groupId, limit, before);

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
}

export const groupMessageController = new GroupMessageController();

