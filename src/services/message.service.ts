import { messageRepository } from '../repositories/message.repository';
import { buildConversationKey, IDirectMessage, MessageStatus } from '../models/message.model';
import { UserModel, IUser } from '../models/user.model';
import { socketManager } from '../sockets/socket.manager';

export interface SendMessageDTO {
  id?: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderTeluguName?: string;
  targetUserId: string;
  targetUserName?: string;
  targetUserAvatar?: string;
  targetUserHandle?: string;
  targetUserTeluguName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  audioDuration?: number;
  timestamp?: number;
  status?: MessageStatus;
}

export class MessageService {
  /**
   * Resolve any user identifier (MongoDB _id, handle, mitraId) into a canonical DB User
   */
  async resolveUser(identifier: string): Promise<any> {
    if (!identifier) return null;
    const clean = identifier.replace(/^@/, '').trim();
    const isObjectId = clean.match(/^[0-9a-fA-F]{24}$/);

    const conditions: any[] = [];
    if (isObjectId) conditions.push({ _id: clean });
    conditions.push({ mitraId: new RegExp(`^${clean}$`, 'i') });
    conditions.push({ handle: new RegExp(`^${clean}$`, 'i') });

    return UserModel.findOne({ $or: conditions }).lean().exec();
  }

  /**
   * Send and persist a new message with real-time socket transmission and ACK
   */
  async sendMessage(data: SendMessageDTO, senderSocketId?: string): Promise<any> {
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

    const convKey = buildConversationKey(canonicalSenderId, canonicalTargetId);
    const messageId = data.id || `dm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();

    // Check if target user is online in the socket network
    const onlineIds = socketManager.getOnlineUserIds();
    const isTargetOnline =
      onlineIds.includes(canonicalTargetId) ||
      onlineIds.includes(cleanTargetId) ||
      (dbTarget?.handle && onlineIds.includes(dbTarget.handle)) ||
      (dbTarget?.mitraId && onlineIds.includes(dbTarget.mitraId));

    const initialStatus: MessageStatus = data.status || (isTargetOnline ? 'delivered' : 'sent');

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
    const saved = await messageRepository.upsertMessage(messageToSave as any);

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
    socketManager.emitToUser(canonicalTargetId, 'direct:message', payload);
    if (cleanTargetId !== canonicalTargetId) {
      socketManager.emitToUser(cleanTargetId, 'direct:message', payload);
    }
    if (dbTarget?.handle) {
      socketManager.emitToUser(dbTarget.handle, 'direct:message', payload);
    }
    if (dbTarget?.mitraId) {
      socketManager.emitToUser(dbTarget.mitraId, 'direct:message', payload);
    }

    // Echo to sender's other sockets (multi-tab / mobile + web synchronization)
    socketManager.emitToUser(canonicalSenderId, 'direct:message', payload, senderSocketId);
    if (cleanSenderId !== canonicalSenderId) {
      socketManager.emitToUser(cleanSenderId, 'direct:message', payload, senderSocketId);
    }

    // If target was online, also deliver status receipt to sender
    if (initialStatus === 'delivered') {
      socketManager.emitToUser(canonicalSenderId, 'direct:status', {
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
  async getMessages(
    myId: string,
    partnerId: string,
    limit = 30,
    before?: number
  ): Promise<{ messages: any[]; hasMore: boolean; nextCursor: number | null }> {
    const cleanMyId = String(myId).trim();
    const cleanPartnerId = String(partnerId).trim();

    const [dbSender, dbPartner] = await Promise.all([
      this.resolveUser(cleanMyId),
      this.resolveUser(cleanPartnerId),
    ]);

    const canonicalMyId = dbSender ? String(dbSender._id) : cleanMyId;
    const myCanonicalIds = new Set<string>();
    myCanonicalIds.add(cleanMyId.toLowerCase());
    myCanonicalIds.add(canonicalMyId.toLowerCase());
    if (dbSender) {
      if (dbSender.mitraId) myCanonicalIds.add(dbSender.mitraId.toLowerCase());
      if (dbSender.handle) myCanonicalIds.add(dbSender.handle.toLowerCase());
    }

    const partnerCanonicalIds = new Set<string>();
    partnerCanonicalIds.add(cleanPartnerId.toLowerCase());
    if (dbPartner) {
      partnerCanonicalIds.add(String(dbPartner._id).toLowerCase());
      if (dbPartner.mitraId) partnerCanonicalIds.add(dbPartner.mitraId.toLowerCase());
      if (dbPartner.handle) partnerCanonicalIds.add(dbPartner.handle.toLowerCase());
    }

    // Build all candidate conversation keys
    const conversationKeys: string[] = [];
    for (const m of myCanonicalIds) {
      for (const p of partnerCanonicalIds) {
        conversationKeys.push(buildConversationKey(m, p));
      }
    }

    const query: any = {
      $or: [
        { conversationKey: { $in: conversationKeys } },
        {
          $and: [
            { senderId: { $in: [...Array.from(myCanonicalIds), ...Array.from(partnerCanonicalIds)] } },
            { targetUserId: { $in: [...Array.from(myCanonicalIds), ...Array.from(partnerCanonicalIds)] } },
          ],
        },
      ],
    };

    const maxLimit = Math.min(Math.max(limit, 5), 100);
    const docs = await messageRepository.findMessages(query, maxLimit + 1, before);

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
  async getConversations(myId: string): Promise<any[]> {
    const cleanMyId = String(myId).trim();
    const dbMe = await this.resolveUser(cleanMyId);
    const canonicalMyId = dbMe ? String(dbMe._id) : cleanMyId;

    const myCanonicalIds = new Set<string>();
    myCanonicalIds.add(canonicalMyId);
    myCanonicalIds.add(cleanMyId);
    if (dbMe) {
      if (dbMe.handle) myCanonicalIds.add(dbMe.handle);
      if (dbMe.mitraId) myCanonicalIds.add(dbMe.mitraId);
    }
    const myIdsList = Array.from(myCanonicalIds);

    const recentMessages = await messageRepository.aggregateConversations(myIdsList);

    const partnerIdMap = new Map<string, any>();
    const partnerObjectIds: string[] = [];
    const partnerHandles: string[] = [];

    for (const item of recentMessages) {
      const msg = item.lastMessage;
      const isMeSender = myCanonicalIds.has(String(msg.senderId));
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
        partnerObjectIds.push(partnerId);
      } else if (partnerId) {
        partnerHandles.push(partnerId);
      }
    }

    if (partnerObjectIds.length > 0 || partnerHandles.length > 0) {
      const orConditions: any[] = [];
      if (partnerObjectIds.length > 0) orConditions.push({ _id: { $in: partnerObjectIds } });
      if (partnerHandles.length > 0) {
        orConditions.push({ handle: { $in: partnerHandles } });
        orConditions.push({ mitraId: { $in: partnerHandles } });
      }

      const dbUsers: any[] = await UserModel.find({ $or: orConditions })
        .select('_id name teluguName handle mitraId avatar isVerified isOnline location lastSeen')
        .lean();

      const userById = new Map<string, any>();
      for (const u of dbUsers) {
        userById.set(String(u._id), u);
        if (u.handle) userById.set(String(u.handle).toLowerCase(), u);
        if (u.mitraId) userById.set(String(u.mitraId).toLowerCase(), u);
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
  async updateStatus(
    myId: string,
    partnerId: string,
    status: MessageStatus,
    messageId?: string
  ): Promise<{ success: boolean; modifiedCount: number }> {
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
      if (dbPartner.mitraId) partnerCanonicalIds.push(dbPartner.mitraId);
      if (dbPartner.handle) partnerCanonicalIds.push(dbPartner.handle);
    }

    const filter: any = {
      targetUserId: canonicalMyId,
      senderId: { $in: partnerCanonicalIds },
    };

    if (messageId) {
      filter.id = String(messageId);
    }

    if (status === 'delivered') {
      filter.status = { $nin: ['delivered', 'seen'] };
    } else if (status === 'seen') {
      filter.status = { $ne: 'seen' };
    }

    const modifiedCount = await messageRepository.updateManyStatus(filter, status);

    // Broadcast status change to partner in realtime
    const statusPayload = {
      targetUserId: cleanPartnerId,
      senderId: canonicalMyId,
      messageId,
      status,
    };

    socketManager.emitToUser(cleanPartnerId, 'direct:status', statusPayload);
    if (dbPartner) {
      socketManager.emitToUser(String(dbPartner._id), 'direct:status', statusPayload);
      if (dbPartner.handle) socketManager.emitToUser(dbPartner.handle, 'direct:status', statusPayload);
    }

    return { success: true, modifiedCount };
  }

  /**
   * Automatically mark all pending sent messages as delivered when user reconnects
   */
  async markDeliveredForUser(userId: string): Promise<void> {
    const cleanUserId = String(userId).trim();
    const dbUser = await this.resolveUser(cleanUserId);
    const canonicalId = dbUser ? String(dbUser._id) : cleanUserId;

    const undelivered = await messageRepository.findMessages({
      targetUserId: canonicalId,
      status: 'sent',
    }, 100);

    if (undelivered.length === 0) return;

    await messageRepository.updateManyStatus(
      { targetUserId: canonicalId, status: 'sent' },
      'delivered'
    );

    // Group by sender and notify each sender that their messages reached destination
    const senders = new Set(undelivered.map((m: any) => m.senderId));
    senders.forEach((senderId) => {
      socketManager.emitToUser(senderId, 'direct:status', {
        targetUserId: senderId,
        senderId: canonicalId,
        status: 'delivered',
      });
    });
  }

  /**
   * Delete conversation between user and partner
   */
  async deleteConversation(myId: string, partnerId: string): Promise<{ success: boolean; deletedCount: number }> {
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
      if (dbPartner.mitraId) partnerCanonicalIds.push(dbPartner.mitraId);
      if (dbPartner.handle) partnerCanonicalIds.push(dbPartner.handle);
    }

    const keys = partnerCanonicalIds.map((pid) => buildConversationKey(canonicalMyId, pid));
    const deletedCount = await messageRepository.deleteConversation(keys, canonicalMyId, cleanPartnerId);

    return { success: true, deletedCount };
  }
}

export const messageService = new MessageService();
