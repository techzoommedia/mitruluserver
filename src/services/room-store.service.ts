export interface RoomParticipantState {
  id: string;
  name: string;
  teluguName?: string;
  handle: string;
  avatar: string;
  role: 'host' | 'speaker' | 'listener';
  isMuted: boolean;
  isRestricted: boolean;
  isVideoOff: boolean;
  joinedAt: number;
  lastSeen: number;
}

interface RoomData {
  participants: Map<string, RoomParticipantState>;
  blockedUserIds: Set<string>;
  adminId: string;
}

const PARTICIPANT_STALE_TIMEOUT_MS = 25000;

export class CommunityRoomStoreService {
  private rooms = new Map<string, RoomData>();

  private getOrCreateRoom(roomId: string, initialAdminId?: string): RoomData {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        participants: new Map(),
        blockedUserIds: new Set(),
        adminId: initialAdminId || '',
      });
    }
    const room = this.rooms.get(roomId)!;
    if (initialAdminId && !room.adminId) {
      room.adminId = initialAdminId;
    }
    return room;
  }

  private pruneStale(room: RoomData): void {
    const now = Date.now();
    for (const [userId, participant] of room.participants.entries()) {
      if (now - participant.lastSeen > PARTICIPANT_STALE_TIMEOUT_MS) {
        room.participants.delete(userId);
      }
    }
  }

  getRoom(roomId: string, callerUserId?: string, initialAdminId?: string): RoomData {
    const room = this.getOrCreateRoom(roomId, initialAdminId);
    if (callerUserId && room.participants.has(callerUserId)) {
      room.participants.get(callerUserId)!.lastSeen = Date.now();
    }
    this.pruneStale(room);
    return room;
  }

  join(roomId: string, participant: Omit<RoomParticipantState, 'lastSeen'>) {
    const room = this.getOrCreateRoom(roomId, participant.id);
    if (room.blockedUserIds.has(participant.id)) {
      return { success: false, isBlocked: true, error: 'User is blocked from this room' };
    }
    const role = participant.role || (room.participants.size === 0 ? 'host' : 'speaker');
    const full: RoomParticipantState = {
      ...participant,
      role,
      lastSeen: Date.now(),
    };
    room.participants.set(participant.id, full);
    this.pruneStale(room);
    return { success: true, participant: full, room };
  }

  leave(roomId: string, userId: string) {
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId)!;
      room.participants.delete(userId);
      this.pruneStale(room);
    }
  }

  removeUserFromAllRooms(userId: string): string[] {
    const affectedRooms: string[] = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.has(userId)) {
        room.participants.delete(userId);
        this.pruneStale(room);
        affectedRooms.push(roomId);
      }
    }
    return affectedRooms;
  }

  heartbeat(roomId: string, userId?: string) {
    if (!roomId) return;
    const room = this.getOrCreateRoom(roomId);
    if (userId && room.participants.has(userId)) {
      room.participants.get(userId)!.lastSeen = Date.now();
    }
    this.pruneStale(room);
  }

  getParticipantCount(roomId: string): number {
    if (!this.rooms.has(roomId)) return 0;
    const room = this.rooms.get(roomId)!;
    this.pruneStale(room);
    return room.participants.size;
  }

  getSortedParticipants(roomId: string, callerUserId?: string): RoomParticipantState[] {
    const room = this.getRoom(roomId, callerUserId);
    const list = Array.from(room.participants.values());
    const priority = { host: 0, speaker: 1, listener: 2 };
    return list.sort((a, b) => (priority[a.role] ?? 3) - (priority[b.role] ?? 3));
  }

  clearRoom(roomId: string) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId)!.participants.clear();
    }
  }
}

export const communityRoomStoreService = new CommunityRoomStoreService();
