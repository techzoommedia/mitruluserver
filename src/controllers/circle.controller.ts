import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { userService } from '../services/user.service';
import { communityRoomService } from '../services/community-room.service';
import { socketManager } from '../sockets/socket.manager';

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
      const userId = req.query.userId as string;
      if (!roomId) {
        res.status(400).json({ error: 'roomId is required' });
        return;
      }
      const data = communityRoomService.getRoomActions(roomId, userId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  postRoomActions(req: Request, res: Response): void {
    try {
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
      const uid = decoded.userId;

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
}

export const circleController = new CircleController();
