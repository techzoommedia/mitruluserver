"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.communityRoomService = exports.CommunityRoomService = void 0;
const community_room_repository_1 = require("../repositories/community-room.repository");
const user_repository_1 = require("../repositories/user.repository");
const livekit_service_1 = require("./livekit.service");
const room_store_service_1 = require("./room-store.service");
const env_1 = require("../config/env");
class CommunityRoomService {
    roomRepo;
    userRepo;
    cachedRooms = [];
    lastFetchAt = 0;
    inFlightFetch = null;
    ROOMS_CACHE_TTL_MS = 2500;
    constructor(roomRepo = community_room_repository_1.communityRoomRepository, userRepo = user_repository_1.userRepository) {
        this.roomRepo = roomRepo;
        this.userRepo = userRepo;
    }
    getCachedRooms() {
        return this.cachedRooms;
    }
    setCachedRooms(rooms) {
        this.cachedRooms = rooms;
    }
    isUserRoomAdmin(roomId, userId) {
        if (!roomId || !userId)
            return false;
        const cleanRoom = String(roomId).replace(/^circle_comm_/, '').toLowerCase();
        const uid = String(userId).toLowerCase();
        const room = this.cachedRooms.find((r) => String(r.roomId || r.id).toLowerCase() === cleanRoom || String(r.id).toLowerCase() === cleanRoom);
        if (!room || !Array.isArray(room.admins))
            return false;
        return room.admins.some((a) => String(a).toLowerCase() === uid);
    }
    async fetchCommunityRoomsWithCounts(force = false) {
        const now = Date.now();
        if (!force && this.cachedRooms.length > 0 && now - this.lastFetchAt < this.ROOMS_CACHE_TTL_MS) {
            return this.cachedRooms;
        }
        if (this.inFlightFetch) {
            return this.inFlightFetch;
        }
        this.inFlightFetch = (async () => {
            try {
                const [dbRooms, livekitCounts] = await Promise.all([
                    this.roomRepo.findAll(),
                    livekit_service_1.liveKitService.getRoomParticipantCounts(force),
                ]);
                const mappedRooms = dbRooms.map((r) => {
                    const rId = r.roomId || r.id;
                    const dbId = r._id ? r._id.toString() : '';
                    if (dbId && rId && dbId !== rId) {
                        room_store_service_1.communityRoomStoreService.registerAlias(dbId, rId);
                    }
                    // Live count from LiveKit Cloud or in-memory CommunityRoomStore (0ms instant)
                    const localCount = room_store_service_1.communityRoomStoreService.getParticipantCount(rId);
                    const liveCount = Math.max((dbId ? livekitCounts.get(`circle_comm_${dbId}`) : 0) || 0, (rId ? livekitCounts.get(`circle_comm_${rId}`) : 0) || 0, (rId ? livekitCounts.get(rId) : 0) || 0, (dbId ? livekitCounts.get(dbId) : 0) || 0, localCount, 0);
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
                    this.lastFetchAt = Date.now();
                }
                return mappedRooms;
            }
            catch (err) {
                console.warn('[fetchCommunityRoomsWithCounts Error]:', err);
                return this.cachedRooms;
            }
            finally {
                this.inFlightFetch = null;
            }
        })();
        return this.inFlightFetch;
    }
    async joinRoom(userId, roomId) {
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
            const err = new Error(room.stoppedReason ||
                'ఈ కమ్యూనిటీ రూమ్ అడ్మిన్ ద్వారా తాత్కాలికంగా ఆపబడింది (This community room has been stopped by admin).');
            err.isStopped = true;
            err.statusCode = 403;
            throw err;
        }
        const user = await this.userRepo.findById(userId);
        if (!user) {
            const err = new Error('User not found');
            err.statusCode = 404;
            throw err;
        }
        // Register active participant in room session
        const targetRoomId = room.roomId || roomId;
        if (room._id && targetRoomId) {
            room_store_service_1.communityRoomStoreService.registerAlias(room._id.toString(), targetRoomId);
        }
        const uidStr = user._id.toString();
        const isAdmin = Array.isArray(room.admins) &&
            room.admins.some((a) => String(a).toLowerCase() === uidStr.toLowerCase());
        room_store_service_1.communityRoomStoreService.join(targetRoomId, {
            id: uidStr,
            name: user.name || user.handle || 'Member',
            teluguName: user.teluguName,
            handle: user.handle || 'member',
            avatar: user.avatar || '',
            role: isAdmin ? 'admin' : 'speaker',
            isMuted: false,
            isRestricted: false,
            isVideoOff: false,
            joinedAt: Date.now(),
        });
        const livekitRoomName = `circle_comm_${room.id || room.roomId}`;
        const token = await livekit_service_1.liveKitService.generateCommunityToken(user._id.toString(), user.name || user.handle || 'Member', livekitRoomName);
        return {
            success: true,
            room,
            roomName: livekitRoomName,
            token,
            serverUrl: env_1.LIVEKIT_URL,
            costCoins: 0,
            remainingCoins: user.coins || 0,
        };
    }
    getRoomActions(roomId, callerUserId) {
        if (!roomId) {
            throw new Error('roomId is required');
        }
        const room = room_store_service_1.communityRoomStoreService.getRoom(roomId, callerUserId);
        const participants = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId, callerUserId);
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
    handleRoomAction(body) {
        const { roomId, action, participant, targetUserId, actorUserId } = body;
        if (!roomId || !action) {
            throw new Error('roomId and action are required');
        }
        const room = room_store_service_1.communityRoomStoreService.getRoom(roomId, actorUserId);
        const checkingUserId = participant?.id || actorUserId;
        if (checkingUserId && room.blockedUserIds.has(checkingUserId)) {
            const err = new Error('You have been permanently blocked from this group call by the admin.');
            err.isBlocked = true;
            err.statusCode = 403;
            throw err;
        }
        switch (action) {
            case 'join': {
                if (!participant || !participant.id) {
                    throw new Error('participant data required');
                }
                const isAdmin = this.isUserRoomAdmin(roomId, participant.id);
                const result = room_store_service_1.communityRoomStoreService.join(roomId, {
                    id: participant.id,
                    name: participant.name || 'User',
                    teluguName: participant.teluguName,
                    handle: participant.handle || 'user',
                    avatar: participant.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
                    role: isAdmin ? 'admin' : (participant.role || (room.participants.size === 0 ? 'host' : 'speaker')),
                    isMuted: Boolean(participant.isMuted),
                    isRestricted: false,
                    isVideoOff: Boolean(participant.isVideoOff),
                    joinedAt: Date.now(),
                });
                if (!result.success) {
                    const err = new Error(result.error);
                    err.isBlocked = result.isBlocked;
                    err.statusCode = 403;
                    throw err;
                }
                break;
            }
            case 'leave': {
                const uid = targetUserId || actorUserId;
                if (uid) {
                    room_store_service_1.communityRoomStoreService.leave(roomId, uid);
                }
                break;
            }
            case 'terminate': {
                room_store_service_1.communityRoomStoreService.clearRoom(roomId);
                break;
            }
            case 'self_mute': {
                const p = room.participants.get(actorUserId);
                if (p) {
                    if (p.isRestricted && body.isMuted === false) {
                        const err = new Error('You are restricted from speaking by the group admin.');
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
                if (!targetUserId)
                    throw new Error('targetUserId required');
                const target = room.participants.get(targetUserId);
                if (target) {
                    target.isMuted = true;
                    target.isRestricted = true;
                }
                break;
            }
            case 'unmute': {
                if (!targetUserId)
                    throw new Error('targetUserId required');
                const target = room.participants.get(targetUserId);
                if (target) {
                    target.isMuted = false;
                    target.isRestricted = false;
                }
                break;
            }
            case 'remove': {
                if (!targetUserId)
                    throw new Error('targetUserId required');
                room_store_service_1.communityRoomStoreService.leave(roomId, targetUserId);
                break;
            }
            case 'block': {
                if (!targetUserId)
                    throw new Error('targetUserId required');
                room.blockedUserIds.add(targetUserId);
                room_store_service_1.communityRoomStoreService.leave(roomId, targetUserId);
                break;
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        const participants = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId, actorUserId);
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
exports.CommunityRoomService = CommunityRoomService;
exports.communityRoomService = new CommunityRoomService();
