"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.communityRoomStoreService = exports.CommunityRoomStoreService = void 0;
const PARTICIPANT_STALE_TIMEOUT_MS = 45000;
class CommunityRoomStoreService {
    rooms = new Map();
    roomAliases = new Map();
    registerAlias(alias, canonicalRoomId) {
        if (alias && canonicalRoomId && alias !== canonicalRoomId) {
            this.roomAliases.set(alias, canonicalRoomId);
            // If data was already placed in alias room, merge it into canonical room
            if (this.rooms.has(alias)) {
                const aliasRoom = this.rooms.get(alias);
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
    getCanonicalId(roomId) {
        const clean = String(roomId || '').replace(/^circle_comm_/, '');
        return this.roomAliases.get(clean) || this.roomAliases.get(roomId) || clean;
    }
    resolveRoomId(roomId) {
        const clean = String(roomId || '').replace(/^circle_comm_/, '');
        return this.roomAliases.get(clean) || this.roomAliases.get(roomId) || clean;
    }
    getOrCreateRoom(roomId, initialAdminId) {
        const rId = this.resolveRoomId(roomId);
        if (!this.rooms.has(rId)) {
            this.rooms.set(rId, {
                participants: new Map(),
                blockedUserIds: new Set(),
                adminId: initialAdminId || '',
            });
        }
        const room = this.rooms.get(rId);
        if (initialAdminId && !room.adminId) {
            room.adminId = initialAdminId;
        }
        return room;
    }
    pruneStale(room) {
        const now = Date.now();
        for (const [userId, participant] of room.participants.entries()) {
            if (now - participant.lastSeen > PARTICIPANT_STALE_TIMEOUT_MS) {
                room.participants.delete(userId);
            }
        }
    }
    getRoom(roomId, callerUserId, initialAdminId) {
        const rId = this.resolveRoomId(roomId);
        const room = this.getOrCreateRoom(rId, initialAdminId);
        if (callerUserId && room.participants.has(callerUserId)) {
            room.participants.get(callerUserId).lastSeen = Date.now();
        }
        this.pruneStale(room);
        return room;
    }
    join(roomId, participant) {
        const rId = this.resolveRoomId(roomId);
        const room = this.getOrCreateRoom(rId, participant.id);
        if (room.blockedUserIds.has(participant.id)) {
            return { success: false, isBlocked: true, error: 'User is blocked from this room' };
        }
        const role = participant.role || (room.participants.size === 0 ? 'host' : 'speaker');
        const full = {
            ...participant,
            role,
            lastSeen: Date.now(),
        };
        room.participants.set(participant.id, full);
        this.pruneStale(room);
        return { success: true, participant: full, room };
    }
    leave(roomId, userId) {
        if (!roomId || !userId)
            return;
        const rId = this.resolveRoomId(roomId);
        const cleanUid = String(userId);
        if (this.rooms.has(rId)) {
            const room = this.rooms.get(rId);
            room.participants.delete(cleanUid);
            for (const [id, p] of room.participants.entries()) {
                if (id === cleanUid || p.id === cleanUid || (p.handle && p.handle === cleanUid)) {
                    room.participants.delete(id);
                }
            }
            this.pruneStale(room);
        }
    }
    removeUserFromAllRooms(userId) {
        const affectedRooms = [];
        if (!userId)
            return affectedRooms;
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
    heartbeat(roomId, userId) {
        if (!roomId)
            return false;
        const rId = this.resolveRoomId(roomId);
        const room = this.getOrCreateRoom(rId);
        let found = false;
        if (userId && room.participants.has(userId)) {
            room.participants.get(userId).lastSeen = Date.now();
            found = true;
        }
        this.pruneStale(room);
        return found;
    }
    getParticipantCount(roomId) {
        const rId = this.resolveRoomId(roomId);
        if (!this.rooms.has(rId))
            return 0;
        const room = this.rooms.get(rId);
        this.pruneStale(room);
        return room.participants.size;
    }
    getSortedParticipants(roomId, callerUserId) {
        const room = this.getRoom(roomId, callerUserId);
        const list = Array.from(room.participants.values());
        const priority = { admin: 0, host: 1, speaker: 2, listener: 3 };
        return list.sort((a, b) => (priority[a.role] ?? 4) - (priority[b.role] ?? 4));
    }
    clearRoom(roomId) {
        const rId = this.resolveRoomId(roomId);
        if (this.rooms.has(rId)) {
            this.rooms.get(rId).participants.clear();
        }
    }
}
exports.CommunityRoomStoreService = CommunityRoomStoreService;
exports.communityRoomStoreService = new CommunityRoomStoreService();
