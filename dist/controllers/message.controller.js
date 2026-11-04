"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageController = exports.MessageController = void 0;
exports.getAuthUserId = getAuthUserId;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const message_service_1 = require("../services/message.service");
function getAuthUserId(req) {
    const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
            return String(decoded.userId || decoded.id || '');
        }
        catch {
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
class MessageController {
    async getMessages(req, res) {
        try {
            const myId = getAuthUserId(req);
            if (!myId) {
                res.status(401).json({ error: 'Unauthorized: Authentication required' });
                return;
            }
            const partnerId = req.query.partnerId;
            if (!partnerId) {
                res.status(400).json({ error: 'partnerId is required' });
                return;
            }
            const limit = parseInt(req.query.limit, 10) || 30;
            const before = req.query.before ? parseInt(req.query.before, 10) : undefined;
            const result = await message_service_1.messageService.getMessages(myId, partnerId, limit, before);
            res.json(result);
        }
        catch (error) {
            console.error('[MessageController.getMessages error]:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch messages' });
        }
    }
    async sendMessage(req, res) {
        try {
            const authId = getAuthUserId(req);
            const senderId = authId || req.body.senderId;
            if (!senderId) {
                res.status(401).json({ error: 'Unauthorized: Authentication required' });
                return;
            }
            const { id, targetUserId, text, senderName, senderAvatar, senderHandle, senderTeluguName, targetUserName, targetUserAvatar, targetUserHandle, targetUserTeluguName, mediaUrl, mediaType, audioDuration, timestamp, status, } = req.body;
            if (!targetUserId || !text?.trim()) {
                res.status(400).json({ error: 'targetUserId and text are required' });
                return;
            }
            const message = await message_service_1.messageService.sendMessage({
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
        }
        catch (error) {
            console.error('[MessageController.sendMessage error]:', error);
            res.status(500).json({ error: error.message || 'Failed to send message' });
        }
    }
    async getConversations(req, res) {
        try {
            const myId = getAuthUserId(req);
            if (!myId) {
                res.status(401).json({ error: 'Unauthorized: Authentication required' });
                return;
            }
            const conversations = await message_service_1.messageService.getConversations(myId);
            res.json({ success: true, conversations });
        }
        catch (error) {
            console.error('[MessageController.getConversations error]:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch conversations' });
        }
    }
    async updateStatus(req, res) {
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
            const result = await message_service_1.messageService.updateStatus(myId, partnerId, status, messageId);
            res.json(result);
        }
        catch (error) {
            console.error('[MessageController.updateStatus error]:', error);
            res.status(500).json({ error: error.message || 'Failed to update message status' });
        }
    }
    async deleteConversation(req, res) {
        try {
            const myId = getAuthUserId(req);
            if (!myId) {
                res.status(401).json({ error: 'Unauthorized: Authentication required' });
                return;
            }
            const partnerId = req.query.partnerId;
            if (!partnerId) {
                res.status(400).json({ error: 'partnerId is required' });
                return;
            }
            const result = await message_service_1.messageService.deleteConversation(myId, partnerId);
            res.json(result);
        }
        catch (error) {
            console.error('[MessageController.deleteConversation error]:', error);
            res.status(500).json({ error: error.message || 'Failed to delete conversation' });
        }
    }
}
exports.MessageController = MessageController;
exports.messageController = new MessageController();
