"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketManager = exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_service_1 = require("../services/user.service");
const call_service_1 = require("../services/call.service");
const community_room_service_1 = require("../services/community-room.service");
const room_store_service_1 = require("../services/room-store.service");
const user_model_1 = require("../models/user.model");
const message_service_1 = require("../services/message.service");
const group_message_service_1 = require("../services/group-message.service");
const push_service_1 = require("../services/push.service");
class SocketManager {
    io = null;
    userSocketsMap = new Map();
    lastSeenMap = new Map();
    callTimeoutsMap = new Map();
    socketCommunityRooms = new Map();
    socketCallRooms = new Map();
    lastRoomsBroadcastHash = '';
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: (_reqOrigin, callback) => {
                    callback(null, true);
                },
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingInterval: 25000,
            pingTimeout: 60000,
            connectTimeout: 45000,
            perMessageDeflate: false,
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
    getOnlineUserIds() {
        return Array.from(this.userSocketsMap.keys());
    }
    getLastSeenMap() {
        return Object.fromEntries(this.lastSeenMap);
    }
    broadcastOnlineUsers() {
        if (!this.io)
            return;
        const onlineUserIds = Array.from(this.userSocketsMap.keys());
        this.io.emit('circle:online_users', {
            onlineUserIds,
            lastSeenMap: Object.fromEntries(this.lastSeenMap),
        });
    }
    broadcastActiveUsersInstant() {
        if (!this.io)
            return;
        const users = user_service_1.userService.getCachedActiveUsersList();
        console.log(`[CircleSocket] Broadcasting ${users.length} active users to all ${this.io.sockets.sockets.size} connected sockets`);
        this.io.emit('circle:users_updated', { users });
    }
    async broadcastCommunityRooms(force = false) {
        if (!this.io || mongoose_1.default.connection.readyState !== 1)
            return;
        try {
            const rooms = await community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts(force);
            const hash = rooms
                .map((r) => `${r.roomId}:${r.activeParticipants}:${r.isStopped}:${(r.admins || []).join(',')}:${r.name}:${r.teluguTitle}:${r.avatar}`)
                .join('|');
            if (!force && hash === this.lastRoomsBroadcastHash) {
                return;
            }
            this.lastRoomsBroadcastHash = hash;
            this.io.emit('circle:rooms_updated', { rooms });
        }
        catch (err) {
            console.error('[broadcastCommunityRooms] Error:', err);
        }
    }
    emitToUser(userId, event, payload, exceptSocketId) {
        if (!this.io)
            return;
        const room = `user_${userId}`;
        if (exceptSocketId) {
            this.io.to(room).except(exceptSocketId).emit(event, payload);
        }
        else {
            this.io.to(room).emit(event, payload);
        }
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
                    socket.data.userId = decoded.userId || decoded.id || decoded._id || authUserId;
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
                const uid = String(userId);
                // Join user's personal room for direct 1-on-1 signaling
                const userRoom = `user_${uid}`;
                socket.join(userRoom);
                const wasOffline = !this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid).size === 0;
                if (!this.userSocketsMap.has(uid)) {
                    this.userSocketsMap.set(uid, new Set());
                }
                this.userSocketsMap.get(uid).add(socket.id);
                this.lastSeenMap.delete(uid);
                if (wasOffline) {
                    this.broadcastOnlineUsers();
                }
                const isDbReady = mongoose_1.default.connection.readyState === 1;
                const isValidObjectId = mongoose_1.default.Types.ObjectId.isValid(uid);
                if (isDbReady && isValidObjectId) {
                    // Also join user's handle and mitraId rooms so messages sent to handle reach socket
                    user_model_1.UserModel.findById(uid)
                        .select('_id handle mitraId')
                        .lean()
                        .then((u) => {
                        if (u) {
                            if (u.handle)
                                socket.join(`user_${String(u.handle).toLowerCase()}`);
                            if (u.mitraId)
                                socket.join(`user_${String(u.mitraId).toLowerCase()}`);
                        }
                    })
                        .catch(() => { });
                    // Automatically mark all pending sent messages as delivered
                    message_service_1.messageService.markDeliveredForUser(uid).catch((err) => {
                        console.warn('[CircleSocket] Error marking delivered for user:', err);
                    });
                    // Fetch user's status asynchronously
                    user_service_1.userService.getUserStatus(uid)
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
            }
            // Automatically join public Telugu community group room
            socket.join('group_telugu');
            // Send instant active online users list to connecting socket
            socket.emit('circle:online_users', {
                onlineUserIds: Array.from(this.userSocketsMap.keys()),
                lastSeenMap: Object.fromEntries(this.lastSeenMap),
            });
            // 1. Instant Initial Data From Cache (0ms)
            socket.emit('circle:users_updated', { users: user_service_1.userService.getCachedActiveUsersList() });
            socket.emit('circle:rooms_updated', { rooms: community_room_service_1.communityRoomService.getCachedRooms() });
            // 2. Refresh cache asynchronously in background if cold and DB is ready
            if (mongoose_1.default.connection.readyState === 1) {
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
                    // Also send Firebase Push Notification labeled explicitly as incoming_call
                    (0, push_service_1.sendIncomingCallPush)({
                        targetUserId: String(targetUserId),
                        callerId: result.incomingPayload.caller.id,
                        callerName: result.incomingPayload.caller.name,
                        callerAvatar: result.incomingPayload.caller.avatar,
                        callType: result.incomingPayload.callType,
                        callId: result.incomingPayload.callId,
                        roomName: result.incomingPayload.roomName,
                    }).catch(() => { });
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
                    const { callId, roomName, durationSeconds } = data || {};
                    const session = await call_service_1.callService.endCall(callId, roomName, durationSeconds);
                    if (session) {
                        this.emitToUser(session.callerId, 'call:ended', { callId: session.callId, roomName: session.roomName || roomName });
                        this.emitToUser(session.targetUserId, 'call:ended', { callId: session.callId, roomName: session.roomName || roomName });
                    }
                    if (roomName) {
                        socket.to(roomName).emit('call:ended', {
                            callId: session?.callId || callId,
                            roomName,
                            userId: socket.data.userId,
                        });
                        socket.to(roomName).emit('call:peer_left', {
                            roomName,
                            userId: socket.data.userId,
                        });
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
                    const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(roomId);
                    socket.join(`community_${roomId}`);
                    socket.join(`circle_comm_${roomId}`);
                    if (canonicalId && canonicalId !== roomId) {
                        socket.join(`community_${canonicalId}`);
                        socket.join(`circle_comm_${canonicalId}`);
                    }
                    if (!this.socketCommunityRooms.has(socket.id)) {
                        this.socketCommunityRooms.set(socket.id, new Set());
                    }
                    this.socketCommunityRooms.get(socket.id).add(roomId);
                    if (canonicalId)
                        this.socketCommunityRooms.get(socket.id).add(canonicalId);
                    const uid = participant?.id || socket.data.userId;
                    const isAdmin = uid ? community_room_service_1.communityRoomService.isUserRoomAdmin(roomId, String(uid)) : false;
                    const resolvedParticipant = uid
                        ? {
                            id: String(uid),
                            name: participant?.name || socket.data.user?.name || 'Member',
                            teluguName: participant?.teluguName || socket.data.user?.teluguName,
                            handle: participant?.handle || socket.data.user?.handle || 'member',
                            avatar: participant?.avatar || socket.data.user?.avatar || '',
                            role: isAdmin ? 'admin' : (participant?.role || 'speaker'),
                            isMuted: Boolean(participant?.isMuted),
                            isRestricted: false,
                            isVideoOff: Boolean(participant?.isVideoOff),
                            joinedAt: Date.now(),
                        }
                        : participant;
                    if (resolvedParticipant?.id) {
                        room_store_service_1.communityRoomStoreService.join(roomId, resolvedParticipant);
                    }
                    const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId);
                    const joinedPayload = { roomId, participant: resolvedParticipant, participants: sorted, memberCount: sorted.length };
                    const actionPayload = { roomId, action: 'join', participant: resolvedParticipant, participants: sorted, memberCount: sorted.length };
                    this.emitToRoom(`community_${roomId}`, 'community:participant_joined', joinedPayload);
                    this.emitToRoom(`community_${roomId}`, 'community:action', actionPayload);
                    this.emitToRoom(`circle_comm_${roomId}`, 'community:participant_joined', joinedPayload);
                    this.emitToRoom(`circle_comm_${roomId}`, 'community:action', actionPayload);
                    if (canonicalId && canonicalId !== roomId) {
                        this.emitToRoom(`community_${canonicalId}`, 'community:participant_joined', { ...joinedPayload, roomId: canonicalId });
                        this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                        this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_joined', { ...joinedPayload, roomId: canonicalId });
                        this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                    }
                    // Immediately reply back to caller with current full sorted participant list
                    socket.emit('community:action', { roomId, action: 'sync', participants: sorted, memberCount: sorted.length });
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            socket.on('community:leave', (data) => {
                const { roomId, userId } = data || {};
                if (roomId) {
                    const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(roomId);
                    socket.leave(`community_${roomId}`);
                    socket.leave(`circle_comm_${roomId}`);
                    if (canonicalId && canonicalId !== roomId) {
                        socket.leave(`community_${canonicalId}`);
                        socket.leave(`circle_comm_${canonicalId}`);
                    }
                    if (this.socketCommunityRooms.has(socket.id)) {
                        this.socketCommunityRooms.get(socket.id).delete(roomId);
                        if (canonicalId)
                            this.socketCommunityRooms.get(socket.id).delete(canonicalId);
                    }
                    const uid = userId || socket.data.userId;
                    if (uid) {
                        room_store_service_1.communityRoomStoreService.leave(roomId, uid);
                    }
                    const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId);
                    const leftPayload = { roomId, userId: uid, participants: sorted, memberCount: sorted.length };
                    const actionPayload = { roomId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };
                    this.emitToRoom(`community_${roomId}`, 'community:participant_left', leftPayload);
                    this.emitToRoom(`community_${roomId}`, 'community:action', actionPayload);
                    this.emitToRoom(`circle_comm_${roomId}`, 'community:participant_left', leftPayload);
                    this.emitToRoom(`circle_comm_${roomId}`, 'community:action', actionPayload);
                    if (canonicalId && canonicalId !== roomId) {
                        this.emitToRoom(`community_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                        this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                        this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                        this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                    }
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            socket.on('community:action', (data) => {
                if (data?.roomId) {
                    const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(data.roomId);
                    this.emitToRoom(`community_${data.roomId}`, 'community:action', data);
                    this.emitToRoom(`circle_comm_${data.roomId}`, 'community:action', data);
                    if (canonicalId && canonicalId !== data.roomId) {
                        this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...data, roomId: canonicalId });
                        this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...data, roomId: canonicalId });
                    }
                    if (data.action === 'leave' || data.action === 'remove' || data.action === 'terminate') {
                        const uid = data.targetUserId || data.userId || socket.data.userId;
                        if (uid) {
                            const leftPayload = { roomId: data.roomId, userId: uid, targetUserId: uid, participants: data.participants, memberCount: data.memberCount };
                            this.emitToRoom(`community_${data.roomId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`circle_comm_${data.roomId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`circle_comm_${data.roomId}`, 'call:peer_left', { roomName: `circle_comm_${data.roomId}`, userId: uid });
                            if (canonicalId && canonicalId !== data.roomId) {
                                this.emitToRoom(`community_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'call:peer_left', { roomName: `circle_comm_${canonicalId}`, userId: uid });
                            }
                        }
                    }
                    this.broadcastCommunityRooms(true).catch(() => { });
                }
            });
            socket.on('community:heartbeat', (data) => {
                const roomId = data?.roomId;
                const uid = data?.userId || socket.data.userId;
                if (roomId && uid) {
                    const found = room_store_service_1.communityRoomStoreService.heartbeat(roomId, String(uid));
                    if (!found && socket.data.user) {
                        const isAdmin = community_room_service_1.communityRoomService.isUserRoomAdmin(roomId, String(uid));
                        room_store_service_1.communityRoomStoreService.join(roomId, {
                            id: String(uid),
                            name: socket.data.user.name || 'Member',
                            teluguName: socket.data.user.teluguName,
                            handle: socket.data.user.handle || 'member',
                            avatar: socket.data.user.avatar || '',
                            role: isAdmin ? 'admin' : 'speaker',
                            isMuted: false,
                            isRestricted: false,
                            isVideoOff: false,
                            joinedAt: Date.now(),
                        });
                        const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId);
                        const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(roomId);
                        const actionPayload = { roomId, action: 'sync', participants: sorted, memberCount: sorted.length };
                        this.emitToRoom(`community_${roomId}`, 'community:action', actionPayload);
                        this.emitToRoom(`circle_comm_${roomId}`, 'community:action', actionPayload);
                        if (canonicalId && canonicalId !== roomId) {
                            this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                            this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                        }
                    }
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
            // ── Event: 1-on-1 Direct Messaging (Full Node.js Backend Persistence + 0ms Real-Time Delivery) ─────
            socket.on('direct:message', async (data, callback) => {
                try {
                    if (!data?.targetUserId || !data?.message) {
                        return callback?.({ success: false, error: 'Invalid message payload' });
                    }
                    const msg = data.message;
                    const senderId = socket.data.userId || msg.senderId;
                    if (!senderId) {
                        return callback?.({ success: false, error: 'Sender identifier required' });
                    }
                    // Complete backend persistence & real-time dispatch via messageService
                    const savedMessage = await message_service_1.messageService.sendMessage({
                        id: msg.id,
                        senderId: String(senderId),
                        senderName: msg.senderName,
                        senderAvatar: msg.senderAvatar,
                        senderHandle: msg.senderHandle,
                        senderTeluguName: msg.senderTeluguName,
                        targetUserId: String(data.targetUserId),
                        targetUserName: msg.targetUserName,
                        targetUserAvatar: msg.targetUserAvatar,
                        targetUserHandle: msg.targetUserHandle,
                        targetUserTeluguName: msg.targetUserTeluguName,
                        text: msg.text,
                        mediaUrl: msg.mediaUrl,
                        mediaType: msg.mediaType,
                        audioDuration: msg.audioDuration,
                        timestamp: msg.timestamp,
                        status: msg.status,
                    }, socket.id);
                    callback?.({ success: true, message: savedMessage });
                }
                catch (err) {
                    console.error('[Socket direct:message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to send message' });
                }
            });
            // ── Event: Direct Message Status (Delivered / Seen Receipts) ──
            socket.on('direct:status', async (data, callback) => {
                try {
                    if (!data?.targetUserId || !data?.status) {
                        return callback?.({ success: false, error: 'Invalid status payload' });
                    }
                    const myId = socket.data.userId || data.senderId;
                    if (myId) {
                        await message_service_1.messageService.updateStatus(String(myId), String(data.targetUserId), data.status, data.messageId);
                    }
                    callback?.({ success: true });
                }
                catch (err) {
                    console.error('[Socket direct:status error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to update status' });
                }
            });
            // ── Event: Real-time Typing Indicator ────────────────────────
            socket.on('direct:typing', (data) => {
                if (data?.targetUserId) {
                    const senderId = socket.data.userId;
                    this.emitToUser(String(data.targetUserId), 'direct:typing', {
                        senderId,
                        isTyping: Boolean(data.isTyping),
                    });
                }
            });
            // ── Event: Edit Direct Message ───────────────────────────────
            socket.on('direct:edit_message', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.senderId;
                    if (!uid || !data?.messageId || !data?.text?.trim()) {
                        return callback?.({ success: false, error: 'messageId and text are required' });
                    }
                    const updated = await message_service_1.messageService.editMessage(String(uid), String(data.messageId), String(data.text), socket.id);
                    callback?.({ success: true, message: updated });
                }
                catch (err) {
                    console.error('[Socket direct:edit_message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to edit message' });
                }
            });
            // ── Event: Unsend Direct Message (both sides) ────────────────
            socket.on('direct:unsend_message', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.senderId;
                    if (!uid || !data?.messageId) {
                        return callback?.({ success: false, error: 'messageId is required' });
                    }
                    const result = await message_service_1.messageService.unsendMessage(String(uid), String(data.messageId), socket.id);
                    callback?.(result);
                }
                catch (err) {
                    console.error('[Socket direct:unsend_message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to unsend message' });
                }
            });
            // ── Event: Delete Direct Message for Me ──────────────────────
            socket.on('direct:delete_for_me', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.userId;
                    if (!uid || !data?.messageId) {
                        return callback?.({ success: false, error: 'messageId is required' });
                    }
                    const result = await message_service_1.messageService.deleteMessageForMe(String(uid), String(data.messageId), socket.id);
                    callback?.(result);
                }
                catch (err) {
                    console.error('[Socket direct:delete_for_me error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to delete message for me' });
                }
            });
            // ── Event: Delete Conversation ('me' | 'both') ───────────────
            socket.on('direct:delete_chat', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.userId;
                    if (!uid || !data?.partnerId) {
                        return callback?.({ success: false, error: 'partnerId is required' });
                    }
                    const scope = data.scope === 'me' ? 'me' : 'both';
                    const result = await message_service_1.messageService.deleteConversation(String(uid), String(data.partnerId), scope, socket.id);
                    callback?.(result);
                }
                catch (err) {
                    console.error('[Socket direct:delete_chat error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to delete conversation' });
                }
            });
            // ── Event: Group Messaging (Public Community Groups e.g. Telugu) ──
            socket.on('group:join', (data) => {
                const gid = data?.groupId || 'telugu';
                socket.join(`group_${gid}`);
            });
            socket.on('group:leave', (data) => {
                const gid = data?.groupId || 'telugu';
                socket.leave(`group_${gid}`);
            });
            socket.on('group:message', async (data, callback) => {
                try {
                    const groupId = (data?.groupId || 'telugu').toLowerCase();
                    const msg = data?.message;
                    if (!msg || (!msg.text && !msg.mediaUrl)) {
                        return callback?.({ success: false, error: 'Invalid group message payload' });
                    }
                    const senderId = socket.data.userId || msg.senderId;
                    if (!senderId) {
                        return callback?.({ success: false, error: 'Sender identifier required' });
                    }
                    const savedMessage = await group_message_service_1.groupMessageService.sendGroupMessage({
                        id: msg.id,
                        groupId,
                        senderId: String(senderId),
                        senderName: msg.senderName || 'Mitrulu Member',
                        senderAvatar: msg.senderAvatar,
                        senderHandle: msg.senderHandle,
                        senderTeluguName: msg.senderTeluguName,
                        text: msg.text || '',
                        mediaUrl: msg.mediaUrl,
                        mediaType: msg.mediaType,
                        timestamp: msg.timestamp,
                    }, socket.id);
                    callback?.({ success: true, message: savedMessage });
                }
                catch (err) {
                    console.error('[Socket group:message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to send group message' });
                }
            });
            socket.on('group:edit_message', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.senderId;
                    if (!uid || !data?.messageId || !data?.text?.trim()) {
                        return callback?.({ success: false, error: 'messageId and text are required' });
                    }
                    const updated = await group_message_service_1.groupMessageService.editGroupMessage(String(uid), String(data.messageId), String(data.text));
                    callback?.({ success: true, message: updated });
                }
                catch (err) {
                    console.error('[Socket group:edit_message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to edit group message' });
                }
            });
            socket.on('group:unsend_message', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.userId;
                    if (!uid || !data?.messageId) {
                        return callback?.({ success: false, error: 'messageId is required' });
                    }
                    const result = await group_message_service_1.groupMessageService.unsendGroupMessage(String(uid), String(data.messageId));
                    callback?.(result);
                }
                catch (err) {
                    console.error('[Socket group:unsend_message error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to unsend group message' });
                }
            });
            socket.on('group:delete_for_me', async (data, callback) => {
                try {
                    const uid = socket.data.userId || data?.userId;
                    if (!uid || !data?.messageId) {
                        return callback?.({ success: false, error: 'messageId is required' });
                    }
                    const result = await group_message_service_1.groupMessageService.deleteGroupMessageForMe(String(uid), String(data.messageId));
                    callback?.(result);
                }
                catch (err) {
                    console.error('[Socket group:delete_for_me error]:', err);
                    callback?.({ success: false, error: err.message || 'Failed to delete group message for me' });
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
                    // If muted, also clear speaking state for this user
                    if (data.isMuted) {
                        socket.to(targetRoom).emit('call:speaking_status', { ...data, isSpeaking: false });
                    }
                }
            });
            // ── Event: Voice Activity Speaking Status Broadcast (0ms) ────
            // Emitted by web VAD (real mic analysis) or native mute-change.
            // Broadcasts to all room participants so their speaking ring/wave updates.
            socket.on('call:speaking_status', (data) => {
                const uid = socket.data.userId || data?.userId;
                const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
                if (targetRoom && uid) {
                    socket.to(targetRoom).emit('call:speaking_status', { ...data, userId: uid });
                    // Also broadcast to circle_comm_ alias for cross-platform coverage
                    const cleanId = targetRoom.replace(/^community_/, '').replace(/^circle_comm_/, '');
                    socket.to(`circle_comm_${cleanId}`).emit('call:speaking_status', { ...data, userId: uid });
                }
            });
            // ── Event: Join / Leave Call Socket Room ─────────────────────
            socket.on('call:join_room', (data) => {
                if (data?.roomName) {
                    socket.join(data.roomName);
                    const uid = socket.data.userId;
                    socket.to(data.roomName).emit('call:peer_joined', {
                        roomName: data.roomName,
                        userId: uid,
                        user: socket.data.user,
                    });
                    if (!this.socketCallRooms.has(socket.id)) {
                        this.socketCallRooms.set(socket.id, new Set());
                    }
                    this.socketCallRooms.get(socket.id).add(data.roomName);
                    // Also bridge community room listeners automatically
                    const cleanId = data.roomName.replace(/^circle_comm_/, '');
                    socket.join(`community_${cleanId}`);
                    socket.join(`circle_comm_${cleanId}`);
                    const canonical = room_store_service_1.communityRoomStoreService.getCanonicalId(cleanId);
                    if (canonical && canonical !== cleanId) {
                        socket.join(`community_${canonical}`);
                        socket.join(`circle_comm_${canonical}`);
                    }
                    if (!this.socketCommunityRooms.has(socket.id)) {
                        this.socketCommunityRooms.set(socket.id, new Set());
                    }
                    this.socketCommunityRooms.get(socket.id).add(cleanId);
                    if (canonical)
                        this.socketCommunityRooms.get(socket.id).add(canonical);
                    const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(cleanId);
                    if (sorted.length > 0) {
                        socket.emit('community:action', { roomId: cleanId, action: 'sync', participants: sorted, memberCount: sorted.length });
                    }
                }
            });
            socket.on('call:leave_room', (data) => {
                if (data?.roomName) {
                    const uid = socket.data.userId ? String(socket.data.userId) : undefined;
                    socket.leave(data.roomName);
                    if (this.socketCallRooms.has(socket.id)) {
                        this.socketCallRooms.get(socket.id).delete(data.roomName);
                    }
                    if (uid) {
                        socket.to(data.roomName).emit('call:peer_left', {
                            roomName: data.roomName,
                            userId: uid,
                        });
                    }
                    const cleanId = data.roomName.replace(/^circle_comm_/, '');
                    const isCommRoom = data.roomName.startsWith('circle_comm_') ||
                        this.socketCommunityRooms.get(socket.id)?.has(cleanId);
                    if (isCommRoom) {
                        const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(cleanId);
                        socket.leave(`community_${cleanId}`);
                        socket.leave(`circle_comm_${cleanId}`);
                        if (canonicalId && canonicalId !== cleanId) {
                            socket.leave(`community_${canonicalId}`);
                            socket.leave(`circle_comm_${canonicalId}`);
                        }
                        if (this.socketCommunityRooms.has(socket.id)) {
                            this.socketCommunityRooms.get(socket.id).delete(cleanId);
                            if (canonicalId)
                                this.socketCommunityRooms.get(socket.id).delete(canonicalId);
                        }
                        if (uid) {
                            room_store_service_1.communityRoomStoreService.leave(cleanId, uid);
                            const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(cleanId);
                            const leftPayload = { roomId: cleanId, userId: uid, participants: sorted, memberCount: sorted.length };
                            const actionPayload = { roomId: cleanId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };
                            this.emitToRoom(`community_${cleanId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`community_${cleanId}`, 'community:action', actionPayload);
                            this.emitToRoom(`circle_comm_${cleanId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`circle_comm_${cleanId}`, 'community:action', actionPayload);
                            this.emitToRoom(`circle_comm_${cleanId}`, 'call:peer_left', { roomName: `circle_comm_${cleanId}`, userId: uid });
                            if (canonicalId && canonicalId !== cleanId) {
                                this.emitToRoom(`community_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'call:peer_left', { roomName: `circle_comm_${canonicalId}`, userId: uid });
                            }
                            this.broadcastCommunityRooms(true).catch(() => { });
                        }
                    }
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
                const commRooms = this.socketCommunityRooms.get(socket.id);
                const callRooms = this.socketCallRooms.get(socket.id);
                this.socketCommunityRooms.delete(socket.id);
                this.socketCallRooms.delete(socket.id);
                if (userId) {
                    const uid = String(userId);
                    // 1. Immediately leave all community rooms this socket was in (0ms lag, no ghost users!)
                    if (commRooms && commRooms.size > 0) {
                        for (const rId of commRooms) {
                            room_store_service_1.communityRoomStoreService.leave(rId, uid);
                            const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(rId);
                            const leftPayload = { roomId: rId, userId: uid, participants: sorted, memberCount: sorted.length };
                            const actionPayload = { roomId: rId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };
                            this.emitToRoom(`community_${rId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`community_${rId}`, 'community:action', actionPayload);
                            this.emitToRoom(`circle_comm_${rId}`, 'community:participant_left', leftPayload);
                            this.emitToRoom(`circle_comm_${rId}`, 'community:action', actionPayload);
                            this.emitToRoom(rId, 'community:action', actionPayload);
                            const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(rId);
                            if (canonicalId && canonicalId !== rId) {
                                this.emitToRoom(`community_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                            }
                        }
                        this.broadcastCommunityRooms(true).catch(() => { });
                    }
                    // 2. Immediately notify 1-on-1 calls that this peer left/ended (0ms lag!)
                    if (callRooms && callRooms.size > 0) {
                        for (const rName of callRooms) {
                            if (!rName.startsWith('circle_comm_')) {
                                socket.to(rName).emit('call:peer_left', { roomName: rName, userId: uid });
                                socket.to(rName).emit('call:ended', { roomName: rName, userId: uid });
                            }
                        }
                    }
                    // 3. User socket tracking for online/offline
                    if (this.userSocketsMap.has(uid)) {
                        this.userSocketsMap.get(uid).delete(socket.id);
                        if (this.userSocketsMap.get(uid).size === 0) {
                            this.userSocketsMap.delete(uid);
                            const now = Date.now();
                            this.lastSeenMap.set(uid, now);
                            if (mongoose_1.default.connection.readyState === 1 && mongoose_1.default.Types.ObjectId.isValid(uid)) {
                                user_model_1.UserModel.findByIdAndUpdate(uid, { lastSeen: new Date(now) }).exec().catch(() => { });
                            }
                            this.broadcastOnlineUsers();
                            // User has closed all tabs/app
                            setTimeout(async () => {
                                if (!this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid).size === 0) {
                                    const affectedRooms = room_store_service_1.communityRoomStoreService.removeUserFromAllRooms(uid);
                                    if (affectedRooms.length > 0) {
                                        for (const rId of affectedRooms) {
                                            const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(rId);
                                            const leftPayload = { roomId: rId, userId: uid, participants: sorted, memberCount: sorted.length };
                                            const actionPayload = { roomId: rId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };
                                            this.emitToRoom(`community_${rId}`, 'community:participant_left', leftPayload);
                                            this.emitToRoom(`community_${rId}`, 'community:action', actionPayload);
                                            this.emitToRoom(`circle_comm_${rId}`, 'community:participant_left', leftPayload);
                                            this.emitToRoom(`circle_comm_${rId}`, 'community:action', actionPayload);
                                            const canonicalId = room_store_service_1.communityRoomStoreService.getCanonicalId(rId);
                                            if (canonicalId && canonicalId !== rId) {
                                                this.emitToRoom(`community_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                                this.emitToRoom(`community_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:participant_left', { ...leftPayload, roomId: canonicalId });
                                                this.emitToRoom(`circle_comm_${canonicalId}`, 'community:action', { ...actionPayload, roomId: canonicalId });
                                            }
                                        }
                                        this.broadcastCommunityRooms(true).catch(() => { });
                                    }
                                    console.log(`[CircleSocket] User ${uid} closed Chrome/Tab - marking INACTIVE and removing from active list`);
                                    user_service_1.userService.removeCacheUser(uid);
                                    if (mongoose_1.default.connection.readyState === 1 && mongoose_1.default.Types.ObjectId.isValid(uid)) {
                                        try {
                                            await user_service_1.userService.updateActiveStatusViaHttp(uid, { isCallActive: false });
                                        }
                                        catch (e) {
                                            console.warn(`[CircleSocket] Error marking user ${uid} inactive on close:`, e);
                                        }
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
