import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, LIVEKIT_URL } from '../config/env';
import { userService } from '../services/user.service';
import { communityRoomService } from '../services/community-room.service';
import { communityRoomStoreService } from '../services/room-store.service';
import { socketManager } from '../sockets/socket.manager';
import { sendIncomingCallPush } from '../services/push.service';
import { CommunityRoomModel } from '../models/community-room.model';
import { callSessionRepository } from '../repositories/call-session.repository';
import { callService } from '../services/call.service';
import { liveKitService } from '../services/livekit.service';

export class CircleController {
  async getActiveUsers(req: Request, res: Response): Promise<void> {
    try {
      const gender = (req.query.gender as string) || 'all';
      const category = (req.query.category as string) || 'all';
      const users = await userService.getFilteredActiveUsers(gender, category);
      res.json({ success: true, users, count: users.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch active users' });
    }
  }

  async getCommunityRooms(_req: Request, res: Response): Promise<void> {
    try {
      const rooms = await communityRoomService.fetchCommunityRoomsWithCounts();
      res.json({ success: true, rooms, costCoins: 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch community rooms' });
    }
  }

  async joinCommunityRoom(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
      let userId = req.body.userId;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          userId = decoded.userId || decoded.id || userId;
        } catch {}
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

      const result = await communityRoomService.joinRoom(userId, roomId);

      // Instant 0ms broadcast to room socket listeners
      const canonicalRoom = communityRoomStoreService.getCanonicalId(roomId);
      socketManager.emitToRoom(`community_${roomId}`, 'community:participant_joined', {
        roomId,
        participant: {
          id: userId,
          role: 'speaker',
          isMuted: false,
          isVideoOff: false,
        },
      });
      if (canonicalRoom && canonicalRoom !== roomId) {
        socketManager.emitToRoom(`community_${canonicalRoom}`, 'community:participant_joined', {
          roomId: canonicalRoom,
          participant: {
            id: userId,
            role: 'speaker',
            isMuted: false,
            isVideoOff: false,
          },
        });
      }

      socketManager.broadcastCommunityRooms().catch(() => {});
      res.json(result);
    } catch (err: any) {
      console.error('[joinCommunityRoom error]:', err);
      res.status(err.statusCode || 500).json({ error: err.message, isStopped: err.isStopped });
    }
  }

  getRoomActions(req: Request, res: Response): void {
    try {
      const roomId = req.query.roomId as string;
      let userId = req.query.userId as string;
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
            const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            userId = decoded.userId || decoded.id;
          } catch {}
        }
      }
      const data = communityRoomService.getRoomActions(roomId, userId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  postRoomActions(req: Request, res: Response): void {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
      let decodedUserId: string | undefined;
      let decodedUser: any;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          decodedUserId = decoded.userId || decoded.id || decoded._id;
          decodedUser = decoded;
        } catch {}
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

      const result = communityRoomService.handleRoomAction(req.body);
      const { roomId, action, actorUserId, targetUserId } = req.body;

      // Broadcast to room sockets in 0ms
      socketManager.emitToRoom(`community_${roomId}`, 'community:action', {
        roomId,
        action,
        actorUserId,
        targetUserId,
        memberCount: result.memberCount,
        participants: result.participants,
      });

      const canonicalRoom = communityRoomStoreService.getCanonicalId(roomId);
      if (canonicalRoom && canonicalRoom !== roomId) {
        socketManager.emitToRoom(`community_${canonicalRoom}`, 'community:action', {
          roomId: canonicalRoom,
          action,
          actorUserId,
          targetUserId,
          memberCount: result.memberCount,
          participants: result.participants,
        });
      }

      socketManager.broadcastCommunityRooms().catch(() => {});
      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message, isBlocked: err.isBlocked });
    }
  }

  async syncActive(req: Request, res: Response): Promise<void> {
    try {
      const { userId, user, isCallActive, gender, profession, callLanguage, callCategory } = req.body;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }

      const activeState = Boolean(isCallActive);
      if (activeState) {
        userService.setCacheUser(userId, {
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
      } else {
        userService.removeCacheUser(userId);
        if (user?.id) userService.removeCacheUser(user.id);
        if (user?.handle) userService.removeCacheUser(user.handle);
      }

      socketManager.broadcastActiveUsersInstant();
      res.json({ success: true, count: userService.getCacheSize() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  notifyIncomingCall(req: Request, res: Response): void {
    const { targetUserId, call } = req.body;
    if (!targetUserId || !call) {
      res.status(400).json({ error: 'Missing targetUserId or call' });
      return;
    }
    console.log(`[CircleSocket] Forwarding incoming call alert to user_${targetUserId}`);
    socketManager.emitToUser(targetUserId, 'call:incoming', call);
    sendIncomingCallPush({
      targetUserId: String(targetUserId),
      callerId: call.caller?.id || '',
      callerName: call.caller?.name || 'Mitrudu',
      callerAvatar: call.caller?.avatar,
      callType: call.callType === 'video' ? 'video' : 'audio',
      callId: call.callId || '',
      roomName: call.roomName || '',
    }).catch(() => {});
    res.json({ success: true });
  }

  notifyCallResponse(req: Request, res: Response): void {
    const { callerId, action, callId, roomName, token, serverUrl, callType, message } = req.body;
    if (!callerId) {
      res.status(400).json({ error: 'Missing callerId' });
      return;
    }

    if (action === 'accept') {
      socketManager.emitToUser(callerId, 'call:accepted', { callId, roomName, token, serverUrl, callType });
    } else {
      socketManager.emitToUser(callerId, 'call:declined', { callId, message });
    }
    res.json({ success: true });
  }

  notifyCallEnd(req: Request, res: Response): void {
    const { callId, callerId, targetUserId } = req.body;
    if (callerId) socketManager.emitToUser(callerId, 'call:ended', { callId });
    if (targetUserId) socketManager.emitToUser(targetUserId, 'call:ended', { callId });
    res.json({ success: true });
  }

  async notifyRoomsChanged(_req: Request, res: Response): Promise<void> {
    try {
      await socketManager.broadcastCommunityRooms();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  notifyRoomAction(req: Request, res: Response): void {
    const { roomId, action, actorUserId, targetUserId, memberCount, participants } = req.body;
    if (!roomId) {
      res.status(400).json({ error: 'Missing roomId' });
      return;
    }
    // Broadcast action event to everyone inside the room
    socketManager.emitToRoom(`community_${roomId}`, 'community:action', {
      roomId,
      action,
      actorUserId,
      targetUserId,
      memberCount,
      participants,
    });

    // Also trigger immediate community rooms update to all sockets so participant counts update globally in 0ms
    socketManager.broadcastCommunityRooms().catch(() => {});
    res.json({ success: true });
  }

  async updateActiveStatus(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;

      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const uid = decoded.userId || decoded.id || decoded._id;
      if (!uid) {
        res.status(401).json({ error: 'User identifier missing in token' });
        return;
      }

      const user = await userService.updateActiveStatusViaHttp(uid, req.body);
      socketManager.broadcastActiveUsersInstant();

      res.json({
        success: true,
        user: {
          id: (user as any)?._id.toString(),
          isCallActive: Boolean((user as any)?.isCallActive),
          gender: (user as any)?.gender,
          profession: (user as any)?.profession,
          callLanguage: (user as any)?.callLanguage,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update active status' });
    }
  }

  async getCallToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
      let userId: string | undefined;
      let userName = 'Mitrulu Member';

      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          userId = decoded.userId || decoded.id;
          if (decoded.name) userName = decoded.name;
        } catch {}
      }

      const { roomName, callId } = req.body;
      if (!roomName && !callId) {
        res.status(400).json({ error: 'roomName or callId is required' });
        return;
      }

      if (!userId) {
        userId = `anon_${Math.random().toString(36).slice(2, 9)}`;
      } else {
        const u = await userService.getUserById(userId).catch(() => null);
        if (u?.name) userName = u.name;
      }

      const effectiveRoomName = roomName || callId;
      const strippedRoomName = effectiveRoomName.replace(/^circle_comm_/, '');

      // 1. Check if Community Room
      const communityRoom = await CommunityRoomModel.findOne({
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

        const liveKitToken = await liveKitService.generateToken(userId, userName, canonicalLiveKitRoom);
        res.json({
          success: true,
          token: liveKitToken,
          serverUrl: LIVEKIT_URL,
          roomName: canonicalLiveKitRoom,
          isCommunity: true,
          callType: communityRoom.type || 'audio',
          room: communityRoom,
        });
        return;
      }

      // 2. Check 1:1 CallSession
      const session = await callSessionRepository.findByCallOrRoom(callId, roomName);
      if (session) {
        if (session.status === 'ended') {
          res.status(400).json({ error: 'This call has ended.', isEnded: true });
          return;
        }

        const isCaller = session.callerId === userId;
        const liveKitToken = await liveKitService.generateToken(userId, userName, session.roomName);

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
          serverUrl: LIVEKIT_URL,
          isCommunity: false,
        });
        return;
      }

      // 3. Fallback: generate livekit token for generic room
      const fallbackToken = await liveKitService.generateToken(userId, userName, effectiveRoomName);
      res.json({
        success: true,
        token: fallbackToken,
        serverUrl: LIVEKIT_URL,
        roomName: effectiveRoomName,
        callType: 'audio',
        isCommunity: effectiveRoomName.includes('community') || effectiveRoomName.includes('room'),
      });
    } catch (err: any) {
      console.error('[getCallToken error]:', err);
      res.status(500).json({ error: err.message || 'Failed to generate call token' });
    }
  }

  async getCallHistory(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
      let userId = (req.query.userId as string) || (req as any).user?.userId;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          userId = decoded.userId || decoded.id || userId;
        } catch {}
      }

      if (!userId) {
        res.json({ success: true, calls: [], count: 0 });
        return;
      }

      const targetUserId = req.query.targetUserId as string | undefined;
      const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 10));

      const rawCalls = await callSessionRepository.findRecentCalls(userId, targetUserId, limit);

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

        let direction: 'outgoing' | 'incoming' | 'missed' = isCaller ? 'outgoing' : 'incoming';
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
    } catch (err: any) {
      console.error('[getCallHistory error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch call history' });
    }
  }

  async endCallHttp(req: Request, res: Response): Promise<void> {
    try {
      const { callId, roomName, durationSeconds } = req.body || {};
      const session = await callService.endCall(callId, roomName, durationSeconds);
      if (session) {
        socketManager.emitToUser(session.callerId, 'call:ended', { callId: session.callId });
        socketManager.emitToUser(session.targetUserId, 'call:ended', { callId: session.callId });
      }
      res.json({ success: true, session });
    } catch (err: any) {
      console.error('[endCallHttp error]:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to end call' });
    }
  }
}

export const circleController = new CircleController();
