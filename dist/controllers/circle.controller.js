"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.circleController = exports.CircleController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_service_1 = require("../services/user.service");
const community_room_service_1 = require("../services/community-room.service");
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
            const userId = req.query.userId;
            if (!roomId) {
                res.status(400).json({ error: 'roomId is required' });
                return;
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
            const result = community_room_service_1.communityRoomService.handleRoomAction(req.body);
            const { roomId, action, actorUserId, targetUserId } = req.body;
            // Broadcast to room sockets in 0ms
            socket_manager_1.socketManager.emitToRoom(`community_${roomId}`, 'community:action', {
                roomId,
                action,
                actorUserId,
                targetUserId,
                memberCount: result.memberCount,
                participants: result.participants,
            });
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
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            if (!token) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
            const uid = decoded.userId;
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
            // 1. Check if Community Room
            const communityRoom = await community_room_model_1.CommunityRoomModel.findOne({
                $or: [{ roomId: effectiveRoomName }, { name: effectiveRoomName }],
            }).lean();
            if (communityRoom) {
                if (communityRoom.isStopped) {
                    res.status(403).json({
                        error: communityRoom.stoppedReason || 'This room is currently paused by admin.',
                        isStopped: true,
                    });
                    return;
                }
                const liveKitToken = await livekit_service_1.liveKitService.generateToken(userId, userName, communityRoom.roomId);
                res.json({
                    success: true,
                    token: liveKitToken,
                    serverUrl: env_1.LIVEKIT_URL,
                    roomName: communityRoom.roomId,
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
