"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageService = exports.MessageService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const message_repository_1 = require("../repositories/message.repository");
const message_model_1 = require("../models/message.model");
const user_model_1 = require("../models/user.model");
const notification_model_1 = __importDefault(require("../models/notification.model"));
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
     * Collect all exact + normalized identity strings for a user
     */
    getCanonicalIdsForUser(identifier, dbUser) {
        const ids = new Set();
        const add = (val) => {
            if (!val)
                return;
            const clean = String(val).trim();
            if (!clean)
                return;
            ids.add(clean);
            ids.add(clean.toLowerCase());
            const noAt = clean.replace(/^@/, '');
            if (noAt) {
                ids.add(noAt);
                ids.add(noAt.toLowerCase());
            }
        };
        add(identifier);
        if (dbUser) {
            if (dbUser._id)
                add(String(dbUser._id));
            if (dbUser.id)
                add(String(dbUser.id));
            if (dbUser.handle)
                add(String(dbUser.handle));
            if (dbUser.mitraId)
                add(String(dbUser.mitraId));
        }
        return Array.from(ids);
    }
    emitToUserIdentities(rawId, dbUser, event, payload, exceptSocketId) {
        const rooms = new Set();
        if (rawId)
            rooms.add(String(rawId).trim());
        if (dbUser) {
            if (dbUser._id)
                rooms.add(String(dbUser._id));
            if (dbUser.handle) {
                rooms.add(String(dbUser.handle));
                rooms.add(String(dbUser.handle).toLowerCase());
            }
            if (dbUser.mitraId) {
                rooms.add(String(dbUser.mitraId));
                rooms.add(String(dbUser.mitraId).toLowerCase());
            }
        }
        rooms.forEach((uid) => {
            if (uid) {
                socket_manager_1.socketManager.emitToUser(uid, event, payload, exceptSocketId);
            }
        });
    }
    toPublicMessage(d) {
        return {
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
            isEdited: Boolean(d.isEdited),
            editedAt: d.editedAt,
        };
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
        const publicMessage = this.toPublicMessage(saved);
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
        // 3. Real-time In-App Notification and Badge Sync (0ms latency)
        if (canonicalTargetId && mongoose_1.default.Types.ObjectId.isValid(canonicalTargetId)) {
            const recipientOid = new mongoose_1.default.Types.ObjectId(canonicalTargetId);
            const actorOid = mongoose_1.default.Types.ObjectId.isValid(canonicalSenderId)
                ? new mongoose_1.default.Types.ObjectId(canonicalSenderId)
                : undefined;
            notification_model_1.default.create({
                recipient: recipientOid,
                actor: actorOid,
                type: 'message',
                title: senderName || 'కొత్త సందేశం (New Message)',
                teluguTitle: senderTeluguName ? `${senderTeluguName} నుండి సందేశం` : `${senderName} నుండి సందేశం`,
                body: text.length > 80 ? `${text.slice(0, 80)}...` : text,
                teluguBody: text.length > 80 ? `${text.slice(0, 80)}...` : text,
                data: {
                    messageId,
                    senderId: canonicalSenderId,
                    senderHandle,
                    conversationKey: convKey,
                },
                link: `/messages?user=${encodeURIComponent(senderHandle || canonicalSenderId)}`,
                isRead: false,
            })
                .then((notif) => {
                const notifPayload = {
                    id: notif._id.toString(),
                    type: 'message',
                    title: notif.title,
                    teluguTitle: notif.teluguTitle,
                    body: notif.body,
                    teluguBody: notif.teluguBody,
                    actor: {
                        id: canonicalSenderId,
                        name: senderName,
                        teluguName: senderTeluguName,
                        handle: senderHandle,
                        avatar: senderAvatar,
                    },
                    link: notif.link,
                    createdAt: notif.createdAt,
                    isRead: false,
                };
                socket_manager_1.socketManager.emitToUser(canonicalTargetId, 'notification:new', { notification: notifPayload });
                if (cleanTargetId !== canonicalTargetId) {
                    socket_manager_1.socketManager.emitToUser(cleanTargetId, 'notification:new', { notification: notifPayload });
                }
            })
                .catch((err) => {
                console.warn('[MessageService] Notification creation warning:', err);
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
        const myIdsList = this.getCanonicalIdsForUser(cleanMyId, dbSender);
        const partnerIdsList = this.getCanonicalIdsForUser(cleanPartnerId, dbPartner);
        // Build all candidate conversation keys
        const conversationKeysSet = new Set();
        for (const m of myIdsList) {
            for (const p of partnerIdsList) {
                conversationKeysSet.add((0, message_model_1.buildConversationKey)(m, p));
            }
        }
        const query = {
            $or: [
                { conversationKey: { $in: Array.from(conversationKeysSet) } },
                {
                    $and: [
                        { senderId: { $in: myIdsList } },
                        { targetUserId: { $in: partnerIdsList } },
                    ],
                },
                {
                    $and: [
                        { senderId: { $in: partnerIdsList } },
                        { targetUserId: { $in: myIdsList } },
                    ],
                },
            ],
        };
        const maxLimit = Math.min(Math.max(limit, 5), 100);
        const docs = await message_repository_1.messageRepository.findMessages(query, maxLimit + 1, before, myIdsList);
        const hasMore = docs.length > maxLimit;
        const paginatedDocs = hasMore ? docs.slice(0, maxLimit) : docs;
        // Return in chronological order (oldest to newest for chat UI)
        const messages = paginatedDocs.reverse().map((d) => this.toPublicMessage(d));
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
        const myCanonicalIds = new Set();
        myCanonicalIds.add(canonicalMyId);
        myCanonicalIds.add(cleanMyId);
        myCanonicalIds.add(canonicalMyId.toLowerCase());
        myCanonicalIds.add(cleanMyId.toLowerCase());
        if (dbMe) {
            if (dbMe.handle) {
                myCanonicalIds.add(dbMe.handle);
                myCanonicalIds.add(dbMe.handle.toLowerCase());
                myCanonicalIds.add(dbMe.handle.toLowerCase().replace(/^@/, ''));
            }
            if (dbMe.mitraId) {
                myCanonicalIds.add(dbMe.mitraId);
                myCanonicalIds.add(dbMe.mitraId.toLowerCase());
                myCanonicalIds.add(dbMe.mitraId.toLowerCase().replace(/^@/, ''));
            }
        }
        const myIdsList = Array.from(myCanonicalIds);
        const recentMessages = await message_repository_1.messageRepository.aggregateConversations(myIdsList);
        const partnerIdMap = new Map();
        const partnerObjectIds = [];
        const partnerHandles = [];
        for (const item of recentMessages) {
            const msg = item.lastMessage;
            const isMeSender = myCanonicalIds.has(String(msg.senderId));
            const partnerId = isMeSender ? String(msg.targetUserId) : String(msg.senderId);
            // STRICT GUARD: Never return self as chat partner!
            if (!partnerId || myCanonicalIds.has(partnerId) || myCanonicalIds.has(partnerId.toLowerCase())) {
                continue;
            }
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
                partnerObjectIds.push(partnerId);
            }
            else if (partnerId) {
                partnerHandles.push(partnerId);
            }
        }
        if (partnerObjectIds.length > 0 || partnerHandles.length > 0) {
            const orConditions = [];
            if (partnerObjectIds.length > 0)
                orConditions.push({ _id: { $in: partnerObjectIds } });
            if (partnerHandles.length > 0) {
                orConditions.push({ handle: { $in: partnerHandles } });
                orConditions.push({ mitraId: { $in: partnerHandles } });
            }
            const dbUsers = await user_model_1.UserModel.find({ $or: orConditions })
                .select('_id name teluguName handle mitraId avatar isVerified isOnline location lastSeen')
                .lean();
            const userById = new Map();
            for (const u of dbUsers) {
                userById.set(String(u._id), u);
                if (u.handle)
                    userById.set(String(u.handle).toLowerCase(), u);
                if (u.mitraId)
                    userById.set(String(u.mitraId).toLowerCase(), u);
            }
            for (const [, val] of partnerIdMap) {
                const dbU = userById.get(val.partnerId) || userById.get(val.partnerId.toLowerCase());
                if (dbU) {
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
        return Array.from(partnerIdMap.values())
            .filter((v) => {
            const pid = String(v.fallbackUser.id || v.fallbackUser._id || '').toLowerCase();
            const ph = String(v.fallbackUser.handle || v.fallbackUser.mitraId || '').toLowerCase().replace(/^@/, '');
            return !myCanonicalIds.has(pid) && (!ph || !myCanonicalIds.has(ph));
        })
            .map((v) => ({
            targetUser: v.fallbackUser,
            lastMessage: this.toPublicMessage(v.lastMessage),
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
     * Edit a sent direct message (sender only) and sync in real time to both users
     */
    async editMessage(myId, messageId, newText, senderSocketId) {
        const trimmed = String(newText || '').trim();
        if (!trimmed) {
            throw new Error('Updated message text is required');
        }
        const msg = await message_repository_1.messageRepository.findMessageById(messageId);
        if (!msg) {
            throw new Error('Message not found');
        }
        const dbMe = await this.resolveUser(String(myId).trim());
        const myIdsLower = new Set(this.getCanonicalIdsForUser(String(myId).trim(), dbMe).map((s) => s.toLowerCase()));
        const msgSenderId = String(msg.senderId || '').toLowerCase();
        const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
        const isSender = myIdsLower.has(msgSenderId) || (msgSenderHandle && myIdsLower.has(msgSenderHandle));
        if (!isSender) {
            throw new Error('Forbidden: Only the sender can edit this message');
        }
        const editedAt = Date.now();
        const updated = await message_repository_1.messageRepository.updateMessageText(messageId, trimmed, editedAt);
        const publicMessage = this.toPublicMessage(updated || { ...msg, text: trimmed, isEdited: true, editedAt });
        const dbPartner = await this.resolveUser(String(msg.targetUserId || '').trim());
        const payload = {
            messageId,
            text: publicMessage.text,
            isEdited: true,
            editedAt,
            senderId: msg.senderId,
            targetUserId: msg.targetUserId,
            message: publicMessage,
        };
        this.emitToUserIdentities(msg.targetUserId, dbPartner, 'direct:message-edited', payload);
        this.emitToUserIdentities(msg.senderId, dbMe, 'direct:message-edited', payload, senderSocketId);
        return publicMessage;
    }
    /**
     * Unsend a sent direct message for both sides (sender only)
     */
    async unsendMessage(myId, messageId, senderSocketId) {
        const msg = await message_repository_1.messageRepository.findMessageById(messageId);
        if (!msg) {
            return { success: true, messageId, deletedCount: 0 };
        }
        const dbMe = await this.resolveUser(String(myId).trim());
        const myIdsLower = new Set(this.getCanonicalIdsForUser(String(myId).trim(), dbMe).map((s) => s.toLowerCase()));
        const msgSenderId = String(msg.senderId || '').toLowerCase();
        const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
        const isSender = myIdsLower.has(msgSenderId) || (msgSenderHandle && myIdsLower.has(msgSenderHandle));
        if (!isSender) {
            throw new Error('Forbidden: Only the sender can unsend this message');
        }
        const deletedCount = await message_repository_1.messageRepository.deleteMessageById(messageId);
        const dbPartner = await this.resolveUser(String(msg.targetUserId || '').trim());
        const payload = {
            messageId,
            senderId: msg.senderId,
            targetUserId: msg.targetUserId,
            conversationKey: msg.conversationKey,
        };
        this.emitToUserIdentities(msg.targetUserId, dbPartner, 'direct:message-unsent', payload);
        this.emitToUserIdentities(msg.senderId, dbMe, 'direct:message-unsent', payload, senderSocketId);
        return { success: true, messageId, deletedCount };
    }
    /**
     * Delete a direct message only for the requesting user (keeps it for the partner)
     */
    async deleteMessageForMe(myId, messageId, senderSocketId) {
        const msg = await message_repository_1.messageRepository.findMessageById(messageId);
        if (!msg) {
            return { success: true, messageId };
        }
        const cleanMyId = String(myId).trim();
        const dbMe = await this.resolveUser(cleanMyId);
        const myIdsList = this.getCanonicalIdsForUser(cleanMyId, dbMe);
        const myIdsLower = new Set(myIdsList.map((s) => s.toLowerCase()));
        const msgSenderId = String(msg.senderId || '').toLowerCase();
        const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
        const msgTargetId = String(msg.targetUserId || '').toLowerCase();
        const msgTargetHandle = String(msg.targetUserHandle || '').toLowerCase().replace(/^@/, '');
        const isParticipant = myIdsLower.has(msgSenderId) ||
            (msgSenderHandle && myIdsLower.has(msgSenderHandle)) ||
            myIdsLower.has(msgTargetId) ||
            (msgTargetHandle && myIdsLower.has(msgTargetHandle));
        if (!isParticipant) {
            throw new Error('Forbidden: You are not part of this conversation');
        }
        await message_repository_1.messageRepository.markDeletedForUser(messageId, myIdsList);
        const payload = {
            messageId,
            userId: dbMe ? String(dbMe._id) : cleanMyId,
            senderId: msg.senderId,
            targetUserId: msg.targetUserId,
        };
        this.emitToUserIdentities(cleanMyId, dbMe, 'direct:message-deleted-for-me', payload, senderSocketId);
        return { success: true, messageId };
    }
    /**
     * Delete conversation between user and partner ('me' = your side only, 'both' = both sides)
     */
    async deleteConversation(myId, partnerId, scope = 'both', senderSocketId) {
        const cleanMyId = String(myId).trim();
        const cleanPartnerId = String(partnerId).trim();
        const normalizedScope = scope === 'me' ? 'me' : 'both';
        const [dbMe, dbPartner] = await Promise.all([
            this.resolveUser(cleanMyId),
            this.resolveUser(cleanPartnerId),
        ]);
        const canonicalMyId = dbMe ? String(dbMe._id) : cleanMyId;
        const canonicalPartnerId = dbPartner ? String(dbPartner._id) : cleanPartnerId;
        const myIdsList = this.getCanonicalIdsForUser(cleanMyId, dbMe);
        const partnerIdsList = this.getCanonicalIdsForUser(cleanPartnerId, dbPartner);
        const keysSet = new Set();
        for (const m of myIdsList) {
            for (const p of partnerIdsList) {
                keysSet.add((0, message_model_1.buildConversationKey)(m, p));
            }
        }
        const deletedCount = await message_repository_1.messageRepository.deleteConversation(Array.from(keysSet), myIdsList, partnerIdsList, normalizedScope);
        if (normalizedScope === 'both') {
            // Notify partner immediately so the chat vanishes from their screen & sidebar too
            this.emitToUserIdentities(canonicalPartnerId, dbPartner, 'direct:chat-deleted', {
                scope: 'both',
                deletedBy: canonicalMyId,
                partnerId: canonicalMyId,
                partnerHandle: dbMe?.mitraId || dbMe?.handle || '',
                targetUserId: canonicalPartnerId,
            });
            // Multi-tab sync for initiating user
            this.emitToUserIdentities(canonicalMyId, dbMe, 'direct:chat-deleted', {
                scope: 'both',
                deletedBy: canonicalMyId,
                partnerId: canonicalPartnerId,
                partnerHandle: dbPartner?.mitraId || dbPartner?.handle || '',
                targetUserId: canonicalMyId,
            }, senderSocketId);
        }
        else {
            // Multi-tab sync for initiating user only
            this.emitToUserIdentities(canonicalMyId, dbMe, 'direct:chat-deleted', {
                scope: 'me',
                deletedBy: canonicalMyId,
                partnerId: canonicalPartnerId,
                partnerHandle: dbPartner?.mitraId || dbPartner?.handle || '',
                targetUserId: canonicalMyId,
            }, senderSocketId);
        }
        return { success: true, deletedCount, scope: normalizedScope };
    }
}
exports.MessageService = MessageService;
exports.messageService = new MessageService();
