"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupMessageService = exports.GroupMessageService = void 0;
const group_message_repository_1 = require("../repositories/group-message.repository");
const socket_manager_1 = require("../sockets/socket.manager");
const message_service_1 = require("./message.service");
class GroupMessageService {
    /**
     * List all available groups with real-time last message
     */
    async getGroups() {
        // Default public Telugu group
        const latestTeluguMsg = await group_message_repository_1.groupMessageRepository.getLatestMessage('telugu');
        const teluguMsgCount = await group_message_repository_1.groupMessageRepository.countMessages('telugu');
        const teluguGroup = {
            id: 'telugu',
            name: 'Telugu',
            teluguName: 'మన తెలుగు',
            description: 'మన తెలుగు ప్రజల పబ్లిక్ గ్రూప్ • ఇక్కడ అందరూ కలిసి సరదాగా చాట్ చేసుకోవచ్చు',
            avatar: '/mitrulu-logo.webp',
            isPublic: true,
            category: 'Community',
            memberCount: Math.max(120, socket_manager_1.socketManager.getActiveSocketsCount() + 85),
            lastMessage: latestTeluguMsg
                ? {
                    text: latestTeluguMsg.text,
                    senderName: latestTeluguMsg.senderName,
                    timestamp: latestTeluguMsg.timestamp,
                }
                : undefined,
        };
        return [teluguGroup];
    }
    /**
     * Fetch paginated message history for a group
     */
    async getMessages(groupId, limit = 50, before, viewerUserId) {
        let excludeForIds;
        if (viewerUserId) {
            const dbUser = await message_service_1.messageService.resolveUser(String(viewerUserId).trim());
            excludeForIds = message_service_1.messageService.getCanonicalIdsForUser(String(viewerUserId).trim(), dbUser);
        }
        return await group_message_repository_1.groupMessageRepository.findMessagesByGroup(groupId, limit, before, excludeForIds);
    }
    /**
     * Send a new message to a group and broadcast to all members in real time
     */
    async sendGroupMessage(dto, exceptSocketId) {
        const messageId = dto.id || `gmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const timestamp = dto.timestamp || Date.now();
        const created = await group_message_repository_1.groupMessageRepository.createMessage({
            id: messageId,
            groupId: dto.groupId || 'telugu',
            senderId: dto.senderId,
            senderName: dto.senderName || 'Mitrulu Member',
            senderAvatar: dto.senderAvatar || '',
            senderHandle: dto.senderHandle || '',
            senderTeluguName: dto.senderTeluguName || '',
            text: dto.text,
            mediaUrl: dto.mediaUrl || '',
            mediaType: dto.mediaType,
            timestamp,
        });
        const serialized = created.toObject ? created.toObject() : created;
        // Real-time broadcast to all connected clients in the group room
        try {
            const room = `group_${dto.groupId || 'telugu'}`;
            if (exceptSocketId) {
                socket_manager_1.socketManager.getIO().to(room).except(exceptSocketId).emit('group:message', {
                    groupId: dto.groupId || 'telugu',
                    message: serialized,
                });
            }
            else {
                socket_manager_1.socketManager.getIO().to(room).emit('group:message', {
                    groupId: dto.groupId || 'telugu',
                    message: serialized,
                });
            }
        }
        catch (err) {
            console.warn('[GroupMessageService] Socket broadcast error:', err);
        }
        return created;
    }
    /**
     * Ensure only the original sender can modify/delete their own group message
     */
    async assertGroupMessageSender(myId, msg, action) {
        const cleanMyId = String(myId).trim();
        const dbMe = await message_service_1.messageService.resolveUser(cleanMyId);
        const myIdsList = message_service_1.messageService.getCanonicalIdsForUser(cleanMyId, dbMe);
        const myIdsLower = new Set(myIdsList.map((s) => s.toLowerCase()));
        const msgSenderId = String(msg.senderId || '').toLowerCase();
        const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
        const isSender = myIdsLower.has(msgSenderId) || (msgSenderHandle && myIdsLower.has(msgSenderHandle));
        if (!isSender) {
            throw new Error(`Forbidden: Only the sender can ${action} this message`);
        }
        return { dbMe, myIdsList };
    }
    /**
     * Edit a sent group message (sender only)
     */
    async editGroupMessage(myId, messageId, newText) {
        const trimmed = String(newText || '').trim();
        if (!trimmed) {
            throw new Error('Updated message text is required');
        }
        const msg = await group_message_repository_1.groupMessageRepository.findMessageById(messageId);
        if (!msg) {
            throw new Error('Message not found');
        }
        await this.assertGroupMessageSender(myId, msg, 'edit');
        const editedAt = Date.now();
        const updated = await group_message_repository_1.groupMessageRepository.updateMessageText(messageId, trimmed, editedAt);
        const gid = (msg.groupId || 'telugu').toLowerCase();
        const room = `group_${gid}`;
        try {
            socket_manager_1.socketManager.getIO().to(room).emit('group:message-edited', {
                groupId: gid,
                messageId,
                text: trimmed,
                isEdited: true,
                editedAt,
                message: updated || { ...msg, text: trimmed, isEdited: true, editedAt },
            });
        }
        catch (err) {
            console.warn('[GroupMessageService] Socket edit broadcast error:', err);
        }
        return updated;
    }
    /**
     * Unsend a group message for everyone (sender only)
     */
    async unsendGroupMessage(myId, messageId) {
        const msg = await group_message_repository_1.groupMessageRepository.findMessageById(messageId);
        if (!msg) {
            return { success: true, messageId, deletedCount: 0 };
        }
        await this.assertGroupMessageSender(myId, msg, 'unsend');
        const deletedCount = await group_message_repository_1.groupMessageRepository.deleteMessageById(messageId);
        const gid = (msg.groupId || 'telugu').toLowerCase();
        const room = `group_${gid}`;
        try {
            socket_manager_1.socketManager.getIO().to(room).emit('group:message-unsent', {
                groupId: gid,
                messageId,
            });
        }
        catch (err) {
            console.warn('[GroupMessageService] Socket unsend broadcast error:', err);
        }
        return { success: true, messageId, deletedCount };
    }
    /**
     * Delete a group message only from the sender's side (sender only)
     */
    async deleteGroupMessageForMe(myId, messageId) {
        const msg = await group_message_repository_1.groupMessageRepository.findMessageById(messageId);
        if (!msg) {
            return { success: true, messageId };
        }
        const cleanMyId = String(myId).trim();
        const { dbMe, myIdsList } = await this.assertGroupMessageSender(cleanMyId, msg, 'delete');
        await group_message_repository_1.groupMessageRepository.markDeletedForUser(messageId, myIdsList);
        const gid = (msg.groupId || 'telugu').toLowerCase();
        try {
            socket_manager_1.socketManager.emitToUser(cleanMyId, 'group:message-deleted-for-me', {
                groupId: gid,
                messageId,
            });
            if (dbMe?._id) {
                socket_manager_1.socketManager.emitToUser(String(dbMe._id), 'group:message-deleted-for-me', {
                    groupId: gid,
                    messageId,
                });
            }
        }
        catch { }
        return { success: true, messageId };
    }
}
exports.GroupMessageService = GroupMessageService;
exports.groupMessageService = new GroupMessageService();
