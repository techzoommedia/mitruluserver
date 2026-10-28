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

  getOnlineUserIds(): string[] {
    return Array.from(this.userSocketsMap.keys());
  }

  broadcastOnlineUsers(): void {
    if (!this.io) return;
    const onlineUserIds = Array.from(this.userSocketsMap.keys());
    this.io.emit('circle:online_users', { onlineUserIds });
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
        const uid = String(userId);
        // Join user's personal room for direct 1-on-1 signaling
        const userRoom = `user_${uid}`;
        socket.join(userRoom);

        const wasOffline = !this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid)!.size === 0;
        if (!this.userSocketsMap.has(uid)) {
          this.userSocketsMap.set(uid, new Set());
        }
        this.userSocketsMap.get(uid)!.add(socket.id);

        if (wasOffline) {
          this.broadcastOnlineUsers();
        }

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
          .catch(() => {});
      }

      // Send instant active online users list to connecting socket
      socket.emit('circle:online_users', { onlineUserIds: Array.from(this.userSocketsMap.keys()) });

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

      // ── Event: In-Call & Community 0-Latency Chat Relay ────────────
      socket.on('call:chat_message', (data: { roomName?: string; roomId?: string; message: any }) => {
        const targetRoom = data?.roomName || (data?.roomId ? `community_${data.roomId}` : null);
        if (targetRoom) {
          socket.to(targetRoom).emit('call:chat_message', data);
        } else if (data?.message?.targetUserId) {
          this.emitToUser(data.message.targetUserId, 'call:chat_message', data);
        }
      });

      // ── Event: 1-on-1 Direct Messaging (0ms Real-Time Relay) ─────
      socket.on('direct:message', (data: { targetUserId: string; message: any }) => {
        if (data?.targetUserId && data?.message) {
          const targetUid = String(data.targetUserId);
          this.emitToUser(targetUid, 'direct:message', data);
        }
      });

      // ── Event: Direct Message Status (Delivered / Seen Receipts) ──
      socket.on('direct:status', (data: { targetUserId: string; messageId?: string; status: 'delivered' | 'seen'; senderId?: string }) => {
        if (data?.targetUserId && data?.status) {
          const targetUid = String(data.targetUserId);
          const payload = {
            ...data,
            senderId: data.senderId || (userId ? String(userId) : undefined),
          };
          this.emitToUser(targetUid, 'direct:status', payload);
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
        }
      });

      // ── Event: Join / Leave Call Socket Room ─────────────────────
      socket.on('call:join_room', (data: { roomName: string }) => {
        if (data?.roomName) {
          socket.join(data.roomName);
        }
      });

      socket.on('call:leave_room', (data: { roomName: string }) => {
        if (data?.roomName) {
          socket.leave(data.roomName);
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
          const uid = String(userId);
          const affectedRooms = communityRoomStoreService.removeUserFromAllRooms(uid);
          if (affectedRooms.length > 0) {
            this.broadcastCommunityRooms(true).catch(() => {});
          }

          if (this.userSocketsMap.has(uid)) {
            this.userSocketsMap.get(uid)!.delete(socket.id);
            if (this.userSocketsMap.get(uid)!.size === 0) {
              this.userSocketsMap.delete(uid);
              this.broadcastOnlineUsers();

              // User has closed Chrome or closed their tab
              // Grace period of 3 seconds to differentiate between page refresh and closing browser
              setTimeout(async () => {
                if (!this.userSocketsMap.has(uid) || this.userSocketsMap.get(uid)!.size === 0) {
                  console.log(`[CircleSocket] User ${uid} closed Chrome/Tab - marking INACTIVE and removing from active list`);
                  userService.removeCacheUser(uid);
                  try {
                    await userService.updateActiveStatusViaHttp(uid, { isCallActive: false });
                  } catch (e) {
                    console.warn(`[CircleSocket] Error marking user ${uid} inactive on close:`, e);
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
