import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { groupMessageService } from '../services/group-message.service';
import { groupMessageRepository } from '../repositories/group-message.repository';

export class AdminGroupController {
  /**
   * List all chat groups with analytics
   */
  async getGroups(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groups = await groupMessageService.getAllGroupsAdmin();
      res.json({ success: true, groups });
    } catch (err: any) {
      console.error('[AdminGroupController getGroups error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch groups' });
    }
  }

  /**
   * Create a new chat group
   */
  async createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, name, teluguName, description, avatar, category, isPublic, rules, customMemberCount } = req.body;

      if (!id || !name || !teluguName) {
        res.status(400).json({ success: false, error: 'Group ID, English name, and Telugu name are required' });
        return;
      }

      const created = await groupMessageService.createGroup({
        id,
        name,
        teluguName,
        description,
        avatar,
        category,
        isPublic,
        rules,
        customMemberCount,
      });

      res.status(201).json({ success: true, group: created });
    } catch (err: any) {
      console.error('[AdminGroupController createGroup error]:', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to create group' });
    }
  }

  /**
   * Update an existing chat group
   */
  async updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required' });
        return;
      }

      const { action, targetUserId } = req.body || {};
      if (action === 'promote_admin') {
        const updated = await groupMessageService.promoteAdmin(groupId, targetUserId);
        res.json({ success: true, group: updated });
        return;
      }
      if (action === 'remove_admin') {
        const updated = await groupMessageService.removeAdmin(groupId, targetUserId);
        res.json({ success: true, group: updated });
        return;
      }

      const updated = await groupMessageService.updateGroup(groupId, req.body);
      res.json({ success: true, group: updated });
    } catch (err: any) {
      console.error('[AdminGroupController updateGroup error]:', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to update group' });
    }
  }

  /**
   * Promote a user to group admin
   */
  async promoteAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
      const targetUserId = req.body.targetUserId || req.body.userId || req.body.identifier;
      if (!groupId || !targetUserId) {
        res.status(400).json({ success: false, error: 'groupId and targetUserId are required' });
        return;
      }
      const updated = await groupMessageService.promoteAdmin(groupId, targetUserId);
      res.json({ success: true, group: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to promote group admin' });
    }
  }

  /**
   * Remove a user from group admins
   */
  async removeAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
      const targetUserId = req.params.userId || req.body.targetUserId || req.body.userId;
      if (!groupId || !targetUserId) {
        res.status(400).json({ success: false, error: 'groupId and userId are required' });
        return;
      }
      const updated = await groupMessageService.removeAdmin(groupId, targetUserId);
      res.json({ success: true, group: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to remove group admin' });
    }
  }

  /**
   * Toggle temporary hold on a group (pause / resume)
   */
  async toggleHold(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
      const { isHold, holdReason } = req.body;

      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required' });
        return;
      }

      const adminActor = req.user?.name || req.user?.email || 'SuperAdmin';
      const updated = await groupMessageService.toggleGroupHold(
        groupId,
        Boolean(isHold),
        holdReason,
        adminActor
      );

      res.json({
        success: true,
        isHold: updated.isHold,
        holdReason: updated.holdReason,
        group: updated,
      });
    } catch (err: any) {
      console.error('[AdminGroupController toggleHold error]:', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to toggle group hold' });
    }
  }

  /**
   * Delete a chat group (except default telugu)
   */
  async deleteGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.query.groupId || '').toString().toLowerCase().trim();
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required' });
        return;
      }

      await groupMessageService.deleteGroup(groupId);
      res.json({ success: true, message: `Group "${groupId}" has been removed.` });
    } catch (err: any) {
      console.error('[AdminGroupController deleteGroup error]:', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to delete group' });
    }
  }

  /**
   * Get messages for moderation inspection
   */
  async getGroupMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.query.groupId || 'telugu').toString().toLowerCase().trim();
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 10), 100);
      const messages = await groupMessageService.getMessages(groupId, limit);
      res.json({ success: true, groupId, messages });
    } catch (err: any) {
      console.error('[AdminGroupController getGroupMessages error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch group messages' });
    }
  }

  /**
   * Delete an individual message from a group
   */
  async deleteSingleMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const messageId = (req.params.messageId || req.query.messageId || '').toString().trim();
      if (!messageId) {
        res.status(400).json({ success: false, error: 'messageId is required' });
        return;
      }

      const deletedCount = await groupMessageRepository.deleteMessageById(messageId);
      res.json({ success: true, deletedCount, message: 'Message removed from group' });
    } catch (err: any) {
      console.error('[AdminGroupController deleteSingleMessage error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to delete message' });
    }
  }

  /**
   * Clear all messages in a group
   */
  async clearMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const groupId = (req.params.groupId || req.body.groupId || '').toString().toLowerCase().trim();
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required' });
        return;
      }

      const count = await groupMessageService.clearGroupMessages(groupId);
      res.json({ success: true, clearedCount: count, message: `Cleared ${count} messages in ${groupId}` });
    } catch (err: any) {
      console.error('[AdminGroupController clearMessages error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to clear group messages' });
    }
  }
}

export const adminGroupController = new AdminGroupController();

