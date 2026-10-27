"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketManager = exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_service_1 = require("../services/user.service");
const call_service_1 = require("../services/call.service");
const community_room_service_1 = require("../services/community-room.service");
const room_store_service_1 = require("../services/room-store.service");
class SocketManager {
    io = null;
    userSocketsMap = new Map();
    callTimeoutsMap = new Map();
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: (_reqOrigin, callback) => {
                    callback(null, true);
                },
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingInterval: 10000,
            pingTimeout: 5000,
        });
        this.setupAuthMiddleware();
        this.setupConnectionHandlers();
        return this.io;
    }
    getIO() {
        if (!this.io) {
            throw new Error('Socket.io server has not been initialized');
        }
        return this.io;
    }
    getActiveSocketsCount() {
        return this.io ? this.io.sockets.sockets.size : 0;
    }
    getOnlineUsersCount() {
        return this.userSocketsMap.size;
    }
    broadcastActiveUsersInstant() {
        if (!this.io)
            return;
        const users = user_service_1.userService.getCachedActiveUsersList();
        console.log(`[CircleSocket] Broadcasting ${users.length} active users to all ${this.io.sockets.sockets.size} connected sockets`);
        this.io.emit('circle:users_updated', { users });
    }
    async broadcastCommunityRooms(force = false) {
        if (!this.io)
            return;
        try {
            const rooms = await community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts(force);
            this.io.emit('circle:rooms_updated', { rooms });
        }
        catch (err) {
            console.error('[broadcastCommunityRooms] Error:', err);
        }
    }
    emitToUser(userId, event, payload) {
        if (!this.io)
            return;
        this.io.to(`user_${userId}`).emit(event, payload);
    }
    emitToRoom(room, event, payload) {
        if (!this.io)
            return;
        this.io.to(room).emit(event, payload);
    }
    setupAuthMiddleware() {
        if (!this.io)
            return;
        this.io.use((socket, next) => {
            const token = socket.handshake.auth?.token ||
                (socket.handshake.headers?.authorization?.startsWith('Bearer ')
                    ? socket.handshake.headers.authorization.slice(7)
                    : null);
            const authUserId = socket.handshake.auth?.userId;
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                    socket.data.userId = decoded.userId || decoded.id;
                    socket.data.user = decoded;
                }
                catch (e) {
                    if (authUserId) {
                        socket.data.userId = authUserId;
                    }
                }
            }
            else if (authUserId) {
                socket.data.userId = authUserId;
            }
            next();
        });
    }
    setupConnectionHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            const userId = socket.data.userId;
            if (userId) {
                // Join user's personal room for direct 1-on-1 signaling
                const userRoom = `user_${userId}`;
                socket.join(userRoom);
                if (!this.userSocketsMap.has(userId)) {
                    this.userSocketsMap.set(userId, new Set());
                }
                this.userSocketsMap.get(userId).add(socket.id);
                // Fetch user's status asynchronously
                user_service_1.userService.getUserStatus(userId)
                    .then((dbUser) => {
                    if (dbUser) {
                        socket.emit('circle:my_status_init', {
                            isCallActive: Boolean(dbUser.isCallActive),
                            gender: dbUser.gender,
                            profession: dbUser.profession,
                            callLanguage: dbUser.callLanguage,
                        });
                    }
                })
                    .catch(() => { });
            }
            // 1. Instant Initial Data From Cache (0ms)
            socket.emit('circle:users_updated', { users: user_service_1.userService.getCachedActiveUsersList() });
            socket.emit('circle:rooms_updated', { rooms: community_room_service_1.communityRoomService.getCachedRooms() });
            // 2. Refresh cache asynchronously in background if cold
            if (user_service_1.userService.getCacheSize() === 0) {
                user_service_1.userService.syncActiveUsersFromDB()
                    .then(() => {
                    socket.emit('circle:users_updated', { users: user_service_1.userService.getCachedActiveUsersList() });
                })
                    .catch(() => { });
            }
            if (community_room_service_1.communityRoomService.getCachedRooms().length === 0) {
                community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts()
                    .then((rooms) => {
                    socket.emit('circle:rooms_updated', { rooms });
                })
                    .catch(() => { });
            }
            // ── Event: Toggle Active ─────────────────────────────────────
            socket.on('circle:toggle_active', async (data, callback) => {
                const uid = socket.data.userId || data?.userId || data?.user?.id;
                if (!uid) {
                    console.warn('[circle:toggle_active] Unauthorized: no userId found');
                    return callback?.({ success: false, error: 'Unauthorized: missing user identifier' });
                }
                try {
                    const activeState = await user_service_1.userService.toggleActiveStatus(uid, {
                        ...data,
                        user: data?.user || socket.data.user,
                    });
                    // 1. Instant broadcast to all connected clients
                    this.broadcastActiveUsersInstant();
                    // 2. Emit confirmation back to user's personal room
                    this.emitToUser(uid, 'circle:my_status_updated', {
                        isCallActive: activeState,
                        gender: data?.gender,
                        profession: data?.profession,
                        callLanguage: data?.callLanguage,
                    });
                    callback?.({ success: true, isCallActive: activeState });
                }
                catch (err) {
                    console.error('[circle:toggle_active error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to toggle status' });
                }
            });
            // ── Event: Start Call ────────────────────────────────────────
            socket.on('call:start', async (data, callback) => {
                if (!socket.data.userId) {
                    return callback?.({ success: false, error: 'Unauthorized' });
                }
                try {
                    const callerId = socket.data.userId;
                    const { targetUserId, callType = 'audio' } = data;
                    const result = await call_service_1.callService.startCall(callerId, targetUserId, callType);
                    // Emit incoming alert to target user
                    this.emitToUser(targetUserId, 'call:incoming', result.incomingPayload);
                    const callId = result.session.callId;
                    const costCoins = result.costCoins;
                    // 60-second auto-timeout
                    const timeout = setTimeout(async () => {
                        try {
                            const timedOutSession = await call_service_1.callService.handleTimeout(callId, costCoins);
                            if (timedOutSession) {
                                this.emitToUser(callerId, 'call:timeout', {
                                    callId,
                                    message: 'కాల్ స్వీకరించబడలేదు. నాణేలు రీఫండ్ చేయబడ్డాయి (Call timed out, coins refunded).',
                                });
                                this.emitToUser(targetUserId, 'call:timeout', { callId });
                            }
                        }
                        catch (e) {
                            console.error('[call:timeout handler error]:', e);
                        }
                        finally {
                            this.callTimeoutsMap.delete(callId);
                        }
                    }, 60000);
                    this.callTimeoutsMap.set(callId, timeout);
                    callback?.(result.callerResponse);
                }
                catch (err) {
                    console.error('[call:start error]:', err);
                    callback?.({
                        success: false,
                        error: err.message || 'Call failed to initiate',
                        insufficientCoins: err.insufficientCoins,
                        isOffline: err.isOffline,
                    });
                }
            });
            // ── Event: Respond to Call ───────────────────────────────────
            socket.on('call:respond', async (data, callback) => {
                if (!socket.data.userId) {
                    return callback?.({ success: false, error: 'Unauthorized' });
                }
                try {
                    const { callId, action } = data;
                    if (this.callTimeoutsMap.has(callId)) {
                        clearTimeout(this.callTimeoutsMap.get(callId));
                        this.callTimeoutsMap.delete(callId);
                    }
                    const response = await call_service_1.callService.respondToCall(callId, action);
                    if (response.action === 'accept') {
                        this.emitToUser(response.session.callerId, 'call:accepted', {
                            callId,
                            roomName: response.session.roomName,
                            token: response.callerToken,
                            serverUrl: response.serverUrl,
                            callType: response.session.callType,
                        });
                        callback?.({
                            success: true,
                            callId,
                            roomName: response.session.roomName,
                            token: response.receiverToken,
                            serverUrl: response.serverUrl,
                            callType: response.session.callType,
                        });
                    }
                    else {
                        this.emitToUser(response.session.callerId, 'call:declined', {
                            callId,
                            message: response.message,
                        });
                        callback?.({ success: true, declined: true });
                    }
                }
                catch (err) {
                    console.error('[call:respond error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to respond to call' });
                }
            });
            // ── Event: End Call ──────────────────────────────────────────
            socket.on('call:end', async (data, callback) => {
                try {
                    const { callId, roomName } = data;
                    const session = await call_service_1.callService.endCall(callId, roomName);
                    if (session) {
                        this.emitToUser(session.callerId, 'call:ended', { callId: session.callId });
                        this.emitToUser(session.targetUserId, 'call:ended', { callId: session.callId });
                    }
                    callback?.({ success: true });
                }
                catch (err) {
                    console.error('[call:end error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to end call' });
                }
            });
            // ── Event: Community Room Join / Leave / Action ──────────────
            socket.on('community:join', (data) => {
                const { roomId, participant } = data || {};
                if (roomId) {
                    socket.join(`community_${roomId}`);
                    if (participant?.id) {
                        room_store_service_1.communityRoomStoreService.join(roomId, {
                            id: participant.id,
                            name: participant.name || 'Member',
                            teluguName: participant.teluguName,
                            handle: participant.handle || 'member',
                            avatar: participant.avatar || '',
                            role: participant.role || 'speaker',
                            isMuted: Boolean(participant.isMuted),
                            isRestricted: false,
                            isVideoOff: Boolean(participant.isVideoOff),
                            joinedAt: Date.now(),
                        });
                    }
                    this.emitToRoom(`community_${roomId}`, 'community:participant_joined', { roomId, participant });
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            socket.on('community:leave', (data) => {
                const { roomId, userId } = data || {};
                if (roomId) {
                    socket.leave(`community_${roomId}`);
                    const uid = userId || socket.data.userId;
                    if (uid) {
                        room_store_service_1.communityRoomStoreService.leave(roomId, uid);
                    }
                    this.emitToRoom(`community_${roomId}`, 'community:participant_left', { roomId, userId: uid });
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            socket.on('community:action', (data) => {
                if (data?.roomId) {
                    this.emitToRoom(`community_${data.roomId}`, 'community:action', data);
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            // ── Event: In-Call & Community 0-Latency Chat Relay ────────────
            socket.on('call:chat_message', (data) => {
                const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
                if (targetRoom) {
                    socket.to(targetRoom).emit('call:chat_message', data);
                }
                else if (data?.message?.targetUserId) {
                    this.emitToUser(data.message.targetUserId, 'call:chat_message', data);
                }
            });
            socket.on('community:chat_message', (data) => {
                if (data?.roomId) {
                    socket.to(`community_${data.roomId}`).emit('call:chat_message', {
                        roomId: data.roomId,
                        roomName: `community_${data.roomId}`,
                        message: data.message,
                    });
                }
            });
            // ── Event: Hand Raise Broadcast (0ms) ────────────────────────
            socket.on('call:hand_raise', (data) => {
                const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
                if (targetRoom) {
                    socket.to(targetRoom).emit('call:hand_raise', data);
                }
            });
            socket.on('community:raise_hand', (data) => {
                if (data?.roomId) {
                    socket.to(`community_${data.roomId}`).emit('call:hand_raise', {
                        roomId: data.roomId,
                        roomName: `community_${data.roomId}`,
                        ...data,
                    });
                }
            });
            // ── Event: Microphone Mute Status Broadcast (0ms) ────────────
            socket.on('call:mute_status', (data) => {
                const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
                if (targetRoom) {
                    socket.to(targetRoom).emit('call:mute_status', data);
                }
            });
            // ── Event: Join / Leave Call Socket Room ─────────────────────
            socket.on('call:join_room', (data) => {
                if (data?.roomName) {
                    socket.join(data.roomName);
                }
            });
            socket.on('call:leave_room', (data) => {
                if (data?.roomName) {
                    socket.leave(data.roomName);
                }
            });
            // ── Event: Client Requests Instant Fresh State ───────────────
            socket.on('circle:request_sync', async () => {
                socket.emit('circle:users_updated', { users: user_service_1.userService.getCachedActiveUsersList() });
                const rooms = await community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts(true);
                socket.emit('circle:rooms_updated', { rooms });
            });
            // ── Event: Disconnect ────────────────────────────────────────
            socket.on('disconnect', () => {
                if (userId) {
                    const affectedRooms = room_store_service_1.communityRoomStoreService.removeUserFromAllRooms(userId);
                    if (affectedRooms.length > 0) {
                        this.broadcastCommunityRooms(true).catch(() => { });
                    }
                    if (this.userSocketsMap.has(userId)) {
                        this.userSocketsMap.get(userId).delete(socket.id);
                        if (this.userSocketsMap.get(userId).size === 0) {
                            this.userSocketsMap.delete(userId);
                            // User has closed Chrome or closed their tab
                            // Grace period of 3 seconds to differentiate between page refresh and closing browser
                            setTimeout(async () => {
                                if (!this.userSocketsMap.has(userId) || this.userSocketsMap.get(userId).size === 0) {
                                    console.log(`[CircleSocket] User ${userId} closed Chrome/Tab - marking INACTIVE and removing from active list`);
                                    user_service_1.userService.removeCacheUser(userId);
                                    try {
                                        await user_service_1.userService.updateActiveStatusViaHttp(userId, { isCallActive: false });
                                    }
                                    catch (e) {
                                        console.warn(`[CircleSocket] Error marking user ${userId} inactive on close:`, e);
                                    }
                                    this.broadcastActiveUsersInstant();
                                }
                            }, 3000);
                        }
                    }
                }
            });
        });
    }
}
exports.SocketManager = SocketManager;
exports.socketManager = new SocketManager();
