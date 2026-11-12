"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupMessageController = exports.GroupMessageController = void 0;
const group_message_service_1 = require("../services/group-message.service");
const message_controller_1 = require("./message.controller");
class GroupMessageController {
    async getGroups(_req, res) {
        try {
            const groups = await group_message_service_1.groupMessageService.getGroups();
            res.status(200).json({
                success: true,
                groups,
            });
        }
        catch (err) {
            console.error('[GroupMessageController getGroups error]:', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Failed to fetch groups',
            });
        }
    }
    async getMessages(req, res) {
        try {
            const groupId = (req.params.groupId || req.query.groupId || 'telugu').toLowerCase();
            const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 5), 100);
            const before = req.query.before ? parseInt(req.query.before, 10) : undefined;
            const viewerId = (0, message_controller_1.getAuthUserId)(req) || undefined;
            const messages = await group_message_service_1.groupMessageService.getMessages(groupId, limit, before, viewerId);
            res.status(200).json({
                success: true,
                groupId,
                messages,
            });
        }
        catch (err) {
            console.error('[GroupMessageController getMessages error]:', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Failed to fetch group messages',
            });
        }
    }
    async sendMessage(req, res) {
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
            const message = await group_message_service_1.groupMessageService.sendGroupMessage({
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
        }
        catch (err) {
            console.error('[GroupMessageController sendMessage error]:', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Failed to send group message',
            });
        }
    }
    async editMessage(req, res) {
        try {
            const myId = (0, message_controller_1.getAuthUserId)(req) || req.body?.senderId;
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
            const message = await group_message_service_1.groupMessageService.editGroupMessage(String(myId), messageId, text);
            res.json({ success: true, message });
        }
        catch (err) {
            console.error('[GroupMessageController editMessage error]:', err);
            const status = err.message?.startsWith('Forbidden') ? 403 :
                err.message === 'Message not found' ? 404 : 500;
            res.status(status).json({ success: false, error: err.message || 'Failed to edit message' });
        }
    }
    async deleteSingleMessage(req, res) {
        try {
            const myId = (0, message_controller_1.getAuthUserId)(req) || req.query.userId || req.body?.userId;
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
                const result = await group_message_service_1.groupMessageService.unsendGroupMessage(String(myId), messageId);
                res.json(result);
                return;
            }
            const result = await group_message_service_1.groupMessageService.deleteGroupMessageForMe(String(myId), messageId);
            res.json(result);
        }
        catch (err) {
            console.error('[GroupMessageController deleteSingleMessage error]:', err);
            const status = err.message?.startsWith('Forbidden') ? 403 :
                err.message === 'Message not found' ? 404 : 500;
            res.status(status).json({ success: false, error: err.message || 'Failed to delete message' });
        }
    }
    async unsendMessage(req, res) {
        try {
            const myId = (0, message_controller_1.getAuthUserId)(req) || req.body?.userId;
            if (!myId) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            const messageId = req.params.messageId || req.body?.messageId;
            if (!messageId) {
                res.status(400).json({ success: false, error: 'messageId is required' });
                return;
            }
            const result = await group_message_service_1.groupMessageService.unsendGroupMessage(String(myId), messageId);
            res.json(result);
        }
        catch (err) {
            console.error('[GroupMessageController unsendMessage error]:', err);
            const status = err.message?.startsWith('Forbidden') ? 403 :
                err.message === 'Message not found' ? 404 : 500;
            res.status(status).json({ success: false, error: err.message || 'Failed to unsend message' });
        }
    }
    async deleteMessageForMe(req, res) {
        try {
            const myId = (0, message_controller_1.getAuthUserId)(req) || req.body?.userId;
            if (!myId) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            const messageId = req.params.messageId || req.body?.messageId;
            if (!messageId) {
                res.status(400).json({ success: false, error: 'messageId is required' });
                return;
            }
            const result = await group_message_service_1.groupMessageService.deleteGroupMessageForMe(String(myId), messageId);
            res.json(result);
        }
        catch (err) {
            console.error('[GroupMessageController deleteMessageForMe error]:', err);
            const status = err.message?.startsWith('Forbidden') ? 403 :
                err.message === 'Message not found' ? 404 : 500;
            res.status(status).json({ success: false, error: err.message || 'Failed to delete message for me' });
        }
    }
}
exports.GroupMessageController = GroupMessageController;
exports.groupMessageController = new GroupMessageController();
