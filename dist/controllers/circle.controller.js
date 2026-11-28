"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.circleController = exports.CircleController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_service_1 = require("../services/user.service");
const community_room_service_1 = require("../services/community-room.service");
const room_store_service_1 = require("../services/room-store.service");
const socket_manager_1 = require("../sockets/socket.manager");
const push_service_1 = require("../services/push.service");
const community_room_model_1 = require("../models/community-room.model");
const call_session_repository_1 = require("../repositories/call-session.repository");
const call_service_1 = require("../services/call.service");
const livekit_service_1 = require("../services/livekit.service");
class CircleController {
    async getActiveUsers(req, res) {
        try {
            const gender = req.query.gender || 'all';
            const category = req.query.category || 'all';
            const users = await user_service_1.userService.getFilteredActiveUsers(gender, category);
            res.json({ success: true, users, count: users.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch active users' });
        }
    }
    async getCommunityRooms(_req, res) {
        try {
            const rooms = await community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts();
            res.json({ success: true, rooms, costCoins: 0 });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch community rooms' });
        }
    }
    async joinCommunityRoom(req, res) {
        try {
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            let userId = req.body.userId;
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                    userId = decoded.userId || decoded.id || userId;
                }
                catch { }
            }
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized: Missing user token' });
                return;
            }
            const { roomId } = req.body;
            if (!roomId) {
                res.status(400).json({ error: 'Missing roomId' });
                return;
            }
            const result = await community_room_service_1.communityRoomService.joinRoom(userId, roomId);
            // Instant 0ms broadcast to room socket listeners
            const canonicalRoom = room_store_service_1.communityRoomStoreService.getCanonicalId(roomId);
            const sorted = room_store_service_1.communityRoomStoreService.getSortedParticipants(roomId);
            const joinedPayload = {
                roomId,
                participant: {
                    id: userId,
                    role: 'speaker',
                    isMuted: false,
                    isVideoOff: false,
                },
                participants: sorted,
                memberCount: sorted.length,
            };
            socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'community:participant_joined', joinedPayload);
            socket_manager_1.socketManager.emitToRoom(`circle_comm_${roomId}`, 'community:participant_joined', joinedPayload);
            if (canonicalRoom && canonicalRoom !== roomId) {
                socket_manager_1.socketManager.emitToRoom(`community_${canonicalRoom}`, 'community:participant_joined', {
                    ...joinedPayload,
                    roomId: canonicalRoom,
                });
                socket_manager_1.socketManager.emitToRoom(`circle_comm_${canonicalRoom}`, 'community:participant_joined', {
                    ...joinedPayload,
                    roomId: canonicalRoom,
                });
            }
            socket_manager_1.socketManager.broadcastCommunityRooms().catch(() => { });
            res.json(result);
        }
        catch (err) {
            console.error('[joinCommunityRoom error]:', err);
            res.status(err.statusCode || 500).json({ error: err.message, isStopped: err.isStopped });
        }
    }
    getRoomActions(req, res) {
        try {
            const roomId = req.query.roomId;
            let userId = req.query.userId;
            if (!roomId) {
                res.status(400).json({ error: 'roomId is required' });
                return;
            }
            if (!userId) {
                const token = req.headers.authorization?.startsWith('Bearer ')
                    ? req.headers.authorization.slice(7)
                    : null;
                if (token) {
                    try {
                        const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                        userId = decoded.userId || decoded.id;
                    }
                    catch { }
                }
            }
            const data = community_room_service_1.communityRoomService.getRoomActions(roomId, userId);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    postRoomActions(req, res) {
        try {
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            let decodedUserId;
            let decodedUser;
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                    decodedUserId = decoded.userId || decoded.id || decoded._id;
                    decodedUser = decoded;
                }
                catch { }
            }
            if (!req.body.actorUserId && decodedUserId) {
                req.body.actorUserId = decodedUserId;
            }
            if (req.body.action === 'join' && (!req.body.participant || !req.body.participant.id)) {
                const uid = req.body.targetUserId || req.body.actorUserId || decodedUserId;
                if (uid) {
                    req.body.participant = {
                        id: uid,
                        name: decodedUser?.name || req.body.targetUserName || 'Member',
                        teluguName: decodedUser?.teluguName,
                        handle: decodedUser?.handle || 'member',
                        avatar: decodedUser?.avatar || '',
                        role: 'speaker',
                    };
                }
            }
            const result = community_room_service_1.communityRoomService.handleRoomAction(req.body);
            const { roomId, action, actorUserId, targetUserId } = req.body;
            const uid = targetUserId || actorUserId || decodedUserId;
            const actionPayload = {
                roomId,
                action,
                actorUserId,
                targetUserId,
                userId: uid,
                memberCount: result.memberCount,
                participants: result.participants,
            };
            const leftPayload = {
                roomId,
                userId: uid,
                targetUserId: uid,
                memberCount: result.memberCount,
                participants: result.participants,
            };
            // Broadcast to room sockets in 0ms across all room channel formats
            socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'community:action', actionPayload);
            socket_manager_1.socketManager.emitToRoom(`circle_comm_${roomId}`, 'community:action', actionPayload);
            socket_manager_1.socketManager.emitToRoom(roomId, 'community:action', actionPayload);
            if (action === 'leave' || action === 'remove' || action === 'terminate') {
                socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'community:participant_left', leftPayload);
                socket_manager_1.socketManager.emitToRoom(`circle_comm_${roomId}`, 'community:participant_left', leftPayload);
                socket_manager_1.socketManager.emitToRoom(roomId, 'community:participant_left', leftPayload);
                socket_manager_1.socketManager.emitToRoom(`circle_comm_${roomId}`, 'call:peer_left', { roomName: `circle_comm_${roomId}`, userId: uid });
                socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'call:peer_left', { roomName: `circle_comm_${roomId}`, userId: uid });
            }
            const canonicalRoom = room_store_service_1.communityRoomStoreService.getCanonicalId(roomId);
            if (canonicalRoom && canonicalRoom !== roomId) {
                socket_manager_1.socketManager.emitToRoom(`community_${canonicalRoom}`, 'community:action', { ...actionPayload, roomId: canonicalRoom });
                socket_manager_1.socketManager.emitToRoom(`circle_comm_${canonicalRoom}`, 'community:action', { ...actionPayload, roomId: canonicalRoom });
                socket_manager_1.socketManager.emitToRoom(canonicalRoom, 'community:action', { ...actionPayload, roomId: canonicalRoom });
                if (action === 'leave' || action === 'remove' || action === 'terminate') {
                    socket_manager_1.socketManager.emitToRoom(`community_${canonicalRoom}`, 'community:participant_left', { ...leftPayload, roomId: canonicalRoom });
                    socket_manager_1.socketManager.emitToRoom(`circle_comm_${canonicalRoom}`, 'community:participant_left', { ...leftPayload, roomId: canonicalRoom });
                    socket_manager_1.socketManager.emitToRoom(`circle_comm_${canonicalRoom}`, 'call:peer_left', { roomName: `circle_comm_${canonicalRoom}`, userId: uid });
                }
            }
            socket_manager_1.socketManager.broadcastCommunityRooms().catch(() => { });
            res.json(result);
        }
        catch (err) {
            res.status(err.statusCode || 500).json({ error: err.message, isBlocked: err.isBlocked });
        }
    }
    async syncActive(req, res) {
        try {
            const { userId, user, isCallActive, gender, profession, callLanguage, callCategory } = req.body;
            if (!userId) {
                res.status(400).json({ error: 'Missing userId' });
                return;
            }
            const activeState = Boolean(isCallActive);
            if (activeState) {
                user_service_1.userService.setCacheUser(userId, {
                    name: user?.name,
                    teluguName: user?.teluguName,
                    handle: user?.mitraId || user?.handle,
                    mitraId: user?.mitraId || user?.handle,
                    avatar: user?.avatar,
                    bio: user?.bio,
                    teluguBio: user?.teluguBio,
                    location: user?.location,
                    isVerified: user?.isVerified,
                    gender: gender || user?.gender,
                    profession: profession || user?.profession,
                    callCategory: callCategory || user?.callCategory,
                    callLanguage: callLanguage || user?.callLanguage,
                    callRating: user?.callRating,
                    callRatingCount: user?.callRatingCount,
                    callRateCoins: user?.callRateCoins,
                });
            }
            else {
                user_service_1.userService.removeCacheUser(userId);
                if (user?.id)
                    user_service_1.userService.removeCacheUser(user.id);
                if (user?.handle)
                    user_service_1.userService.removeCacheUser(user.handle);
            }
            socket_manager_1.socketManager.broadcastActiveUsersInstant();
            res.json({ success: true, count: user_service_1.userService.getCacheSize() });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    notifyIncomingCall(req, res) {
        const { targetUserId, call } = req.body;
        if (!targetUserId || !call) {
            res.status(400).json({ error: 'Missing targetUserId or call' });
            return;
        }
        console.log(`[CircleSocket] Forwarding incoming call alert to user_${targetUserId}`);
        socket_manager_1.socketManager.emitToUser(targetUserId, 'call:incoming', call);
        (0, push_service_1.sendIncomingCallPush)({
            targetUserId: String(targetUserId),
            callerId: call.caller?.id || '',
            callerName: call.caller?.name || 'Mitrudu',
            callerAvatar: call.caller?.avatar,
            callType: call.callType === 'video' ? 'video' : 'audio',
            callId: call.callId || '',
            roomName: call.roomName || '',
        }).catch(() => { });
        res.json({ success: true });
    }
    notifyCallResponse(req, res) {
        const { callerId, action, callId, roomName, token, serverUrl, callType, message } = req.body;
        if (!callerId) {
            res.status(400).json({ error: 'Missing callerId' });
            return;
        }
        if (action === 'accept') {
            socket_manager_1.socketManager.emitToUser(callerId, 'call:accepted', { callId, roomName, token, serverUrl, callType });
        }
        else {
            socket_manager_1.socketManager.emitToUser(callerId, 'call:declined', { callId, message });
        }
        res.json({ success: true });
    }
    notifyCallEnd(req, res) {
        const { callId, callerId, targetUserId } = req.body;
        if (callerId)
            socket_manager_1.socketManager.emitToUser(callerId, 'call:ended', { callId });
        if (targetUserId)
            socket_manager_1.socketManager.emitToUser(targetUserId, 'call:ended', { callId });
        res.json({ success: true });
    }
    async notifyRoomsChanged(_req, res) {
        try {
            await socket_manager_1.socketManager.broadcastCommunityRooms();
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    notifyRoomAction(req, res) {
        const { roomId, action, actorUserId, targetUserId, memberCount, participants } = req.body;
        if (!roomId) {
            res.status(400).json({ error: 'Missing roomId' });
            return;
        }
        // Broadcast action event to everyone inside the room
        socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'community:action', {
            roomId,
            action,
            actorUserId,
            targetUserId,
            memberCount,
            participants,
        });
        // Also trigger immediate community rooms update to all sockets so participant counts update globally in 0ms
        socket_manager_1.socketManager.broadcastCommunityRooms().catch(() => { });
        res.json({ success: true });
    }
    async updateActiveStatus(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const bodyToken = typeof req.body?.token === 'string' ? req.body.token : null;
            const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : bodyToken;
            if (!token) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            let uid;
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                uid = decoded.userId || decoded.id || decoded._id;
            }
            catch {
                res.status(401).json({ error: 'Invalid or expired token' });
                return;
            }
            if (!uid) {
                res.status(401).json({ error: 'User identifier missing in token' });
                return;
            }
            const user = await user_service_1.userService.updateActiveStatusViaHttp(uid, req.body);
            socket_manager_1.socketManager.broadcastActiveUsersInstant();
            res.json({
                success: true,
                user: {
                    id: user?._id.toString(),
                    isCallActive: Boolean(user?.isCallActive),
                    gender: user?.gender,
                    profession: user?.profession,
                    callLanguage: user?.callLanguage,
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to update active status' });
        }
    }
    async getCallToken(req, res) {
        try {
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            let userId;
            let userName = 'Mitrulu Member';
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                    userId = decoded.userId || decoded.id;
                    if (decoded.name)
                        userName = decoded.name;
                }
                catch { }
            }
            const { roomName, callId } = req.body;
            if (!roomName && !callId) {
                res.status(400).json({ error: 'roomName or callId is required' });
                return;
            }
            if (!userId) {
                userId = `anon_${Math.random().toString(36).slice(2, 9)}`;
            }
            else {
                const u = await user_service_1.userService.getUserById(userId).catch(() => null);
                if (u?.name)
                    userName = u.name;
            }
            const effectiveRoomName = roomName || callId;
            const strippedRoomName = effectiveRoomName.replace(/^circle_comm_/, '');
            // 1. Check if Community Room
            const communityRoom = await community_room_model_1.CommunityRoomModel.findOne({
                $or: [
                    { roomId: effectiveRoomName },
                    { roomId: strippedRoomName },
                    { name: effectiveRoomName },
                    { name: strippedRoomName },
                ],
            }).lean();
            if (communityRoom) {
                if (communityRoom.isStopped) {
                    res.status(403).json({
                        error: communityRoom.stoppedReason || 'This room is currently paused by admin.',
                        isStopped: true,
                    });
                    return;
                }
                const canonicalLiveKitRoom = effectiveRoomName.startsWith('circle_comm_')
                    ? effectiveRoomName
                    : `circle_comm_${communityRoom.roomId}`;
                const liveKitToken = await livekit_service_1.liveKitService.generateToken(userId, userName, canonicalLiveKitRoom);
                res.json({
                    success: true,
                    token: liveKitToken,
                    serverUrl: env_1.LIVEKIT_URL,
                    roomName: canonicalLiveKitRoom,
                    isCommunity: true,
                    callType: communityRoom.type || 'audio',
                    room: communityRoom,
                });
                return;
            }
            // 2. Check 1:1 CallSession
            const session = await call_session_repository_1.callSessionRepository.findByCallOrRoom(callId, roomName);
            if (session) {
                if (session.status === 'ended') {
                    res.status(400).json({ error: 'This call has ended.', isEnded: true });
                    return;
                }
                const isCaller = session.callerId === userId;
                const liveKitToken = await livekit_service_1.liveKitService.generateToken(userId, userName, session.roomName);
                const targetUser = isCaller
                    ? {
                        id: session.targetUserId,
                        name: session.targetUserName,
                        teluguName: session.targetUserTeluguName,
                        avatar: session.targetUserAvatar,
                    }
                    : {
                        id: session.callerId,
                        name: session.callerName,
                        teluguName: session.callerTeluguName,
                        avatar: session.callerAvatar,
                    };
                res.json({
                    success: true,
                    callId: session.callId,
                    roomName: session.roomName,
                    callType: session.callType,
                    isCaller,
                    targetUser,
                    token: liveKitToken,
                    serverUrl: env_1.LIVEKIT_URL,
                    isCommunity: false,
                });
                return;
            }
            // 3. Fallback: generate livekit token for generic room
            const fallbackToken = await livekit_service_1.liveKitService.generateToken(userId, userName, effectiveRoomName);
            res.json({
                success: true,
                token: fallbackToken,
                serverUrl: env_1.LIVEKIT_URL,
                roomName: effectiveRoomName,
                callType: 'audio',
                isCommunity: effectiveRoomName.includes('community') || effectiveRoomName.includes('room'),
            });
        }
        catch (err) {
            console.error('[getCallToken error]:', err);
            res.status(500).json({ error: err.message || 'Failed to generate call token' });
        }
    }
    async getCallHistory(req, res) {
        try {
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            let userId = req.query.userId || req.user?.userId;
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                    userId = decoded.userId || decoded.id || userId;
                }
                catch { }
            }
            if (!userId) {
                res.json({ success: true, calls: [], count: 0 });
                return;
            }
            const targetUserId = req.query.targetUserId;
            const limit = Math.min(10, Math.max(1, parseInt(req.query.limit) || 10));
            const rawCalls = await call_session_repository_1.callSessionRepository.findRecentCalls(userId, targetUserId, limit);
            const calls = rawCalls.map((c) => {
                const isCaller = String(c.callerId) === String(userId);
                const otherUser = isCaller
                    ? {
                        id: c.targetUserId,
                        name: c.targetUserName || 'User',
                        teluguName: c.targetUserTeluguName,
                        handle: '',
                        avatar: c.targetUserAvatar || '',
                    }
                    : {
                        id: c.callerId,
                        name: c.callerName || 'User',
                        teluguName: c.callerTeluguName,
                        handle: c.callerHandle || '',
                        avatar: c.callerAvatar || '',
                    };
                let direction = isCaller ? 'outgoing' : 'incoming';
                if (!isCaller && (c.status === 'timeout' || c.status === 'declined')) {
                    direction = 'missed';
                }
                return {
                    id: c._id ? String(c._id) : c.callId,
                    callId: c.callId,
                    roomName: c.roomName,
                    callType: c.callType || 'audio',
                    status: c.status,
                    direction,
                    durationSeconds: c.durationSeconds || 0,
                    createdAt: c.createdAt,
                    endedAt: c.endedAt,
                    otherUser,
                };
            });
            res.json({
                success: true,
                calls,
                count: calls.length,
            });
        }
        catch (err) {
            console.error('[getCallHistory error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to fetch call history' });
        }
    }
    extractAuthUserId(req) {
        const token = (0, auth_middleware_1.extractAuthToken)(req);
        if (!token)
            return undefined;
        const decoded = (0, auth_middleware_1.verifyAuthToken)(token);
        if (!decoded)
            return undefined;
        const uid = decoded.userId || decoded.id || decoded._id;
        return uid ? String(uid) : undefined;
    }
    async getIncomingCall(req, res) {
        try {
            const userId = this.extractAuthUserId(req);
            if (!userId) {
                res.json({ success: true, hasIncomingCall: false, call: null });
                return;
            }
            const session = await call_session_repository_1.callSessionRepository.findActiveIncomingCall(userId);
            if (!session) {
                res.json({ success: true, hasIncomingCall: false, call: null });
                return;
            }
            res.json({
                success: true,
                hasIncomingCall: true,
                call: {
                    callId: session.callId,
                    callerId: session.callerId,
                    callerName: session.callerName,
                    callerTeluguName: session.callerTeluguName,
                    callerHandle: session.callerHandle,
                    callerAvatar: session.callerAvatar,
                    roomName: session.roomName,
                    callType: session.callType,
                    caller: {
                        id: session.callerId,
                        name: session.callerName,
                        teluguName: session.callerTeluguName,
                        handle: session.callerHandle,
                        avatar: session.callerAvatar,
                    },
                },
            });
        }
        catch (err) {
            console.warn('[getIncomingCall error]:', err?.message || err);
            res.json({ success: false, hasIncomingCall: false, call: null });
        }
    }
    async getCallRespondStatus(req, res) {
        try {
            const callId = req.query.callId;
            if (!callId) {
                res.status(400).json({ success: false, error: 'callId is required' });
                return;
            }
            const session = await call_session_repository_1.callSessionRepository.findByCallId(callId);
            if (!session) {
                res.json({ success: false, error: 'Call session not found' });
                return;
            }
            res.json({ success: true, status: session.status, callId: session.callId, roomName: session.roomName });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to check call status' });
        }
    }
    async respondToCallHttp(req, res) {
        try {
            const { callId, action } = req.body || {};
            if (!callId || (action !== 'accept' && action !== 'decline')) {
                res.status(400).json({ success: false, error: 'Valid callId and action (accept|decline) are required' });
                return;
            }
            const response = await call_service_1.callService.respondToCall(callId, action);
            if (response.action === 'accept') {
                socket_manager_1.socketManager.emitToUser(response.session.callerId, 'call:accepted', {
                    callId,
                    roomName: response.session.roomName,
                    token: response.callerToken,
                    serverUrl: response.serverUrl,
                    callType: response.session.callType,
                });
                res.json({
                    success: true,
                    callId,
                    roomName: response.session.roomName,
                    token: response.receiverToken,
                    serverUrl: response.serverUrl,
                    callType: response.session.callType,
                });
            }
            else {
                socket_manager_1.socketManager.emitToUser(response.session.callerId, 'call:declined', {
                    callId,
                    message: response.message,
                });
                res.json({ success: true, declined: true });
            }
        }
        catch (err) {
            console.error('[respondToCallHttp error]:', err);
            res.status(400).json({ success: false, error: err?.message || 'Failed to respond to call' });
        }
    }
    async startCallHttp(req, res) {
        try {
            const callerId = this.extractAuthUserId(req);
            if (!callerId) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            const { targetUserId, callType = 'audio' } = req.body || {};
            const result = await call_service_1.callService.startCall(callerId, targetUserId, callType);
            socket_manager_1.socketManager.emitToUser(targetUserId, 'call:incoming', result.incomingPayload);
            (0, push_service_1.sendIncomingCallPush)({
                targetUserId: String(targetUserId),
                callerId: result.incomingPayload.caller.id,
                callerName: result.incomingPayload.caller.name,
                callerAvatar: result.incomingPayload.caller.avatar,
                callType: result.incomingPayload.callType,
                callId: result.incomingPayload.callId,
                roomName: result.incomingPayload.roomName,
            }).catch(() => { });
            const caller = await user_service_1.userService.getUserById(callerId).catch(() => null);
            res.json({
                ...result.callerResponse,
                serverUrl: env_1.LIVEKIT_URL,
                costCoins: result.costCoins,
                remainingCoins: caller?.coins,
            });
        }
        catch (err) {
            const status = err?.insufficientCoins ? 402 : err?.isOffline ? 400 : 400;
            res.status(status).json({
                success: false,
                error: err?.message || 'Call failed to initiate',
                insufficientCoins: Boolean(err?.insufficientCoins),
                isOffline: Boolean(err?.isOffline),
            });
        }
    }
    async timeoutCallHttp(req, res) {
        try {
            const callerId = this.extractAuthUserId(req);
            if (!callerId) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }
            const { targetUserId, callId, reason } = req.body || {};
            const session = callId
                ? await call_session_repository_1.callSessionRepository.findByCallId(callId)
                : await call_session_repository_1.callSessionRepository.findLatestRingingSession(callerId, targetUserId);
            if (session && session.status === 'ringing') {
                const target = await user_service_1.userService.getUserById(session.targetUserId).catch(() => null);
                const costCoins = target?.callRateCoins || 500;
                await call_service_1.callService.handleTimeout(session.callId, costCoins);
                socket_manager_1.socketManager.emitToUser(callerId, 'call:timeout', {
                    callId: session.callId,
                    message: 'కాల్ స్వీకరించబడలేదు. నాణేలు రీఫండ్ చేయబడ్డాయి (Call timed out, coins refunded).',
                });
                socket_manager_1.socketManager.emitToUser(session.targetUserId, 'call:timeout', { callId: session.callId });
            }
            if (reason === 'not_taken_within_3_min' && targetUserId) {
                await user_service_1.userService.toggleActiveStatus(targetUserId, { isCallActive: false }).catch(() => { });
                socket_manager_1.socketManager.broadcastActiveUsersInstant();
            }
            const updatedCaller = await user_service_1.userService.getUserById(callerId).catch(() => null);
            res.json({
                success: true,
                remainingCoins: updatedCaller?.coins,
            });
        }
        catch (err) {
            console.error('[timeoutCallHttp error]:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to timeout call' });
        }
    }
    async endCallHttp(req, res) {
        try {
            const { callId, roomName, durationSeconds } = req.body || {};
            const session = await call_service_1.callService.endCall(callId, roomName, durationSeconds);
            if (session) {
                socket_manager_1.socketManager.emitToUser(session.callerId, 'call:ended', { callId: session.callId });
                socket_manager_1.socketManager.emitToUser(session.targetUserId, 'call:ended', { callId: session.callId });
            }
            res.json({ success: true, session });
        }
        catch (err) {
            console.error('[endCallHttp error]:', err);
            res.status(500).json({ success: false, error: err.message || 'Failed to end call' });
        }
    }
}
exports.CircleController = CircleController;
exports.circleController = new CircleController();
