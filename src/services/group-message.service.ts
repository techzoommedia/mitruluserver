import { groupMessageRepository } from '../repositories/group-message.repository';
import { IGroupMessage, GroupMediaType } from '../models/group-message.model';
import { socketManager } from '../sockets/socket.manager';

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
    before?: number
  ): Promise<IGroupMessage[]> {
    return await groupMessageRepository.findMessagesByGroup(groupId, limit, before);
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
}

export const groupMessageService = new GroupMessageService();

