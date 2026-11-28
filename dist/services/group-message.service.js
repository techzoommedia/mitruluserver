"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupMessageService = exports.GroupMessageService = void 0;
const group_message_repository_1 = require("../repositories/group-message.repository");
const group_message_model_1 = require("../models/group-message.model");
const socket_manager_1 = require("../sockets/socket.manager");
const message_service_1 = require("./message.service");
const user_model_1 = require("../models/user.model");
const chat_group_model_1 = require("../models/chat-group.model");
class GroupMessageService {
    /**
     * Seed default Telugu community group if not already in database
     */
    async ensureDefaultGroupSeeded() {
        try {
            const existing = await chat_group_model_1.ChatGroupModel.findOne({ id: 'telugu' }).lean();
            if (!existing) {
                await chat_group_model_1.ChatGroupModel.create({
                    id: 'telugu',
                    name: 'Telugu',
                    teluguName: 'మన తెలుగు',
                    description: 'మన తెలుగు ప్రజల పబ్లిక్ గ్రూప్ • ఇక్కడ అందరూ కలిసి సరదాగా చాట్ చేసుకోవచ్చు',
                    avatar: '/mitrulu-logo.webp',
                    category: 'Community',
                    isPublic: true,
                    isHold: false,
                    rules: 'గౌరవంగా మాట్లాడండి, స్పామ్ చేయకండి (Be respectful, no spam)',
                });
            }
        }
        catch (err) {
            console.warn('[GroupMessageService] Error seeding default group:', err);
        }
    }
    /**
     * List all available groups with real-time last message and accurate member counts
     */
    async getGroups() {
        await this.ensureDefaultGroupSeeded();
        const dbGroups = await chat_group_model_1.ChatGroupModel.find({}).sort({ createdAt: 1 }).lean();
        const totalUsers = await user_model_1.UserModel.countDocuments().catch(() => 0);
        const groups = await Promise.all(dbGroups.map(async (grp) => {
            const latestMsg = await group_message_repository_1.groupMessageRepository.getLatestMessage(grp.id);
            let memberCount = 1;
            if (grp.isPublic) {
                memberCount = Math.max(totalUsers, grp.customMemberCount || 1);
            }
            else {
                const uniqueSenders = await group_message_model_1.GroupMessageModel.distinct('senderId', { groupId: grp.id });
                memberCount = Math.max(uniqueSenders.length, grp.customMemberCount || 1);
            }
            return {
                id: grp.id,
                name: grp.name,
                teluguName: grp.teluguName,
                description: grp.description,
                avatar: grp.avatar || '/mitrulu-logo.webp',
                isPublic: grp.isPublic,
                category: grp.category,
                isHold: Boolean(grp.isHold),
                holdReason: grp.holdReason,
                heldAt: grp.heldAt ? new Date(grp.heldAt).toISOString() : null,
                heldBy: grp.heldBy,
                rules: grp.rules,
                admins: grp.admins || [],
                memberCount,
                lastMessage: latestMsg
                    ? {
                        text: latestMsg.text,
                        senderName: latestMsg.senderName,
                        timestamp: latestMsg.timestamp,
                    }
                    : undefined,
            };
        }));
        return groups;
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
        const targetGroupId = (dto.groupId || 'telugu').toLowerCase().trim();
        // Prevent sending messages to groups that are temporarily on hold
        const grp = await chat_group_model_1.ChatGroupModel.findOne({ id: targetGroupId }).lean();
        if (grp && grp.isHold) {
            const holdErr = new Error(grp.holdReason || 'ఈ గ్రూప్ ప్రస్తుతం అడ్మినిస్ట్రేటర్ ద్వారా తాత్కాలికంగా హోల్డ్‌లో ఉంచబడింది (This group is temporarily on hold)');
            holdErr.isHold = true;
            holdErr.statusCode = 403;
            throw holdErr;
        }
        const messageId = dto.id || `gmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const timestamp = dto.timestamp || Date.now();
        // Idempotency guard: if client sent the same message ID over both socket and REST, return existing
        if (dto.id) {
            const existing = await group_message_repository_1.groupMessageRepository.findMessageById(messageId);
            if (existing) {
                return existing;
            }
        }
        let created;
        try {
            created = await group_message_repository_1.groupMessageRepository.createMessage({
                id: messageId,
                groupId: targetGroupId,
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
        }
        catch (err) {
            if (err?.code === 11000 && dto.id) {
                const existing = await group_message_repository_1.groupMessageRepository.findMessageById(messageId);
                if (existing)
                    return existing;
            }
            throw err;
        }
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
        if (msg.type === 'coin_transfer' ||
            msg.type === 'custom_gift' ||
            Boolean(msg.coinAmount) ||
            Boolean(msg.giftId)) {
            throw new Error('Forbidden: Coin transfers and gift sharing messages cannot be unsent');
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
    /**
     * Admin: List all groups with detailed analytics
     */
    async getAllGroupsAdmin() {
        await this.ensureDefaultGroupSeeded();
        const dbGroups = await chat_group_model_1.ChatGroupModel.find({}).sort({ createdAt: -1 }).lean();
        const totalUsers = await user_model_1.UserModel.countDocuments().catch(() => 0);
        return await Promise.all(dbGroups.map(async (grp) => {
            const [totalMessages, latestMsg, uniqueParticipants] = await Promise.all([
                group_message_repository_1.groupMessageRepository.countMessages(grp.id),
                group_message_repository_1.groupMessageRepository.getLatestMessage(grp.id),
                group_message_model_1.GroupMessageModel.distinct('senderId', { groupId: grp.id }),
            ]);
            const memberCount = grp.isPublic
                ? Math.max(totalUsers, grp.customMemberCount || 1)
                : Math.max(uniqueParticipants.length, grp.customMemberCount || 1);
            const adminIds = Array.isArray(grp.admins) ? grp.admins : [];
            let adminUsers = [];
            if (adminIds.length > 0) {
                const foundAdmins = await user_model_1.UserModel.find({ _id: { $in: adminIds } })
                    .select('_id name teluguName handle mitraId avatar')
                    .lean()
                    .catch(() => []);
                adminUsers = foundAdmins.map((u) => ({
                    id: u._id.toString(),
                    name: u.name || 'Admin',
                    teluguName: u.teluguName,
                    handle: u.mitraId || u.handle || '',
                    avatar: u.avatar || '',
                }));
            }
            return {
                ...grp,
                admins: adminIds,
                adminUsers,
                totalMessages,
                uniqueParticipantsCount: uniqueParticipants.length,
                memberCount,
                calculatedMemberCount: memberCount,
                lastActiveAt: latestMsg ? new Date(latestMsg.timestamp).toISOString() : grp.updatedAt,
            };
        }));
    }
    /**
     * Admin: Create a new chat group
     */
    async createGroup(data) {
        const slug = data.id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
        if (!slug) {
            throw new Error('Valid group slug ID is required (e.g. cinema, hyderabad)');
        }
        const existing = await chat_group_model_1.ChatGroupModel.findOne({ id: slug });
        if (existing) {
            throw new Error(`Group with ID "${slug}" already exists`);
        }
        const newGroup = await chat_group_model_1.ChatGroupModel.create({
            id: slug,
            name: data.name.trim(),
            teluguName: data.teluguName.trim(),
            description: data.description?.trim() || '',
            avatar: data.avatar?.trim() || '/mitrulu-logo.webp',
            category: data.category?.trim() || 'Community',
            isPublic: data.isPublic !== false,
            rules: data.rules?.trim() || '',
            customMemberCount: data.customMemberCount || 0,
            isHold: false,
        });
        try {
            socket_manager_1.socketManager.getIO().emit('group:created', { group: newGroup.toObject() });
        }
        catch { }
        return newGroup;
    }
    /**
     * Admin: Update group details
     */
    async updateGroup(groupId, data) {
        const group = await chat_group_model_1.ChatGroupModel.findOne({ id: groupId.toLowerCase().trim() });
        if (!group) {
            throw new Error(`Group "${groupId}" not found`);
        }
        if (data.name !== undefined)
            group.name = data.name.trim();
        if (data.teluguName !== undefined)
            group.teluguName = data.teluguName.trim();
        if (data.description !== undefined)
            group.description = data.description.trim();
        if (data.avatar !== undefined)
            group.avatar = data.avatar.trim();
        if (data.category !== undefined)
            group.category = data.category.trim();
        if (data.isPublic !== undefined)
            group.isPublic = Boolean(data.isPublic);
        if (data.rules !== undefined)
            group.rules = data.rules.trim();
        if (data.customMemberCount !== undefined)
            group.customMemberCount = Number(data.customMemberCount);
        await group.save();
        try {
            socket_manager_1.socketManager.getIO().emit('group:updated', { group: group.toObject() });
        }
        catch { }
        return group;
    }
    /**
     * Admin: Promote a user (by ID, handle, or mitraId) to Group Admin
     */
    async promoteAdmin(groupId, identifier) {
        const slug = groupId.toLowerCase().trim();
        const cleanTarget = String(identifier || '').trim().replace(/^@/, '');
        if (!cleanTarget) {
            throw new Error('User ID, @handle, or Mitra ID is required');
        }
        const group = await chat_group_model_1.ChatGroupModel.findOne({ id: slug });
        if (!group) {
            throw new Error(`Group "${groupId}" not found`);
        }
        const dbUser = await message_service_1.messageService.resolveUser(cleanTarget);
        if (!dbUser || !dbUser._id) {
            throw new Error(`User "${cleanTarget}" not found`);
        }
        const resolvedId = dbUser._id.toString();
        const admins = Array.isArray(group.admins) ? [...group.admins] : [];
        if (!admins.includes(resolvedId)) {
            admins.push(resolvedId);
            group.admins = admins;
            await group.save();
        }
        try {
            socket_manager_1.socketManager.getIO().emit('group:updated', { group: group.toObject() });
        }
        catch { }
        return group;
    }
    /**
     * Admin: Remove a user from Group Admins
     */
    async removeAdmin(groupId, targetUserId) {
        const slug = groupId.toLowerCase().trim();
        const cleanTarget = String(targetUserId || '').trim();
        const group = await chat_group_model_1.ChatGroupModel.findOne({ id: slug });
        if (!group) {
            throw new Error(`Group "${groupId}" not found`);
        }
        group.admins = (group.admins || []).filter((id) => String(id) !== cleanTarget);
        await group.save();
        try {
            socket_manager_1.socketManager.getIO().emit('group:updated', { group: group.toObject() });
        }
        catch { }
        return group;
    }
    /**
     * Admin: Toggle temporary hold / pause status on a group
     */
    async toggleGroupHold(groupId, isHold, holdReason, adminActor) {
        const group = await chat_group_model_1.ChatGroupModel.findOne({ id: groupId.toLowerCase().trim() });
        if (!group) {
            throw new Error(`Group "${groupId}" not found`);
        }
        group.isHold = Boolean(isHold);
        group.holdReason = isHold
            ? (holdReason?.trim() || 'అడ్మిన్ ద్వారా తాత్కాలికంగా హోల్డ్‌లో ఉంచబడింది (Temporarily placed on hold by administrator)')
            : '';
        group.heldAt = isHold ? new Date() : null;
        group.heldBy = isHold ? (adminActor || 'Admin') : '';
        await group.save();
        const room = `group_${group.id}`;
        try {
            socket_manager_1.socketManager.getIO().emit('group:hold-changed', {
                groupId: group.id,
                isHold: group.isHold,
                holdReason: group.holdReason,
            });
            socket_manager_1.socketManager.getIO().to(room).emit('group:hold-changed', {
                groupId: group.id,
                isHold: group.isHold,
                holdReason: group.holdReason,
            });
        }
        catch { }
        return group;
    }
    /**
     * Admin: Delete a group
     */
    async deleteGroup(groupId) {
        const slug = groupId.toLowerCase().trim();
        if (slug === 'telugu') {
            throw new Error('Default public Telugu community group cannot be deleted');
        }
        const group = await chat_group_model_1.ChatGroupModel.findOne({ id: slug });
        if (!group) {
            throw new Error(`Group "${slug}" not found`);
        }
        await chat_group_model_1.ChatGroupModel.deleteOne({ id: slug });
        try {
            socket_manager_1.socketManager.getIO().emit('group:deleted', { groupId: slug });
        }
        catch { }
    }
    /**
     * Admin: Clear all messages in a group
     */
    async clearGroupMessages(groupId) {
        const slug = groupId.toLowerCase().trim();
        const result = await group_message_model_1.GroupMessageModel.deleteMany({ groupId: slug });
        const room = `group_${slug}`;
        try {
            socket_manager_1.socketManager.getIO().to(room).emit('group:messages-cleared', { groupId: slug });
        }
        catch { }
        return result.deletedCount || 0;
    }
    /**
     * Get members of a chat group with scroll-based pagination and search
     */
    async getGroupMembers(groupId, options = {}) {
        const slug = (groupId || 'telugu').toLowerCase().trim();
        await this.ensureDefaultGroupSeeded();
        const page = Math.max(1, parseInt(String(options.page || 1), 10));
        const limit = Math.min(Math.max(1, parseInt(String(options.limit || 20), 10)), 60);
        const skip = (page - 1) * limit;
        const filter = { moderationStatus: { $ne: 'banned' } };
        if (options.q && typeof options.q === 'string' && options.q.trim()) {
            const cleanQ = options.q.replace(/^@/, '').trim();
            const regex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { name: regex },
                { teluguName: regex },
                { handle: regex },
                { mitraId: regex },
                { location: regex },
                { bio: regex },
            ];
        }
        const onlineUserIds = new Set(socket_manager_1.socketManager.getOnlineUserIds().map((id) => String(id).toLowerCase()));
        const [totalMembers, dbUsers] = await Promise.all([
            user_model_1.UserModel.countDocuments(filter),
            user_model_1.UserModel.find(filter)
                .select('name teluguName handle mitraId avatar bio teluguBio location isVerified role isAdmin lastSeen createdAt')
                .sort({ isVerified: -1, lastSeen: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);
        const grp = await chat_group_model_1.ChatGroupModel.findOne({ id: slug }).select('admins').lean().catch(() => null);
        const groupAdminSet = new Set((grp?.admins || []).map((a) => String(a).toLowerCase()));
        const members = dbUsers.map((u) => {
            const uid = u._id ? u._id.toString() : '';
            const handleClean = (u.handle || u.mitraId || '').toLowerCase();
            const isOnline = onlineUserIds.has(uid.toLowerCase()) || (handleClean ? onlineUserIds.has(handleClean) : false);
            const isGroupAdmin = groupAdminSet.has(uid.toLowerCase()) || Boolean(u.isAdmin) || u.role === 'admin';
            return {
                id: uid,
                _id: uid,
                name: u.name,
                teluguName: u.teluguName || u.name,
                handle: u.mitraId || u.handle || uid,
                mitraId: u.mitraId || u.handle || uid,
                avatar: u.avatar || '',
                bio: u.bio || '',
                teluguBio: u.teluguBio || '',
                location: u.location || 'హైదరాబాద్',
                isVerified: Boolean(u.isVerified),
                role: isGroupAdmin ? 'admin' : 'member',
                isOnline,
                lastSeen: u.lastSeen || null,
                joinedAt: u.createdAt || null,
            };
        });
        return {
            members,
            totalMembers,
            page,
            limit,
            hasMore: skip + dbUsers.length < totalMembers,
        };
    }
}
exports.GroupMessageService = GroupMessageService;
exports.groupMessageService = new GroupMessageService();
