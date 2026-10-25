import { ICommunityRoomRepository, communityRoomRepository } from '../repositories/community-room.repository';
import { IUserRepository, userRepository } from '../repositories/user.repository';
import { liveKitService } from './livekit.service';
import { communityRoomStoreService } from './room-store.service';
import { LIVEKIT_URL } from '../config/env';

export interface IMappedCommunityRoom {
  id: string;
  roomId: string;
  name: string;
  teluguTitle: string;
  language: string;
  type: 'audio' | 'video';
  topic: string;
  avatar: string;
  isStopped: boolean;
  stoppedReason: string;
  admins: string[];
  activeParticipants: number;
  maxParticipants: number;
  costCoins: number;
  tags: string[];
}

export class CommunityRoomService {
  private roomRepo: ICommunityRoomRepository;
  private userRepo: IUserRepository;
  private cachedRooms: IMappedCommunityRoom[] = [];

  constructor(
    roomRepo: ICommunityRoomRepository = communityRoomRepository,
    userRepo: IUserRepository = userRepository
  ) {
    this.roomRepo = roomRepo;
    this.userRepo = userRepo;
  }

  getCachedRooms(): IMappedCommunityRoom[] {
    return this.cachedRooms;
  }

  setCachedRooms(rooms: IMappedCommunityRoom[]): void {
    this.cachedRooms = rooms;
  }

  async fetchCommunityRoomsWithCounts(force = false): Promise<IMappedCommunityRoom[]> {
    try {
      const [dbRooms, livekitCounts] = await Promise.all([
        this.roomRepo.findAll(),
        liveKitService.getRoomParticipantCounts(force),
      ]);

      const mappedRooms: IMappedCommunityRoom[] = dbRooms.map((r: any) => {
        const rId = r.roomId || r.id;
        const dbId = r._id ? r._id.toString() : '';

        // Live count from LiveKit Cloud or in-memory CommunityRoomStore (0ms instant)
        const localCount = communityRoomStoreService.getParticipantCount(rId);
        const liveCount = Math.max(
          (dbId ? livekitCounts.get(`circle_comm_${dbId}`) : 0) || 0,
          (rId ? livekitCounts.get(`circle_comm_${rId}`) : 0) || 0,
          (rId ? livekitCounts.get(rId) : 0) || 0,
          (dbId ? livekitCounts.get(dbId) : 0) || 0,
          localCount,
          0
        );

        return {
          id: rId,
          roomId: rId,
          name: r.name,
          teluguTitle: r.teluguTitle,
          language: r.language || 'Telugu',
          type: r.type || 'audio',
          topic: r.topic || '',
          avatar: r.avatar,
          isStopped: Boolean(r.isStopped),
          stoppedReason: r.stoppedReason || '',
          admins: r.admins || [],
          activeParticipants: liveCount,
          maxParticipants: r.maxParticipants || 50,
          costCoins: r.costCoins || 0,
          tags: r.tags || [],
        };
      });

      if (mappedRooms.length > 0) {
        this.cachedRooms = mappedRooms;
      }
      return mappedRooms;
    } catch (err) {
      console.warn('[fetchCommunityRoomsWithCounts Error]:', err);
      return this.cachedRooms;
    }
  }

  async joinRoom(userId: string, roomId: string) {
    let room = await this.roomRepo.findByRoomId(roomId);
    if (!room) {
      // Auto-create room if not found
      room = await this.roomRepo.create({
        roomId,
        name: 'Community Room',
        teluguTitle: 'కమ్యూనిటీ రూమ్',
        language: 'Telugu',
        type: 'audio',
        topic: '',
        avatar: '',
        isStopped: false,
        admins: [],
        tags: [],
        maxParticipants: 50,
        costCoins: 0,
      });
    }

    if (room.isStopped) {
      const err: any = new Error(
        room.stoppedReason ||
          'ఈ కమ్యూనిటీ రూమ్ అడ్మిన్ ద్వారా తాత్కాలికంగా ఆపబడింది (This community room has been stopped by admin).'
      );
      err.isStopped = true;
      err.statusCode = 403;
      throw err;
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    // Register active participant in room session
    const targetRoomId = room.roomId || roomId;
    communityRoomStoreService.join(targetRoomId, {
      id: user._id.toString(),
      name: user.name || user.handle || 'Member',
      teluguName: user.teluguName,
      handle: user.handle || 'member',
      avatar: user.avatar || '',
      role: 'speaker',
      isMuted: false,
      isRestricted: false,
      isVideoOff: false,
      joinedAt: Date.now(),
    });

    const livekitRoomName = `circle_comm_${room.id || room.roomId}`;
    const token = await liveKitService.generateCommunityToken(
      user._id.toString(),
      user.name || user.handle || 'Member',
      livekitRoomName
    );

    return {
      success: true,
      room,
      roomName: livekitRoomName,
      token,
      serverUrl: LIVEKIT_URL,
      costCoins: 0,
      remainingCoins: user.coins || 0,
    };
  }

  getRoomActions(roomId: string, callerUserId?: string) {
    if (!roomId) {
      throw new Error('roomId is required');
    }

    const room = communityRoomStoreService.getRoom(roomId, callerUserId);
    const participants = communityRoomStoreService.getSortedParticipants(roomId, callerUserId);

    return {
      success: true,
      roomId,
      adminId: room.adminId,
      memberCount: participants.length,
      speakingCount: participants.filter((p) => !p.isMuted).length,
      participants,
      blockedUserIds: Array.from(room.blockedUserIds),
    };
  }

  handleRoomAction(body: any) {
    const { roomId, action, participant, targetUserId, actorUserId } = body;
    if (!roomId || !action) {
      throw new Error('roomId and action are required');
    }

    const room = communityRoomStoreService.getRoom(roomId, actorUserId);
    const checkingUserId = participant?.id || actorUserId;
    if (checkingUserId && room.blockedUserIds.has(checkingUserId)) {
      const err: any = new Error('You have been permanently blocked from this group call by the admin.');
      err.isBlocked = true;
      err.statusCode = 403;
      throw err;
    }

    switch (action) {
      case 'join': {
        if (!participant || !participant.id) {
          throw new Error('participant data required');
        }
        const result = communityRoomStoreService.join(roomId, {
          id: participant.id,
          name: participant.name || 'User',
          teluguName: participant.teluguName,
          handle: participant.handle || 'user',
          avatar:
            participant.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
          role: participant.role || (room.participants.size === 0 ? 'host' : 'speaker'),
          isMuted: Boolean(participant.isMuted),
          isRestricted: false,
          isVideoOff: Boolean(participant.isVideoOff),
          joinedAt: Date.now(),
        });
        if (!result.success) {
          const err: any = new Error(result.error);
          err.isBlocked = result.isBlocked;
          err.statusCode = 403;
          throw err;
        }
        break;
      }

      case 'leave': {
        const uid = targetUserId || actorUserId;
        if (uid) {
          communityRoomStoreService.leave(roomId, uid);
        }
        break;
      }

      case 'terminate': {
        communityRoomStoreService.clearRoom(roomId);
        break;
      }

      case 'self_mute': {
        const p = room.participants.get(actorUserId);
        if (p) {
          if (p.isRestricted && body.isMuted === false) {
            const err: any = new Error('You are restricted from speaking by the group admin.');
            err.statusCode = 403;
            throw err;
          }
          p.isMuted = typeof body.isMuted === 'boolean' ? body.isMuted : !p.isMuted;
          p.lastSeen = Date.now();
        }
        break;
      }

      case 'self_video': {
        const p = room.participants.get(actorUserId);
        if (p) {
          p.isVideoOff = typeof body.isVideoOff === 'boolean' ? body.isVideoOff : !p.isVideoOff;
          p.lastSeen = Date.now();
        }
        break;
      }

      case 'mute': {
        if (!targetUserId) throw new Error('targetUserId required');
        const target = room.participants.get(targetUserId);
        if (target) {
          target.isMuted = true;
          target.isRestricted = true;
        }
        break;
      }

      case 'unmute': {
        if (!targetUserId) throw new Error('targetUserId required');
        const target = room.participants.get(targetUserId);
        if (target) {
          target.isMuted = false;
          target.isRestricted = false;
        }
        break;
      }

      case 'remove': {
        if (!targetUserId) throw new Error('targetUserId required');
        communityRoomStoreService.leave(roomId, targetUserId);
        break;
      }

      case 'block': {
        if (!targetUserId) throw new Error('targetUserId required');
        room.blockedUserIds.add(targetUserId);
        communityRoomStoreService.leave(roomId, targetUserId);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const participants = communityRoomStoreService.getSortedParticipants(roomId, actorUserId);
    return {
      success: true,
      action,
      adminId: room.adminId,
      memberCount: participants.length,
      speakingCount: participants.filter((p) => !p.isMuted).length,
      participants,
      blockedUserIds: Array.from(room.blockedUserIds),
    };
  }
}

export const communityRoomService = new CommunityRoomService();
