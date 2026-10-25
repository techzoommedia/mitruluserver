import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { userService } from '../services/user.service';
import { callService } from '../services/call.service';
import { communityRoomService } from '../services/community-room.service';
import { communityRoomStoreService } from '../services/room-store.service';

export class SocketManager {
  private io: SocketIOServer | null = null;
  private userSocketsMap = new Map<string, Set<string>>();
  private callTimeoutsMap = new Map<string, NodeJS.Timeout>();

  initialize(server: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(server, {
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

  broadcastActiveUsersInstant(): void {
    if (!this.io) return;
    const users = userService.getCachedActiveUsersList();
    console.log(`[CircleSocket] Broadcasting ${users.length} active users to all ${this.io.sockets.sockets.size} connected sockets`);
    this.io.emit('circle:users_updated', { users });
  }

  async broadcastCommunityRooms(force = false): Promise<void> {
    if (!this.io) return;
    try {
      const rooms = await communityRoomService.fetchCommunityRoomsWithCounts(force);
      this.io.emit('circle:rooms_updated', { rooms });
    } catch (err) {
      console.error('[broadcastCommunityRooms] Error:', err);
    }
  }

  emitToUser(userId: string, event: string, payload: any): void {
    if (!this.io) return;
    this.io.to(`user_${userId}`).emit(event, payload);
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
          socket.data.userId = decoded.userId || decoded.id;
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
        // Join user's personal room for direct 1-on-1 signaling
        const userRoom = `user_${userId}`;
        socket.join(userRoom);

        if (!this.userSocketsMap.has(userId)) {
          this.userSocketsMap.set(userId, new Set());
        }
        this.userSocketsMap.get(userId)!.add(socket.id);

        // Fetch user's status asynchronously
        userService.getUserStatus(userId)
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
          .catch(() => {});
      }

      // 1. Instant Initial Data From Cache (0ms)
      socket.emit('circle:users_updated', { users: userService.getCachedActiveUsersList() });
      socket.emit('circle:rooms_updated', { rooms: communityRoomService.getCachedRooms() });

      // 2. Refresh cache asynchronously in background if cold
      if (userService.getCacheSize() === 0) {
        userService.syncActiveUsersFromDB()
          .then(() => {
            socket.emit('circle:users_updated', { users: userService.getCachedActiveUsersList() });
          })
          .catch(() => {});
      }
      if (communityRoomService.getCachedRooms().length === 0) {
        communityRoomService.fetchCommunityRoomsWithCounts()
          .then((rooms) => {
            socket.emit('circle:rooms_updated', { rooms });
          })
          .catch(() => {});
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
          const { callId, roomName } = data;
          const session = await callService.endCall(callId, roomName);

          if (session) {
            this.emitToUser(session.callerId, 'call:ended', { callId: session.callId });
            this.emitToUser(session.targetUserId, 'call:ended', { callId: session.callId });
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
          socket.join(`community_${roomId}`);
          if (participant?.id) {
            communityRoomStoreService.join(roomId, {
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
          this.broadcastCommunityRooms(true).catch(() => {});
        }
      });

      socket.on('community:leave', (data: { roomId: string; userId?: string }) => {
        const { roomId, userId } = data || {};
        if (roomId) {
          socket.leave(`community_${roomId}`);
          const uid = userId || socket.data.userId;
          if (uid) {
            communityRoomStoreService.leave(roomId, uid);
          }
          this.emitToRoom(`community_${roomId}`, 'community:participant_left', { roomId, userId: uid });
          this.broadcastCommunityRooms(true).catch(() => {});
        }
      });

      socket.on('community:action', (data: any) => {
        if (data?.roomId) {
          this.emitToRoom(`community_${data.roomId}`, 'community:action', data);
          this.broadcastCommunityRooms(true).catch(() => {});
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
        if (userId) {
          const affectedRooms = communityRoomStoreService.removeUserFromAllRooms(userId);
          if (affectedRooms.length > 0) {
            this.broadcastCommunityRooms(true).catch(() => {});
          }

          if (this.userSocketsMap.has(userId)) {
            this.userSocketsMap.get(userId)!.delete(socket.id);
            if (this.userSocketsMap.get(userId)!.size === 0) {
              this.userSocketsMap.delete(userId);
            }
          }
        }
      });
    });
  }
}

export const socketManager = new SocketManager();
