"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGroupController = exports.AdminGroupController = void 0;
const group_message_service_1 = require("../services/group-message.service");
const group_message_repository_1 = require("../repositories/group-message.repository");
class AdminGroupController {
    /**
     * List all chat groups with analytics
     */
    async getGroups(_req, res) {
        try {
            const groups = await group_message_service_1.groupMessageService.getAllGroupsAdmin();
            res.json({ success: true, groups });
        }
        catch (err) {
            console.error('[AdminGroupController getGroups error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to fetch groups' });
        }
    }
    /**
     * Create a new chat group
     */
    async createGroup(req, res) {
        try {
            const { id, name, teluguName, description, avatar, category, isPublic, rules, customMemberCount } = req.body;
            if (!id || !name || !teluguName) {
                res.status(400).json({ success: false, error: 'Group ID, English name, and Telugu name are required' });
                return;
            }
            const created = await group_message_service_1.groupMessageService.createGroup({
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
        }
        catch (err) {
            console.error('[AdminGroupController createGroup error]:', err);
            res.status(400).json({ success: false, error: err.message || 'Failed to create group' });
        }
    }
    /**
     * Update an existing chat group
     */
    async updateGroup(req, res) {
        try {
            const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
            if (!groupId) {
                res.status(400).json({ success: false, error: 'groupId is required' });
                return;
            }
            const { action, targetUserId } = req.body || {};
            if (action === 'promote_admin') {
                const updated = await group_message_service_1.groupMessageService.promoteAdmin(groupId, targetUserId);
                res.json({ success: true, group: updated });
                return;
            }
            if (action === 'remove_admin') {
                const updated = await group_message_service_1.groupMessageService.removeAdmin(groupId, targetUserId);
                res.json({ success: true, group: updated });
                return;
            }
            const updated = await group_message_service_1.groupMessageService.updateGroup(groupId, req.body);
            res.json({ success: true, group: updated });
        }
        catch (err) {
            console.error('[AdminGroupController updateGroup error]:', err);
            res.status(400).json({ success: false, error: err.message || 'Failed to update group' });
        }
    }
    /**
     * Promote a user to group admin
     */
    async promoteAdmin(req, res) {
        try {
            const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
            const targetUserId = req.body.targetUserId || req.body.userId || req.body.identifier;
            if (!groupId || !targetUserId) {
                res.status(400).json({ success: false, error: 'groupId and targetUserId are required' });
                return;
            }
            const updated = await group_message_service_1.groupMessageService.promoteAdmin(groupId, targetUserId);
            res.json({ success: true, group: updated });
        }
        catch (err) {
            res.status(400).json({ success: false, error: err.message || 'Failed to promote group admin' });
        }
    }
    /**
     * Remove a user from group admins
     */
    async removeAdmin(req, res) {
        try {
            const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
            const targetUserId = req.params.userId || req.body.targetUserId || req.body.userId;
            if (!groupId || !targetUserId) {
                res.status(400).json({ success: false, error: 'groupId and userId are required' });
                return;
            }
            const updated = await group_message_service_1.groupMessageService.removeAdmin(groupId, targetUserId);
            res.json({ success: true, group: updated });
        }
        catch (err) {
            res.status(400).json({ success: false, error: err.message || 'Failed to remove group admin' });
        }
    }
    /**
     * Toggle temporary hold on a group (pause / resume)
     */
    async toggleHold(req, res) {
        try {
            const groupId = (req.params.groupId || req.body.groupId || '').toLowerCase().trim();
            const { isHold, holdReason } = req.body;
            if (!groupId) {
                res.status(400).json({ success: false, error: 'groupId is required' });
                return;
            }
            const adminActor = req.user?.name || req.user?.email || 'SuperAdmin';
            const updated = await group_message_service_1.groupMessageService.toggleGroupHold(groupId, Boolean(isHold), holdReason, adminActor);
            res.json({
                success: true,
                isHold: updated.isHold,
                holdReason: updated.holdReason,
                group: updated,
            });
        }
        catch (err) {
            console.error('[AdminGroupController toggleHold error]:', err);
            res.status(400).json({ success: false, error: err.message || 'Failed to toggle group hold' });
        }
    }
    /**
     * Delete a chat group (except default telugu)
     */
    async deleteGroup(req, res) {
        try {
            const groupId = (req.params.groupId || req.query.groupId || '').toString().toLowerCase().trim();
            if (!groupId) {
                res.status(400).json({ success: false, error: 'groupId is required' });
                return;
            }
            await group_message_service_1.groupMessageService.deleteGroup(groupId);
            res.json({ success: true, message: `Group "${groupId}" has been removed.` });
        }
        catch (err) {
            console.error('[AdminGroupController deleteGroup error]:', err);
            res.status(400).json({ success: false, error: err.message || 'Failed to delete group' });
        }
    }
    /**
     * Get messages for moderation inspection
     */
    async getGroupMessages(req, res) {
        try {
            const groupId = (req.params.groupId || req.query.groupId || 'telugu').toString().toLowerCase().trim();
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 10), 100);
            const messages = await group_message_service_1.groupMessageService.getMessages(groupId, limit);
            res.json({ success: true, groupId, messages });
        }
        catch (err) {
            console.error('[AdminGroupController getGroupMessages error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to fetch group messages' });
        }
    }
    /**
     * Delete an individual message from a group
     */
    async deleteSingleMessage(req, res) {
        try {
            const messageId = (req.params.messageId || req.query.messageId || '').toString().trim();
            if (!messageId) {
                res.status(400).json({ success: false, error: 'messageId is required' });
                return;
            }
            const deletedCount = await group_message_repository_1.groupMessageRepository.deleteMessageById(messageId);
            res.json({ success: true, deletedCount, message: 'Message removed from group' });
        }
        catch (err) {
            console.error('[AdminGroupController deleteSingleMessage error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to delete message' });
        }
    }
    /**
     * Clear all messages in a group
     */
    async clearMessages(req, res) {
        try {
            const groupId = (req.params.groupId || req.body.groupId || '').toString().toLowerCase().trim();
            if (!groupId) {
                res.status(400).json({ success: false, error: 'groupId is required' });
                return;
            }
            const count = await group_message_service_1.groupMessageService.clearGroupMessages(groupId);
            res.json({ success: true, clearedCount: count, message: `Cleared ${count} messages in ${groupId}` });
        }
        catch (err) {
            console.error('[AdminGroupController clearMessages error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to clear group messages' });
        }
    }
}
exports.AdminGroupController = AdminGroupController;
exports.adminGroupController = new AdminGroupController();
