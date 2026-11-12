"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
class NotificationController {
    async getNotifications(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId) {
                res.json({ success: true, notifications: [], unreadCount: 0 });
                return;
            }
            const notifications = await notification_model_1.default.find({
                recipient: new mongoose_1.default.Types.ObjectId(currentUserId),
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
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
        }
    }
    async markAsRead(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { notificationId } = req.body;
            if (notificationId) {
                await notification_model_1.default.findByIdAndUpdate(notificationId, { isRead: true });
            }
            else {
                await notification_model_1.default.updateMany({ recipient: new mongoose_1.default.Types.ObjectId(currentUserId), isRead: false }, { isRead: true });
            }
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async saveFcmToken(req, res) {
        try {
            const currentUserId = req.userId;
            const { token, platform = 'web', deviceName } = req.body;
            if (!token) {
                res.status(400).json({ error: 'Token is required' });
                return;
            }
            if (currentUserId && mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
                await user_model_1.default.findByIdAndUpdate(currentUserId, {
                    $pull: { fcmTokens: { token } },
                });
                await user_model_1.default.findByIdAndUpdate(currentUserId, {
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async dispatchDmPush(req, res) {
        try {
            const { targetUserId, title, body } = req.body;
            // Socket manager already relays in-app, this records background notification
            if (targetUserId && mongoose_1.default.Types.ObjectId.isValid(targetUserId)) {
                await notification_model_1.default.create({
                    recipient: new mongoose_1.default.Types.ObjectId(targetUserId),
                    actor: req.userId && mongoose_1.default.Types.ObjectId.isValid(req.userId) ? new mongoose_1.default.Types.ObjectId(req.userId) : undefined,
                    type: 'message',
                    title: title || 'New Message',
                    body: body || 'You received a new message',
                    isRead: false,
                });
            }
            res.json({ success: true });
        }
        catch {
            res.json({ success: true });
        }
    }
}
exports.NotificationController = NotificationController;
exports.notificationController = new NotificationController();
exports.default = exports.notificationController;
