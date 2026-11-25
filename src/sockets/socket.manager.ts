import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { userService } from '../services/user.service';
import { callService } from '../services/call.service';
import { communityRoomService } from '../services/community-room.service';
import { communityRoomStoreService } from '../services/room-store.service';
import { UserModel } from '../models/user.model';
import { messageService } from '../services/message.service';
import { groupMessageService } from '../services/group-message.service';
import { sendIncomingCallPush } from '../services/push.service';

export class SocketManager {
  private io: SocketIOServer | null = null;
  private userSocketsMap = new Map<string, Set<string>>();
  private lastSeenMap = new Map<string, number>();
  private callTimeoutsMap = new Map<string, NodeJS.Timeout>();
  private socketCommunityRooms = new Map<string, Set<string>>();
  private socketCallRooms = new Map<string, Set<string>>();
  private lastRoomsBroadcastHash = '';

  initialize(server: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: (_reqOrigin, callback) => {
          callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    this.setupAuthMiddleware();
    this.setupConnectionHandlers();

    return this.io;
  }

  getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io server has not been initialized');
    }
    return this.io;
  }

  getActiveSocketsCount(): number {
    return this.io ? this.io.sockets.sockets.size : 0;
  }

  getOnlineUsersCount(): number {
    return this.userSocketsMap.size;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userSocketsMap.keys());
  }

  getLastSeenMap(): Record<string, number> {
    return Object.fromEntries(this.lastSeenMap);
  }

  broadcastOnlineUsers(): void {
    if (!this.io) return;
    const onlineUserIds = Array.from(this.userSocketsMap.keys());
    this.io.emit('circle:online_users', {
      onlineUserIds,
      lastSeenMap: Object.fromEntries(this.lastSeenMap),
    });
  }

  broadcastActiveUsersInstant(): void {
    if (!this.io) return;
    const users = userService.getCachedActiveUsersList();
    console.log(`[CircleSocket] Broadcasting ${users.length} active users to all ${this.io.sockets.sockets.size} connected sockets`);
    this.io.emit('circle:users_updated', { users });
  }

  async broadcastCommunityRooms(force = false): Promise<void> {
    if (!this.io || mongoose.connection.readyState !== 1) return;
    try {
      const rooms = await communityRoomService.fetchCommunityRoomsWithCounts(force);
      const hash = rooms
        .map((r) => `${r.roomId}:${r.activeParticipants}:${r.isStopped}:${(r.admins || []).join(',')}:${r.name}:${r.teluguTitle}:${r.avatar}`)
        .join('|');
      if (!force && hash === this.lastRoomsBroadcastHash) {
        return;
      }
      this.lastRoomsBroadcastHash = hash;
      this.io.emit('circle:rooms_updated', { rooms });
    } catch (err) {
      console.error('[broadcastCommunityRooms] Error:', err);
    }
  }

  emitToUser(userId: string, event: string, payload: any, exceptSocketId?: string): void {
    if (!this.io) return;
    const room = `user_${userId}`;
    if (exceptSocketId) {
      this.io.to(room).except(exceptSocketId).emit(event, payload);
    } else {
      this.io.to(room).emit(event, payload);
    }
  }

  emitToRoom(room: string, event: string, payload: any): void {
    if (!this.io) return;
    this.io.to(room).emit(event, payload);
  }

  private setupAuthMiddleware(): void {
    if (!this.io) return;

    this.io.use((socket: Socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : null);
      const authUserId = socket.handshake.auth?.userId;

      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
          socket.data.userId = decoded.userId || decoded.id || decoded._id || authUserId;
          socket.data.user = decoded;
        } catch (e) {
          if (authUserId) {
            socket.data.userId = authUserId;
          }
        }
      } else if (authUserId) {
        socket.data.userId = authUserId;
      }

      next();
    });
  }

  private setupConnectionHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;

      if (userId) {
        const uid = String(userId);
        // Join user's personal room for direct 1-on-1 signaling
        const userRoom = `user_${uid}`;
        socket.join(userRoom);

        const wasOffline = !this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid)!.size === 0;
        if (!this.userSocketsMap.has(uid)) {
          this.userSocketsMap.set(uid, new Set());
        }
        this.userSocketsMap.get(uid)!.add(socket.id);
        this.lastSeenMap.delete(uid);

        if (wasOffline) {
          this.broadcastOnlineUsers();
        }

        const isDbReady = mongoose.connection.readyState === 1;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(uid);

        if (isDbReady && isValidObjectId) {
          // Also join user's handle and mitraId rooms so messages sent to handle reach socket
          UserModel.findById(uid)
            .select('_id handle mitraId')
            .lean()
            .then((u: any) => {
              if (u) {
                if (u.handle) socket.join(`user_${String(u.handle).toLowerCase()}`);
                if (u.mitraId) socket.join(`user_${String(u.mitraId).toLowerCase()}`);
              }
            })
            .catch(() => { });

          // Automatically mark all pending sent messages as delivered
          messageService.markDeliveredForUser(uid).catch((err) => {
            console.warn('[CircleSocket] Error marking delivered for user:', err);
          });

          // Fetch user's status asynchronously
          userService.getUserStatus(uid)
            .then((dbUser) => {
              if (dbUser) {
                socket.emit('circle:my_status_init', {
                  isCallActive: Boolean((dbUser as any).isCallActive),
                  gender: (dbUser as any).gender,
                  profession: (dbUser as any).profession,
                  callLanguage: (dbUser as any).callLanguage,
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
      socket.emit('circle:users_updated', { users: userService.getCachedActiveUsersList() });
      socket.emit('circle:rooms_updated', { rooms: communityRoomService.getCachedRooms() });

      // 2. Refresh cache asynchronously in background if cold and DB is ready
      if (mongoose.connection.readyState === 1) {
        if (userService.getCacheSize() === 0) {
          userService.syncActiveUsersFromDB()
            .then(() => {
              socket.emit('circle:users_updated', { users: userService.getCachedActiveUsersList() });
            })
            .catch(() => { });
        }
        if (communityRoomService.getCachedRooms().length === 0) {
          communityRoomService.fetchCommunityRoomsWithCounts()
            .then((rooms) => {
              socket.emit('circle:rooms_updated', { rooms });
            })
            .catch(() => { });
        }
      }

      // ── Event: Toggle Active ─────────────────────────────────────
      socket.on('circle:toggle_active', async (data: any, callback?: Function) => {
        const uid = socket.data.userId || data?.userId || data?.user?.id;
        if (!uid) {
          console.warn('[circle:toggle_active] Unauthorized: no userId found');
          return callback?.({ success: false, error: 'Unauthorized: missing user identifier' });
        }

        try {
          const activeState = await userService.toggleActiveStatus(uid, {
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
        } catch (err: any) {
          console.error('[circle:toggle_active error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to toggle status' });
        }
      });

      // ── Event: Start Call ────────────────────────────────────────
      socket.on('call:start', async (data: any, callback?: Function) => {
        if (!socket.data.userId) {
          return callback?.({ success: false, error: 'Unauthorized' });
        }

        try {
          const callerId = socket.data.userId;
          const { targetUserId, callType = 'audio' } = data;

          const result = await callService.startCall(callerId, targetUserId, callType);

          // Emit incoming alert to target user
          this.emitToUser(targetUserId, 'call:incoming', result.incomingPayload);

          // Also send Firebase Push Notification labeled explicitly as incoming_call
          sendIncomingCallPush({
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
              const timedOutSession = await callService.handleTimeout(callId, costCoins);
              if (timedOutSession) {
                this.emitToUser(callerId, 'call:timeout', {
                  callId,
                  message: 'కాల్ స్వీకరించబడలేదు. నాణేలు రీఫండ్ చేయబడ్డాయి (Call timed out, coins refunded).',
                });
                this.emitToUser(targetUserId, 'call:timeout', { callId });
              }
            } catch (e) {
              console.error('[call:timeout handler error]:', e);
            } finally {
              this.callTimeoutsMap.delete(callId);
            }
          }, 60000);

          this.callTimeoutsMap.set(callId, timeout);
          callback?.(result.callerResponse);
        } catch (err: any) {
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
      socket.on('call:respond', async (data: any, callback?: Function) => {
        if (!socket.data.userId) {
          return callback?.({ success: false, error: 'Unauthorized' });
        }

        try {
          const { callId, action } = data;

          if (this.callTimeoutsMap.has(callId)) {
            clearTimeout(this.callTimeoutsMap.get(callId)!);
            this.callTimeoutsMap.delete(callId);
          }

          const response = await callService.respondToCall(callId, action);

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
          } else {
            this.emitToUser(response.session.callerId, 'call:declined', {
              callId,
              message: response.message,
            });

            callback?.({ success: true, declined: true });
          }
        } catch (err: any) {
          console.error('[call:respond error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to respond to call' });
        }
      });

      // ── Event: End Call ──────────────────────────────────────────
      socket.on('call:end', async (data: any, callback?: Function) => {
        try {
          const { callId, roomName, durationSeconds } = data || {};
          const session = await callService.endCall(callId, roomName, durationSeconds);

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
        } catch (err: any) {
          console.error('[call:end error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to end call' });
        }
      });

      // ── Event: Community Room Join / Leave / Action ──────────────
      socket.on('community:join', (data: { roomId: string; participant?: any }) => {
        const { roomId, participant } = data || {};
        if (roomId) {
          const canonicalId = communityRoomStoreService.getCanonicalId(roomId);
          socket.join(`community_${roomId}`);
          socket.join(`circle_comm_${roomId}`);
          if (canonicalId && canonicalId !== roomId) {
            socket.join(`community_${canonicalId}`);
            socket.join(`circle_comm_${canonicalId}`);
          }

          if (!this.socketCommunityRooms.has(socket.id)) {
            this.socketCommunityRooms.set(socket.id, new Set());
          }
          this.socketCommunityRooms.get(socket.id)!.add(roomId);
          if (canonicalId) this.socketCommunityRooms.get(socket.id)!.add(canonicalId);

          const uid = participant?.id || socket.data.userId;
          const isAdmin = uid ? communityRoomService.isUserRoomAdmin(roomId, String(uid)) : false;
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
            communityRoomStoreService.join(roomId, resolvedParticipant);
          }
          const sorted = communityRoomStoreService.getSortedParticipants(roomId);
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

      socket.on('community:leave', (data: { roomId: string; userId?: string }) => {
        const { roomId, userId } = data || {};
        if (roomId) {
          const canonicalId = communityRoomStoreService.getCanonicalId(roomId);
          socket.leave(`community_${roomId}`);
          socket.leave(`circle_comm_${roomId}`);
          if (canonicalId && canonicalId !== roomId) {
            socket.leave(`community_${canonicalId}`);
            socket.leave(`circle_comm_${canonicalId}`);
          }
          if (this.socketCommunityRooms.has(socket.id)) {
            this.socketCommunityRooms.get(socket.id)!.delete(roomId);
            if (canonicalId) this.socketCommunityRooms.get(socket.id)!.delete(canonicalId);
          }
          const uid = userId || socket.data.userId;
          if (uid) {
            communityRoomStoreService.leave(roomId, uid);
          }
          const sorted = communityRoomStoreService.getSortedParticipants(roomId);
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

      socket.on('community:action', (data: any) => {
        if (data?.roomId) {
          const canonicalId = communityRoomStoreService.getCanonicalId(data.roomId);
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

      socket.on('community:heartbeat', (data: { roomId?: string; userId?: string }) => {
        const roomId = data?.roomId;
        const uid = data?.userId || socket.data.userId;
        if (roomId && uid) {
          const found = communityRoomStoreService.heartbeat(roomId, String(uid));
          if (!found && socket.data.user) {
            const isAdmin = communityRoomService.isUserRoomAdmin(roomId, String(uid));
            communityRoomStoreService.join(roomId, {
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
            const sorted = communityRoomStoreService.getSortedParticipants(roomId);
            const canonicalId = communityRoomStoreService.getCanonicalId(roomId);
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
      socket.on('call:chat_message', (data: { roomName?: string; roomId?: string; message: any }) => {
        const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
        if (targetRoom) {
          socket.to(targetRoom).emit('call:chat_message', data);
        } else if (data?.message?.targetUserId) {
          this.emitToUser(data.message.targetUserId, 'call:chat_message', data);
        }
      });

      // ── Event: 1-on-1 Direct Messaging (Full Node.js Backend Persistence + 0ms Real-Time Delivery) ─────
      socket.on('direct:message', async (data: { targetUserId: string; message: any }, callback?: Function) => {
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
          const savedMessage = await messageService.sendMessage({
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
        } catch (err: any) {
          console.error('[Socket direct:message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to send message' });
        }
      });

      // ── Event: Direct Message Status (Delivered / Seen Receipts) ──
      socket.on('direct:status', async (data: { targetUserId: string; messageId?: string; status: 'delivered' | 'seen'; senderId?: string }, callback?: Function) => {
        try {
          if (!data?.targetUserId || !data?.status) {
            return callback?.({ success: false, error: 'Invalid status payload' });
          }

          const myId = socket.data.userId || data.senderId;
          if (myId) {
            await messageService.updateStatus(String(myId), String(data.targetUserId), data.status, data.messageId);
          }

          callback?.({ success: true });
        } catch (err: any) {
          console.error('[Socket direct:status error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to update status' });
        }
      });

      // ── Event: Real-time Typing Indicator ────────────────────────
      socket.on('direct:typing', (data: { targetUserId: string; isTyping: boolean }) => {
        if (data?.targetUserId) {
          const senderId = socket.data.userId;
          this.emitToUser(String(data.targetUserId), 'direct:typing', {
            senderId,
            isTyping: Boolean(data.isTyping),
          });
        }
      });

      // ── Event: Edit Direct Message ───────────────────────────────
      socket.on('direct:edit_message', async (data: { messageId: string; text: string; senderId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.senderId;
          if (!uid || !data?.messageId || !data?.text?.trim()) {
            return callback?.({ success: false, error: 'messageId and text are required' });
          }
          const updated = await messageService.editMessage(String(uid), String(data.messageId), String(data.text), socket.id);
          callback?.({ success: true, message: updated });
        } catch (err: any) {
          console.error('[Socket direct:edit_message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to edit message' });
        }
      });

      // ── Event: Unsend Direct Message (both sides) ────────────────
      socket.on('direct:unsend_message', async (data: { messageId: string; senderId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.senderId;
          if (!uid || !data?.messageId) {
            return callback?.({ success: false, error: 'messageId is required' });
          }
          const result = await messageService.unsendMessage(String(uid), String(data.messageId), socket.id);
          callback?.(result);
        } catch (err: any) {
          console.error('[Socket direct:unsend_message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to unsend message' });
        }
      });

      // ── Event: Delete Direct Message for Me ──────────────────────
      socket.on('direct:delete_for_me', async (data: { messageId: string; userId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.userId;
          if (!uid || !data?.messageId) {
            return callback?.({ success: false, error: 'messageId is required' });
          }
          const result = await messageService.deleteMessageForMe(String(uid), String(data.messageId), socket.id);
          callback?.(result);
        } catch (err: any) {
          console.error('[Socket direct:delete_for_me error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to delete message for me' });
        }
      });

      // ── Event: Delete Conversation ('me' | 'both') ───────────────
      socket.on('direct:delete_chat', async (data: { partnerId: string; scope?: 'me' | 'both'; userId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.userId;
          if (!uid || !data?.partnerId) {
            return callback?.({ success: false, error: 'partnerId is required' });
          }
          const scope = data.scope === 'me' ? 'me' : 'both';
          const result = await messageService.deleteConversation(String(uid), String(data.partnerId), scope, socket.id);
          callback?.(result);
        } catch (err: any) {
          console.error('[Socket direct:delete_chat error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to delete conversation' });
        }
      });

      // ── Event: Group Messaging (Public Community Groups e.g. Telugu) ──
      socket.on('group:join', (data: { groupId?: string }) => {
        const gid = data?.groupId || 'telugu';
        socket.join(`group_${gid}`);
      });

      socket.on('group:leave', (data: { groupId?: string }) => {
        const gid = data?.groupId || 'telugu';
        socket.leave(`group_${gid}`);
      });

      socket.on('group:message', async (data: { groupId?: string; message: any }, callback?: Function) => {
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

          const savedMessage = await groupMessageService.sendGroupMessage({
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
        } catch (err: any) {
          console.error('[Socket group:message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to send group message' });
        }
      });

      socket.on('group:edit_message', async (data: { messageId: string; text: string; senderId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.senderId;
          if (!uid || !data?.messageId || !data?.text?.trim()) {
            return callback?.({ success: false, error: 'messageId and text are required' });
          }
          const updated = await groupMessageService.editGroupMessage(String(uid), String(data.messageId), String(data.text));
          callback?.({ success: true, message: updated });
        } catch (err: any) {
          console.error('[Socket group:edit_message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to edit group message' });
        }
      });

      socket.on('group:unsend_message', async (data: { messageId: string; userId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.userId;
          if (!uid || !data?.messageId) {
            return callback?.({ success: false, error: 'messageId is required' });
          }
          const result = await groupMessageService.unsendGroupMessage(String(uid), String(data.messageId));
          callback?.(result);
        } catch (err: any) {
          console.error('[Socket group:unsend_message error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to unsend group message' });
        }
      });

      socket.on('group:delete_for_me', async (data: { messageId: string; userId?: string }, callback?: Function) => {
        try {
          const uid = socket.data.userId || data?.userId;
          if (!uid || !data?.messageId) {
            return callback?.({ success: false, error: 'messageId is required' });
          }
          const result = await groupMessageService.deleteGroupMessageForMe(String(uid), String(data.messageId));
          callback?.(result);
        } catch (err: any) {
          console.error('[Socket group:delete_for_me error]:', err);
          callback?.({ success: false, error: err.message || 'Failed to delete group message for me' });
        }
      });

      // ── Event: Hand Raise Broadcast (0ms) ────────────────────────
      socket.on('call:hand_raise', (data: { roomName?: string; roomId?: string; userId: string; name: string; isRaised: boolean; avatar?: string }) => {
        const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
        if (targetRoom) {
          socket.to(targetRoom).emit('call:hand_raise', data);
        }
      });

      socket.on('community:raise_hand', (data: { roomId: string; userId: string; name: string; isRaised: boolean; avatar?: string }) => {
        if (data?.roomId) {
          socket.to(`community_${data.roomId}`).emit('call:hand_raise', {
            roomId: data.roomId,
            roomName: `community_${data.roomId}`,
            ...data,
          });
        }
      });

      // ── Event: Microphone Mute Status Broadcast (0ms) ────────────
      socket.on('call:mute_status', (data: { roomName?: string; roomId?: string; userId: string; isMuted: boolean }) => {
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
      socket.on('call:speaking_status', (data: { roomName?: string; roomId?: string; userId: string; isSpeaking: boolean }) => {
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
      socket.on('call:join_room', (data: { roomName: string }) => {
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
          this.socketCallRooms.get(socket.id)!.add(data.roomName);

          // Also bridge community room listeners automatically
          const cleanId = data.roomName.replace(/^circle_comm_/, '');
          socket.join(`community_${cleanId}`);
          socket.join(`circle_comm_${cleanId}`);
          const canonical = communityRoomStoreService.getCanonicalId(cleanId);
          if (canonical && canonical !== cleanId) {
            socket.join(`community_${canonical}`);
            socket.join(`circle_comm_${canonical}`);
          }
          if (!this.socketCommunityRooms.has(socket.id)) {
            this.socketCommunityRooms.set(socket.id, new Set());
          }
          this.socketCommunityRooms.get(socket.id)!.add(cleanId);
          if (canonical) this.socketCommunityRooms.get(socket.id)!.add(canonical);

          const sorted = communityRoomStoreService.getSortedParticipants(cleanId);
          if (sorted.length > 0) {
            socket.emit('community:action', { roomId: cleanId, action: 'sync', participants: sorted, memberCount: sorted.length });
          }
        }
      });

      socket.on('call:leave_room', (data: { roomName: string }) => {
        if (data?.roomName) {
          const uid = socket.data.userId ? String(socket.data.userId) : undefined;
          socket.leave(data.roomName);
          if (this.socketCallRooms.has(socket.id)) {
            this.socketCallRooms.get(socket.id)!.delete(data.roomName);
          }

          if (uid) {
            socket.to(data.roomName).emit('call:peer_left', {
              roomName: data.roomName,
              userId: uid,
            });
          }

          const cleanId = data.roomName.replace(/^circle_comm_/, '');
          const isCommRoom =
            data.roomName.startsWith('circle_comm_') ||
            this.socketCommunityRooms.get(socket.id)?.has(cleanId);

          if (isCommRoom) {
            const canonicalId = communityRoomStoreService.getCanonicalId(cleanId);
            socket.leave(`community_${cleanId}`);
            socket.leave(`circle_comm_${cleanId}`);
            if (canonicalId && canonicalId !== cleanId) {
              socket.leave(`community_${canonicalId}`);
              socket.leave(`circle_comm_${canonicalId}`);
            }

            if (this.socketCommunityRooms.has(socket.id)) {
              this.socketCommunityRooms.get(socket.id)!.delete(cleanId);
              if (canonicalId) this.socketCommunityRooms.get(socket.id)!.delete(canonicalId);
            }

            if (uid) {
              communityRoomStoreService.leave(cleanId, uid);
              const sorted = communityRoomStoreService.getSortedParticipants(cleanId);
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
        socket.emit('circle:users_updated', { users: userService.getCachedActiveUsersList() });
        const rooms = await communityRoomService.fetchCommunityRoomsWithCounts(true);
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
              communityRoomStoreService.leave(rId, uid);
              const sorted = communityRoomStoreService.getSortedParticipants(rId);
              const leftPayload = { roomId: rId, userId: uid, participants: sorted, memberCount: sorted.length };
              const actionPayload = { roomId: rId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };

              this.emitToRoom(`community_${rId}`, 'community:participant_left', leftPayload);
              this.emitToRoom(`community_${rId}`, 'community:action', actionPayload);
              this.emitToRoom(`circle_comm_${rId}`, 'community:participant_left', leftPayload);
              this.emitToRoom(`circle_comm_${rId}`, 'community:action', actionPayload);
              this.emitToRoom(rId, 'community:action', actionPayload);

              const canonicalId = communityRoomStoreService.getCanonicalId(rId);
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
            this.userSocketsMap.get(uid)!.delete(socket.id);
            if (this.userSocketsMap.get(uid)!.size === 0) {
              this.userSocketsMap.delete(uid);
              const now = Date.now();
              this.lastSeenMap.set(uid, now);
              if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(uid)) {
                UserModel.findByIdAndUpdate(uid, { lastSeen: new Date(now) }).exec().catch(() => { });
              }
              this.broadcastOnlineUsers();

              // User has closed all tabs/app
              setTimeout(async () => {
                if (!this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid)!.size === 0) {
                  const affectedRooms = communityRoomStoreService.removeUserFromAllRooms(uid);
                  if (affectedRooms.length > 0) {
                    for (const rId of affectedRooms) {
                      const sorted = communityRoomStoreService.getSortedParticipants(rId);
                      const leftPayload = { roomId: rId, userId: uid, participants: sorted, memberCount: sorted.length };
                      const actionPayload = { roomId: rId, action: 'leave', userId: uid, participants: sorted, memberCount: sorted.length };

                      this.emitToRoom(`community_${rId}`, 'community:participant_left', leftPayload);
                      this.emitToRoom(`community_${rId}`, 'community:action', actionPayload);
                      this.emitToRoom(`circle_comm_${rId}`, 'community:participant_left', leftPayload);
                      this.emitToRoom(`circle_comm_${rId}`, 'community:action', actionPayload);
                      const canonicalId = communityRoomStoreService.getCanonicalId(rId);
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
                  userService.removeCacheUser(uid);
                  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(uid)) {
                    try {
                      await userService.updateActiveStatusViaHttp(uid, { isCallActive: false });
                    } catch (e) {
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

export const socketManager = new SocketManager();
