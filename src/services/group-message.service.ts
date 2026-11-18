import { groupMessageRepository } from '../repositories/group-message.repository';
import { IGroupMessage, GroupMediaType, GroupMessageModel } from '../models/group-message.model';
import { socketManager } from '../sockets/socket.manager';
import { messageService } from './message.service';
import { UserModel } from '../models/user.model';
import { ChatGroupModel, IChatGroup } from '../models/chat-group.model';

export interface GroupItem {
  id: string;
  name: string;
  teluguName: string;
  description: string;
  avatar: string;
  isPublic: boolean;
  category: string;
  memberCount: number;
  isHold?: boolean;
  holdReason?: string;
  heldAt?: string | null;
  heldBy?: string;
  rules?: string;
  lastMessage?: {
    text: string;
    senderName: string;
    timestamp: number;
  };
}

export interface SendGroupMessageDTO {
  id?: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderTeluguName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: GroupMediaType;
  timestamp?: number;
}

export class GroupMessageService {
  /**
   * Seed default Telugu community group if not already in database
   */
  async ensureDefaultGroupSeeded(): Promise<void> {
    try {
      const existing = await ChatGroupModel.findOne({ id: 'telugu' }).lean();
      if (!existing) {
        await ChatGroupModel.create({
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
    } catch (err) {
      console.warn('[GroupMessageService] Error seeding default group:', err);
    }
  }

  /**
   * List all available groups with real-time last message and accurate member counts
   */
  async getGroups(): Promise<GroupItem[]> {
    await this.ensureDefaultGroupSeeded();

    const dbGroups = await ChatGroupModel.find({}).sort({ createdAt: 1 }).lean();
    const totalUsers = await UserModel.countDocuments().catch(() => 0);

    const groups: GroupItem[] = await Promise.all(
      dbGroups.map(async (grp) => {
        const latestMsg = await groupMessageRepository.getLatestMessage(grp.id);
        let memberCount = 1;
        if (grp.isPublic) {
          memberCount = Math.max(totalUsers, grp.customMemberCount || 1);
        } else {
          const uniqueSenders = await GroupMessageModel.distinct('senderId', { groupId: grp.id });
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
          memberCount,
          lastMessage: latestMsg
            ? {
                text: latestMsg.text,
                senderName: latestMsg.senderName,
                timestamp: latestMsg.timestamp,
              }
            : undefined,
        };
      })
    );

    return groups;
  }

  /**
   * Fetch paginated message history for a group
   */
  async getMessages(
    groupId: string,
    limit = 50,
    before?: number,
    viewerUserId?: string
  ): Promise<IGroupMessage[]> {
    let excludeForIds: string[] | undefined;
    if (viewerUserId) {
      const dbUser = await messageService.resolveUser(String(viewerUserId).trim());
      excludeForIds = messageService.getCanonicalIdsForUser(String(viewerUserId).trim(), dbUser);
    }
    return await groupMessageRepository.findMessagesByGroup(groupId, limit, before, excludeForIds);
  }

  /**
   * Send a new message to a group and broadcast to all members in real time
   */
  async sendGroupMessage(dto: SendGroupMessageDTO, exceptSocketId?: string): Promise<IGroupMessage> {
    const targetGroupId = (dto.groupId || 'telugu').toLowerCase().trim();

    // Prevent sending messages to groups that are temporarily on hold
    const grp = await ChatGroupModel.findOne({ id: targetGroupId }).lean();
    if (grp && grp.isHold) {
      const holdErr: any = new Error(
        grp.holdReason || 'ఈ గ్రూప్ ప్రస్తుతం అడ్మినిస్ట్రేటర్ ద్వారా తాత్కాలికంగా హోల్డ్‌లో ఉంచబడింది (This group is temporarily on hold)'
      );
      holdErr.isHold = true;
      holdErr.statusCode = 403;
      throw holdErr;
    }

    const messageId = dto.id || `gmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = dto.timestamp || Date.now();

    const created = await groupMessageRepository.createMessage({
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

    const serialized = created.toObject ? created.toObject() : created;

    // Real-time broadcast to all connected clients in the group room
    try {
      const room = `group_${dto.groupId || 'telugu'}`;
      if (exceptSocketId) {
        socketManager.getIO().to(room).except(exceptSocketId).emit('group:message', {
          groupId: dto.groupId || 'telugu',
          message: serialized,
        });
      } else {
        socketManager.getIO().to(room).emit('group:message', {
          groupId: dto.groupId || 'telugu',
          message: serialized,
        });
      }
    } catch (err) {
      console.warn('[GroupMessageService] Socket broadcast error:', err);
    }

    return created;
  }

  /**
   * Ensure only the original sender can modify/delete their own group message
   */
  private async assertGroupMessageSender(
    myId: string,
    msg: any,
    action: string
  ): Promise<{ dbMe: any; myIdsList: string[] }> {
    const cleanMyId = String(myId).trim();
    const dbMe = await messageService.resolveUser(cleanMyId);
    const myIdsList = messageService.getCanonicalIdsForUser(cleanMyId, dbMe);
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
  async editGroupMessage(
    myId: string,
    messageId: string,
    newText: string
  ): Promise<any> {
    const trimmed = String(newText || '').trim();
    if (!trimmed) {
      throw new Error('Updated message text is required');
    }

    const msg = await groupMessageRepository.findMessageById(messageId);
    if (!msg) {
      throw new Error('Message not found');
    }

    await this.assertGroupMessageSender(myId, msg, 'edit');

    const editedAt = Date.now();
    const updated = await groupMessageRepository.updateMessageText(messageId, trimmed, editedAt);
    const gid = (msg.groupId || 'telugu').toLowerCase();
    const room = `group_${gid}`;

    try {
      socketManager.getIO().to(room).emit('group:message-edited', {
        groupId: gid,
        messageId,
        text: trimmed,
        isEdited: true,
        editedAt,
        message: updated || { ...msg, text: trimmed, isEdited: true, editedAt },
      });
    } catch (err) {
      console.warn('[GroupMessageService] Socket edit broadcast error:', err);
    }

    return updated;
  }

  /**
   * Unsend a group message for everyone (sender only)
   */
  async unsendGroupMessage(
    myId: string,
    messageId: string
  ): Promise<{ success: boolean; messageId: string; deletedCount: number }> {
    const msg = await groupMessageRepository.findMessageById(messageId);
    if (!msg) {
      return { success: true, messageId, deletedCount: 0 };
    }

    await this.assertGroupMessageSender(myId, msg, 'unsend');

    const deletedCount = await groupMessageRepository.deleteMessageById(messageId);
    const gid = (msg.groupId || 'telugu').toLowerCase();
    const room = `group_${gid}`;

    try {
      socketManager.getIO().to(room).emit('group:message-unsent', {
        groupId: gid,
        messageId,
      });
    } catch (err) {
      console.warn('[GroupMessageService] Socket unsend broadcast error:', err);
    }

    return { success: true, messageId, deletedCount };
  }

  /**
   * Delete a group message only from the sender's side (sender only)
   */
  async deleteGroupMessageForMe(
    myId: string,
    messageId: string
  ): Promise<{ success: boolean; messageId: string }> {
    const msg = await groupMessageRepository.findMessageById(messageId);
    if (!msg) {
      return { success: true, messageId };
    }

    const cleanMyId = String(myId).trim();
    const { dbMe, myIdsList } = await this.assertGroupMessageSender(cleanMyId, msg, 'delete');

    await groupMessageRepository.markDeletedForUser(messageId, myIdsList);

    const gid = (msg.groupId || 'telugu').toLowerCase();
    try {
      socketManager.emitToUser(cleanMyId, 'group:message-deleted-for-me', {
        groupId: gid,
        messageId,
      });
      if (dbMe?._id) {
        socketManager.emitToUser(String(dbMe._id), 'group:message-deleted-for-me', {
          groupId: gid,
          messageId,
        });
      }
    } catch {}

    return { success: true, messageId };
  }

  /**
   * Admin: List all groups with detailed analytics
   */
  async getAllGroupsAdmin(): Promise<any[]> {
    await this.ensureDefaultGroupSeeded();
    const dbGroups = await ChatGroupModel.find({}).sort({ createdAt: -1 }).lean();
    const totalUsers = await UserModel.countDocuments().catch(() => 0);

    return await Promise.all(
      dbGroups.map(async (grp) => {
        const [totalMessages, latestMsg, uniqueParticipants] = await Promise.all([
          groupMessageRepository.countMessages(grp.id),
          groupMessageRepository.getLatestMessage(grp.id),
          GroupMessageModel.distinct('senderId', { groupId: grp.id }),
        ]);

        const memberCount = grp.isPublic
          ? Math.max(totalUsers, grp.customMemberCount || 1)
          : Math.max(uniqueParticipants.length, grp.customMemberCount || 1);

        return {
          ...grp,
          totalMessages,
          uniqueParticipantsCount: uniqueParticipants.length,
          memberCount,
          calculatedMemberCount: memberCount,
          lastActiveAt: latestMsg ? new Date(latestMsg.timestamp).toISOString() : grp.updatedAt,
        };
      })
    );
  }

  /**
   * Admin: Create a new chat group
   */
  async createGroup(data: {
    id: string;
    name: string;
    teluguName: string;
    description?: string;
    avatar?: string;
    category?: string;
    isPublic?: boolean;
    rules?: string;
    customMemberCount?: number;
  }): Promise<IChatGroup> {
    const slug = data.id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    if (!slug) {
      throw new Error('Valid group slug ID is required (e.g. cinema, hyderabad)');
    }

    const existing = await ChatGroupModel.findOne({ id: slug });
    if (existing) {
      throw new Error(`Group with ID "${slug}" already exists`);
    }

    const newGroup = await ChatGroupModel.create({
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
      socketManager.getIO().emit('group:created', { group: newGroup.toObject() });
    } catch {}

    return newGroup;
  }

  /**
   * Admin: Update group details
   */
  async updateGroup(groupId: string, data: Partial<IChatGroup>): Promise<IChatGroup> {
    const group = await ChatGroupModel.findOne({ id: groupId.toLowerCase().trim() });
    if (!group) {
      throw new Error(`Group "${groupId}" not found`);
    }

    if (data.name !== undefined) group.name = data.name.trim();
    if (data.teluguName !== undefined) group.teluguName = data.teluguName.trim();
    if (data.description !== undefined) group.description = data.description.trim();
    if (data.avatar !== undefined) group.avatar = data.avatar.trim();
    if (data.category !== undefined) group.category = data.category.trim();
    if (data.isPublic !== undefined) group.isPublic = Boolean(data.isPublic);
    if (data.rules !== undefined) group.rules = data.rules.trim();
    if (data.customMemberCount !== undefined) group.customMemberCount = Number(data.customMemberCount);

    await group.save();

    try {
      socketManager.getIO().emit('group:updated', { group: group.toObject() });
    } catch {}

    return group;
  }

  /**
   * Admin: Toggle temporary hold / pause status on a group
   */
  async toggleGroupHold(groupId: string, isHold: boolean, holdReason?: string, adminActor?: string): Promise<IChatGroup> {
    const group = await ChatGroupModel.findOne({ id: groupId.toLowerCase().trim() });
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
      socketManager.getIO().emit('group:hold-changed', {
        groupId: group.id,
        isHold: group.isHold,
        holdReason: group.holdReason,
      });
      socketManager.getIO().to(room).emit('group:hold-changed', {
        groupId: group.id,
        isHold: group.isHold,
        holdReason: group.holdReason,
      });
    } catch {}

    return group;
  }

  /**
   * Admin: Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    const slug = groupId.toLowerCase().trim();
    if (slug === 'telugu') {
      throw new Error('Default public Telugu community group cannot be deleted');
    }

    const group = await ChatGroupModel.findOne({ id: slug });
    if (!group) {
      throw new Error(`Group "${slug}" not found`);
    }

    await ChatGroupModel.deleteOne({ id: slug });

    try {
      socketManager.getIO().emit('group:deleted', { groupId: slug });
    } catch {}
  }

  /**
   * Admin: Clear all messages in a group
   */
  async clearGroupMessages(groupId: string): Promise<number> {
    const slug = groupId.toLowerCase().trim();
    const result = await GroupMessageModel.deleteMany({ groupId: slug });
    const room = `group_${slug}`;
    try {
      socketManager.getIO().to(room).emit('group:messages-cleared', { groupId: slug });
    } catch {}
    return result.deletedCount || 0;
  }

  /**
   * Get members of a chat group with scroll-based pagination and search
   */
  async getGroupMembers(
    groupId: string,
    options: { page?: number; limit?: number; q?: string } = {}
  ): Promise<{
    members: any[];
    totalMembers: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const slug = (groupId || 'telugu').toLowerCase().trim();
    await this.ensureDefaultGroupSeeded();

    const page = Math.max(1, parseInt(String(options.page || 1), 10));
    const limit = Math.min(Math.max(1, parseInt(String(options.limit || 20), 10)), 60);
    const skip = (page - 1) * limit;

    const filter: any = { moderationStatus: { $ne: 'banned' } };

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

    const onlineUserIds = new Set(
      socketManager.getOnlineUserIds().map((id: string) => String(id).toLowerCase())
    );

    const [totalMembers, dbUsers] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.find(filter)
        .select('name teluguName handle mitraId avatar bio teluguBio location isVerified role isAdmin lastSeen createdAt')
        .sort({ isVerified: -1, lastSeen: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const members = dbUsers.map((u: any) => {
      const uid = u._id ? u._id.toString() : '';
      const handleClean = (u.handle || u.mitraId || '').toLowerCase();
      const isOnline = onlineUserIds.has(uid.toLowerCase()) || (handleClean ? onlineUserIds.has(handleClean) : false);

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
        role: u.isAdmin || u.role === 'admin' ? 'admin' : 'member',
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

export const groupMessageService = new GroupMessageService();

