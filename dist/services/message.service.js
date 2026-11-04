"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageService = exports.MessageService = void 0;
const message_repository_1 = require("../repositories/message.repository");
const message_model_1 = require("../models/message.model");
const user_model_1 = require("../models/user.model");
const socket_manager_1 = require("../sockets/socket.manager");
class MessageService {
    /**
     * Resolve any user identifier (MongoDB _id, handle, mitraId) into a canonical DB User
     */
    async resolveUser(identifier) {
        if (!identifier)
            return null;
        const clean = identifier.replace(/^@/, '').trim();
        const isObjectId = clean.match(/^[0-9a-fA-F]{24}$/);
        const conditions = [];
        if (isObjectId)
            conditions.push({ _id: clean });
        conditions.push({ mitraId: new RegExp(`^${clean}$`, 'i') });
        conditions.push({ handle: new RegExp(`^${clean}$`, 'i') });
        return user_model_1.UserModel.findOne({ $or: conditions }).lean().exec();
    }
    /**
     * Send and persist a new message with real-time socket transmission and ACK
     */
    async sendMessage(data, senderSocketId) {
        const { senderId, targetUserId, text } = data;
        if (!senderId || !targetUserId || !text?.trim()) {
            throw new Error('senderId, targetUserId, and text are required');
        }
        const cleanSenderId = String(senderId).trim();
        const cleanTargetId = String(targetUserId).trim();
        // Parallel fetch sender & target user records from DB for rich, authentic profile data
        const [dbSender, dbTarget] = await Promise.all([
            this.resolveUser(cleanSenderId),
            this.resolveUser(cleanTargetId),
        ]);
        const canonicalSenderId = dbSender ? String(dbSender._id) : cleanSenderId;
        const canonicalTargetId = dbTarget ? String(dbTarget._id) : cleanTargetId;
        const senderName = data.senderName || dbSender?.name || 'Mitrudu';
        const senderTeluguName = data.senderTeluguName || dbSender?.teluguName || senderName;
        const senderAvatar = data.senderAvatar || dbSender?.avatar || '';
        const senderHandle = data.senderHandle || dbSender?.mitraId || dbSender?.handle || 'user';
        const targetName = data.targetUserName || dbTarget?.name || 'Friend';
        const targetTeluguName = data.targetUserTeluguName || dbTarget?.teluguName || targetName;
        const targetAvatar = data.targetUserAvatar || dbTarget?.avatar || '';
        const targetHandle = data.targetUserHandle || dbTarget?.mitraId || dbTarget?.handle || 'friend';
        const convKey = (0, message_model_1.buildConversationKey)(canonicalSenderId, canonicalTargetId);
        const messageId = data.id || `dm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
        // Check if target user is online in the socket network
        const onlineIds = socket_manager_1.socketManager.getOnlineUserIds();
        const isTargetOnline = onlineIds.includes(canonicalTargetId) ||
            onlineIds.includes(cleanTargetId) ||
            (dbTarget?.handle && onlineIds.includes(dbTarget.handle)) ||
            (dbTarget?.mitraId && onlineIds.includes(dbTarget.mitraId));
        const initialStatus = data.status || (isTargetOnline ? 'delivered' : 'sent');
        const messageToSave = {
            id: messageId,
            senderId: canonicalSenderId,
            senderName,
            senderAvatar,
            senderHandle,
            senderTeluguName,
            targetUserId: canonicalTargetId,
            targetUserName: targetName,
            targetUserAvatar: targetAvatar,
            targetUserHandle: targetHandle,
            targetUserTeluguName: targetTeluguName,
            text: String(text).trim(),
            mediaUrl: data.mediaUrl || '',
            mediaType: data.mediaType || undefined,
            audioDuration: typeof data.audioDuration === 'number' ? data.audioDuration : undefined,
            timestamp,
            status: initialStatus,
            conversationKey: convKey,
        };
        // 1. Guaranteed database persistence in MongoDB
        const saved = await message_repository_1.messageRepository.upsertMessage(messageToSave);
        const publicMessage = {
            id: saved.id,
            senderId: saved.senderId,
            senderName: saved.senderName,
            senderAvatar: saved.senderAvatar || '',
            senderHandle: saved.senderHandle || '',
            senderTeluguName: saved.senderTeluguName || '',
            targetUserId: saved.targetUserId,
            targetUserName: saved.targetUserName,
            targetUserAvatar: saved.targetUserAvatar || '',
            targetUserHandle: saved.targetUserHandle || '',
            targetUserTeluguName: saved.targetUserTeluguName || '',
            text: saved.text,
            mediaUrl: saved.mediaUrl || '',
            mediaType: saved.mediaType,
            audioDuration: saved.audioDuration,
            timestamp: saved.timestamp,
            status: saved.status,
        };
        // 2. Real-time 0ms delivery via Socket.io
        const payload = {
            targetUserId: canonicalTargetId,
            message: publicMessage,
        };
        // Emit to canonical target ID and alternative handles
        socket_manager_1.socketManager.emitToUser(canonicalTargetId, 'direct:message', payload);
        if (cleanTargetId !== canonicalTargetId) {
            socket_manager_1.socketManager.emitToUser(cleanTargetId, 'direct:message', payload);
        }
        if (dbTarget?.handle) {
            socket_manager_1.socketManager.emitToUser(dbTarget.handle, 'direct:message', payload);
        }
        if (dbTarget?.mitraId) {
            socket_manager_1.socketManager.emitToUser(dbTarget.mitraId, 'direct:message', payload);
        }
        // Echo to sender's other sockets (multi-tab / mobile + web synchronization)
        socket_manager_1.socketManager.emitToUser(canonicalSenderId, 'direct:message', payload, senderSocketId);
        if (cleanSenderId !== canonicalSenderId) {
            socket_manager_1.socketManager.emitToUser(cleanSenderId, 'direct:message', payload, senderSocketId);
        }
        // If target was online, also deliver status receipt to sender
        if (initialStatus === 'delivered') {
            socket_manager_1.socketManager.emitToUser(canonicalSenderId, 'direct:status', {
                targetUserId: canonicalSenderId,
                senderId: canonicalTargetId,
                messageId,
                status: 'delivered',
            });
        }
        return publicMessage;
    }
    /**
     * Get paginated messages between authenticated user and a partner
     */
    async getMessages(myId, partnerId, limit = 30, before) {
        const cleanMyId = String(myId).trim();
        const cleanPartnerId = String(partnerId).trim();
        const [dbSender, dbPartner] = await Promise.all([
            this.resolveUser(cleanMyId),
            this.resolveUser(cleanPartnerId),
        ]);
        const canonicalMyId = dbSender ? String(dbSender._id) : cleanMyId;
        const partnerCanonicalIds = new Set();
        partnerCanonicalIds.add(cleanPartnerId.toLowerCase());
        if (dbPartner) {
            partnerCanonicalIds.add(String(dbPartner._id).toLowerCase());
            if (dbPartner.mitraId)
                partnerCanonicalIds.add(dbPartner.mitraId.toLowerCase());
            if (dbPartner.handle)
                partnerCanonicalIds.add(dbPartner.handle.toLowerCase());
        }
        // Build all candidate conversation keys
        const conversationKeys = Array.from(partnerCanonicalIds).map((pid) => (0, message_model_1.buildConversationKey)(canonicalMyId, pid));
        const query = {
            $or: [
                { conversationKey: { $in: conversationKeys } },
                {
                    $and: [
                        { senderId: { $in: [canonicalMyId, ...Array.from(partnerCanonicalIds)] } },
                        { targetUserId: { $in: [canonicalMyId, ...Array.from(partnerCanonicalIds)] } },
                    ],
                },
            ],
        };
        const maxLimit = Math.min(Math.max(limit, 5), 100);
        const docs = await message_repository_1.messageRepository.findMessages(query, maxLimit + 1, before);
        const hasMore = docs.length > maxLimit;
        const paginatedDocs = hasMore ? docs.slice(0, maxLimit) : docs;
        // Return in chronological order (oldest to newest for chat UI)
        const messages = paginatedDocs.reverse().map((d) => ({
            id: d.id,
            senderId: d.senderId,
            senderName: d.senderName,
            senderAvatar: d.senderAvatar || '',
            senderHandle: d.senderHandle || '',
            senderTeluguName: d.senderTeluguName || '',
            targetUserId: d.targetUserId,
            targetUserName: d.targetUserName,
            targetUserAvatar: d.targetUserAvatar || '',
            targetUserHandle: d.targetUserHandle || '',
            targetUserTeluguName: d.targetUserTeluguName || '',
            text: d.text,
            mediaUrl: d.mediaUrl || '',
            mediaType: d.mediaType,
            audioDuration: d.audioDuration,
            timestamp: d.timestamp,
            status: d.status || 'sent',
        }));
        return {
            messages,
            hasMore,
            nextCursor: messages.length > 0 ? messages[0].timestamp : null,
        };
    }
    /**
     * Get all conversations for a user with unread counters and fresh profile data
     */
    async getConversations(myId) {
        const cleanMyId = String(myId).trim();
        const dbMe = await this.resolveUser(cleanMyId);
        const canonicalMyId = dbMe ? String(dbMe._id) : cleanMyId;
        const recentMessages = await message_repository_1.messageRepository.aggregateConversations(canonicalMyId);
        const partnerIdMap = new Map();
        const partnerIdsToFetch = [];
        for (const item of recentMessages) {
            const msg = item.lastMessage;
            const isMeSender = String(msg.senderId) === canonicalMyId;
            const partnerId = isMeSender ? String(msg.targetUserId) : String(msg.senderId);
            const partnerName = isMeSender ? msg.targetUserName : msg.senderName;
            const partnerAvatar = isMeSender ? msg.targetUserAvatar : msg.senderAvatar;
            const partnerHandle = isMeSender ? msg.targetUserHandle : msg.senderHandle;
            const partnerTeluguName = isMeSender ? msg.targetUserTeluguName : msg.senderTeluguName;
            partnerIdMap.set(item._id, {
                partnerId,
                fallbackUser: {
                    id: partnerId,
                    _id: partnerId,
                    name: partnerName,
                    teluguName: partnerTeluguName || partnerName,
                    handle: partnerHandle,
                    mitraId: partnerHandle,
                    avatar: partnerAvatar,
                },
                lastMessage: msg,
                unreadCount: item.unreadCount || 0,
            });
            if (partnerId.match(/^[0-9a-fA-F]{24}$/)) {
                partnerIdsToFetch.push(partnerId);
            }
        }
        if (partnerIdsToFetch.length > 0) {
            const dbUsers = await user_model_1.UserModel.find({ _id: { $in: partnerIdsToFetch } })
                .select('_id name teluguName handle mitraId avatar isVerified isOnline location lastSeen')
                .lean();
            const userById = new Map();
            for (const u of dbUsers) {
                userById.set(String(u._id), u);
            }
            for (const [, val] of partnerIdMap) {
                if (userById.has(val.partnerId)) {
                    const dbU = userById.get(val.partnerId);
                    val.fallbackUser = {
                        id: String(dbU._id),
                        _id: String(dbU._id),
                        name: dbU.name || val.fallbackUser.name,
                        teluguName: dbU.teluguName || dbU.name || val.fallbackUser.teluguName,
                        handle: dbU.mitraId || dbU.handle || val.fallbackUser.handle,
                        mitraId: dbU.mitraId || dbU.handle || val.fallbackUser.mitraId,
                        avatar: dbU.avatar || val.fallbackUser.avatar,
                        isVerified: Boolean(dbU.isVerified),
                        isOnline: Boolean(dbU.isOnline),
                        location: dbU.location || '',
                        lastSeen: dbU.lastSeen,
                    };
                }
            }
        }
        return Array.from(partnerIdMap.values()).map((v) => ({
            targetUser: v.fallbackUser,
            lastMessage: {
                id: v.lastMessage.id,
                senderId: v.lastMessage.senderId,
                senderName: v.lastMessage.senderName,
                senderAvatar: v.lastMessage.senderAvatar || '',
                senderHandle: v.lastMessage.senderHandle || '',
                senderTeluguName: v.lastMessage.senderTeluguName || '',
                targetUserId: v.lastMessage.targetUserId,
                targetUserName: v.lastMessage.targetUserName,
                targetUserAvatar: v.lastMessage.targetUserAvatar || '',
                targetUserHandle: v.lastMessage.targetUserHandle || '',
                targetUserTeluguName: v.lastMessage.targetUserTeluguName || '',
                text: v.lastMessage.text,
                mediaUrl: v.lastMessage.mediaUrl || '',
                mediaType: v.lastMessage.mediaType,
                timestamp: v.lastMessage.timestamp,
                status: v.lastMessage.status || 'sent',
            },
            unreadCount: v.unreadCount,
        }));
    }
    /**
     * Update message status (delivered / seen) and notify sender in realtime
     */
    async updateStatus(myId, partnerId, status, messageId) {
        if (!['delivered', 'seen'].includes(status)) {
            throw new Error('Status must be delivered or seen');
        }
        const cleanMyId = String(myId).trim();
        const cleanPartnerId = String(partnerId).trim();
        const [dbMe, dbPartner] = await Promise.all([
            this.resolveUser(cleanMyId),
            this.resolveUser(cleanPartnerId),
        ]);
        const canonicalMyId = dbMe ? String(dbMe._id) : cleanMyId;
        const partnerCanonicalIds = [cleanPartnerId];
        if (dbPartner) {
            partnerCanonicalIds.push(String(dbPartner._id));
            if (dbPartner.mitraId)
                partnerCanonicalIds.push(dbPartner.mitraId);
            if (dbPartner.handle)
                partnerCanonicalIds.push(dbPartner.handle);
        }
        const filter = {
            targetUserId: canonicalMyId,
            senderId: { $in: partnerCanonicalIds },
        };
        if (messageId) {
            filter.id = String(messageId);
        }
        if (status === 'delivered') {
            filter.status = { $nin: ['delivered', 'seen'] };
        }
        else if (status === 'seen') {
            filter.status = { $ne: 'seen' };
        }
        const modifiedCount = await message_repository_1.messageRepository.updateManyStatus(filter, status);
        // Broadcast status change to partner in realtime
        const statusPayload = {
            targetUserId: cleanPartnerId,
            senderId: canonicalMyId,
            messageId,
            status,
        };
        socket_manager_1.socketManager.emitToUser(cleanPartnerId, 'direct:status', statusPayload);
        if (dbPartner) {
            socket_manager_1.socketManager.emitToUser(String(dbPartner._id), 'direct:status', statusPayload);
            if (dbPartner.handle)
                socket_manager_1.socketManager.emitToUser(dbPartner.handle, 'direct:status', statusPayload);
        }
        return { success: true, modifiedCount };
    }
    /**
     * Automatically mark all pending sent messages as delivered when user reconnects
     */
    async markDeliveredForUser(userId) {
        const cleanUserId = String(userId).trim();
        const dbUser = await this.resolveUser(cleanUserId);
        const canonicalId = dbUser ? String(dbUser._id) : cleanUserId;
        const undelivered = await message_repository_1.messageRepository.findMessages({
            targetUserId: canonicalId,
            status: 'sent',
        }, 100);
        if (undelivered.length === 0)
            return;
        await message_repository_1.messageRepository.updateManyStatus({ targetUserId: canonicalId, status: 'sent' }, 'delivered');
        // Group by sender and notify each sender that their messages reached destination
        const senders = new Set(undelivered.map((m) => m.senderId));
        senders.forEach((senderId) => {
            socket_manager_1.socketManager.emitToUser(senderId, 'direct:status', {
                targetUserId: senderId,
                senderId: canonicalId,
                status: 'delivered',
            });
        });
    }
    /**
     * Delete conversation between user and partner
     */
    async deleteConversation(myId, partnerId) {
        const cleanMyId = String(myId).trim();
        const cleanPartnerId = String(partnerId).trim();
        const [dbMe, dbPartner] = await Promise.all([
            this.resolveUser(cleanMyId),
            this.resolveUser(cleanPartnerId),
        ]);
        const canonicalMyId = dbMe ? String(dbMe._id) : cleanMyId;
        const partnerCanonicalIds = [cleanPartnerId];
        if (dbPartner) {
            partnerCanonicalIds.push(String(dbPartner._id));
            if (dbPartner.mitraId)
                partnerCanonicalIds.push(dbPartner.mitraId);
            if (dbPartner.handle)
                partnerCanonicalIds.push(dbPartner.handle);
        }
        const keys = partnerCanonicalIds.map((pid) => (0, message_model_1.buildConversationKey)(canonicalMyId, pid));
        const deletedCount = await message_repository_1.messageRepository.deleteConversation(keys, canonicalMyId, cleanPartnerId);
        return { success: true, deletedCount };
    }
}
exports.MessageService = MessageService;
exports.messageService = new MessageService();
