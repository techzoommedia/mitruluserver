export interface RoomParticipantState {
  id: string;
  name: string;
  teluguName?: string;
  handle: string;
  avatar: string;
  role: 'admin' | 'host' | 'speaker' | 'listener';
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

const PARTICIPANT_STALE_TIMEOUT_MS = 45000;

export class CommunityRoomStoreService {
  private rooms = new Map<string, RoomData>();
  private roomAliases = new Map<string, string>();

  registerAlias(alias: string, canonicalRoomId: string): void {
    if (alias && canonicalRoomId && alias !== canonicalRoomId) {
      this.roomAliases.set(alias, canonicalRoomId);
      // If data was already placed in alias room, merge it into canonical room
      if (this.rooms.has(alias)) {
        const aliasRoom = this.rooms.get(alias)!;
        const canonicalRoom = this.getOrCreateRoom(canonicalRoomId, aliasRoom.adminId);
        for (const [uid, p] of aliasRoom.participants.entries()) {
          canonicalRoom.participants.set(uid, p);
        }
        for (const buid of aliasRoom.blockedUserIds) {
          canonicalRoom.blockedUserIds.add(buid);
        }
        this.rooms.delete(alias);
      }
    }
  }

  getCanonicalId(roomId: string): string {
    const clean = String(roomId || '').replace(/^circle_comm_/, '');
    return this.roomAliases.get(clean) || this.roomAliases.get(roomId) || clean;
  }

  private resolveRoomId(roomId: string): string {
    const clean = String(roomId || '').replace(/^circle_comm_/, '');
    return this.roomAliases.get(clean) || this.roomAliases.get(roomId) || clean;
  }

  private getOrCreateRoom(roomId: string, initialAdminId?: string): RoomData {
    const rId = this.resolveRoomId(roomId);
    if (!this.rooms.has(rId)) {
      this.rooms.set(rId, {
        participants: new Map(),
        blockedUserIds: new Set(),
        adminId: initialAdminId || '',
      });
    }
    const room = this.rooms.get(rId)!;
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
    const rId = this.resolveRoomId(roomId);
    const room = this.getOrCreateRoom(rId, initialAdminId);
    if (callerUserId && room.participants.has(callerUserId)) {
      room.participants.get(callerUserId)!.lastSeen = Date.now();
    }
    this.pruneStale(room);
    return room;
  }

  join(roomId: string, participant: Omit<RoomParticipantState, 'lastSeen'>) {
    const rId = this.resolveRoomId(roomId);
    const room = this.getOrCreateRoom(rId, participant.id);
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
    if (!roomId || !userId) return;
    const rId = this.resolveRoomId(roomId);
    const cleanUid = String(userId);
    if (this.rooms.has(rId)) {
      const room = this.rooms.get(rId)!;
      room.participants.delete(cleanUid);
      for (const [id, p] of room.participants.entries()) {
        if (id === cleanUid || p.id === cleanUid || (p.handle && p.handle === cleanUid)) {
          room.participants.delete(id);
        }
      }
      this.pruneStale(room);
    }
  }

  removeUserFromAllRooms(userId: string): string[] {
    const affectedRooms: string[] = [];
    if (!userId) return affectedRooms;
    const cleanUid = String(userId);
    for (const [roomId, room] of this.rooms.entries()) {
      let removed = false;
      if (room.participants.has(cleanUid)) {
        room.participants.delete(cleanUid);
        removed = true;
      }
      for (const [id, p] of room.participants.entries()) {
        if (id === cleanUid || p.id === cleanUid || (p.handle && p.handle === cleanUid)) {
          room.participants.delete(id);
          removed = true;
        }
      }
      if (removed) {
        this.pruneStale(room);
        affectedRooms.push(roomId);
      }
    }
    return affectedRooms;
  }

  heartbeat(roomId: string, userId?: string): boolean {
    if (!roomId) return false;
    const rId = this.resolveRoomId(roomId);
    const room = this.getOrCreateRoom(rId);
    let found = false;
    if (userId && room.participants.has(userId)) {
      room.participants.get(userId)!.lastSeen = Date.now();
      found = true;
    }
    this.pruneStale(room);
    return found;
  }

  getParticipantCount(roomId: string): number {
    const rId = this.resolveRoomId(roomId);
    if (!this.rooms.has(rId)) return 0;
    const room = this.rooms.get(rId)!;
    this.pruneStale(room);
    return room.participants.size;
  }

  getSortedParticipants(roomId: string, callerUserId?: string): RoomParticipantState[] {
    const room = this.getRoom(roomId, callerUserId);
    const list = Array.from(room.participants.values());
    const priority: Record<string, number> = { admin: 0, host: 1, speaker: 2, listener: 3 };
    return list.sort((a, b) => (priority[a.role] ?? 4) - (priority[b.role] ?? 4));
  }

  clearRoom(roomId: string) {
    const rId = this.resolveRoomId(roomId);
    if (this.rooms.has(rId)) {
      this.rooms.get(rId)!.participants.clear();
    }
  }
}

export const communityRoomStoreService = new CommunityRoomStoreService();
