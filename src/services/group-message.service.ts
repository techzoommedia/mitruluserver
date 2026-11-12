import { groupMessageRepository } from '../repositories/group-message.repository';
import { IGroupMessage, GroupMediaType } from '../models/group-message.model';
import { socketManager } from '../sockets/socket.manager';
import { messageService } from './message.service';

export interface GroupItem {
  id: string;
  name: string;
  teluguName: string;
  description: string;
  avatar: string;
  isPublic: boolean;
  category: string;
  memberCount: number;
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
   * List all available groups with real-time last message
   */
  async getGroups(): Promise<GroupItem[]> {
    // Default public Telugu group
    const latestTeluguMsg = await groupMessageRepository.getLatestMessage('telugu');
    const teluguMsgCount = await groupMessageRepository.countMessages('telugu');

    const teluguGroup: GroupItem = {
      id: 'telugu',
      name: 'Telugu',
      teluguName: 'మన తెలుగు',
      description: 'మన తెలుగు ప్రజల పబ్లిక్ గ్రూప్ • ఇక్కడ అందరూ కలిసి సరదాగా చాట్ చేసుకోవచ్చు',
      avatar: '/mitrulu-logo.webp',
      isPublic: true,
      category: 'Community',
      memberCount: Math.max(120, socketManager.getActiveSocketsCount() + 85),
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
    const messageId = dto.id || `gmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = dto.timestamp || Date.now();

    const created = await groupMessageRepository.createMessage({
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

    const dbMe = await messageService.resolveUser(String(myId).trim());
    const myIdsLower = new Set(
      messageService.getCanonicalIdsForUser(String(myId).trim(), dbMe).map((s) => s.toLowerCase())
    );

    const msgSenderId = String(msg.senderId || '').toLowerCase();
    const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
    const isSender = myIdsLower.has(msgSenderId) || (msgSenderHandle && myIdsLower.has(msgSenderHandle));
    if (!isSender) {
      throw new Error('Forbidden: Only the sender can edit this message');
    }

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

    const dbMe = await messageService.resolveUser(String(myId).trim());
    const myIdsLower = new Set(
      messageService.getCanonicalIdsForUser(String(myId).trim(), dbMe).map((s) => s.toLowerCase())
    );

    const msgSenderId = String(msg.senderId || '').toLowerCase();
    const msgSenderHandle = String(msg.senderHandle || '').toLowerCase().replace(/^@/, '');
    const isSender = myIdsLower.has(msgSenderId) || (msgSenderHandle && myIdsLower.has(msgSenderHandle));
    if (!isSender) {
      throw new Error('Forbidden: Only the sender can unsend this message');
    }

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
   * Delete a group message only from the current user's side
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
    const dbMe = await messageService.resolveUser(cleanMyId);
    const myIdsList = messageService.getCanonicalIdsForUser(cleanMyId, dbMe);

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
}

export const groupMessageService = new GroupMessageService();

