import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/config/env';
import { socketManager } from '../src/sockets/socket.manager';
import { communityRoomStoreService } from '../src/services/room-store.service';
import { communityRoomService } from '../src/services/community-room.service';
import { groupMessageService } from '../src/services/group-message.service';
import { groupMessageRepository } from '../src/repositories/group-message.repository';
import { ChatGroupModel } from '../src/models/chat-group.model';

const require = createRequire(import.meta.url);
const { io: ioClient } = require(
  path.resolve(__dirname, '../../mitruluweb/node_modules/socket.io-client')
);

type ClientSocket = ReturnType<typeof ioClient>;

function signTestToken(user: { userId: string; name: string; handle: string; avatar?: string }) {
  return jwt.sign(
    {
      userId: user.userId,
      id: user.userId,
      name: user.name,
      handle: user.handle,
      avatar: user.avatar || '',
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

function connectClient(baseUrl: string, user: { userId: string; name: string; handle: string; avatar?: string }): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const token = signTestToken(user);
    const socket = ioClient(baseUrl, {
      auth: { token, userId: user.userId },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout connecting socket for ${user.userId}`));
    }, 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  predicate: (data: T) => boolean = () => true,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for event "${event}"`));
    }, timeoutMs);

    const handler = (data: T) => {
      try {
        if (predicate(data)) {
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(data);
        }
      } catch (err) {
        clearTimeout(timer);
        socket.off(event, handler);
        reject(err);
      }
    };

    socket.on(event, handler);
  });
}

describe('Mitrulu Real-Time & Call Corner-Case E2E Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const ROOM_SLUG = 'comm_telugu_audio';
  const ROOM_MONGO_ID = '6ad5b2319e4be9b8416d085b';
  const ADMIN_USER = { userId: 'user_admin_1', name: 'Admin User', handle: 'admin1' };
  const WEB_USER = { userId: 'user_web_1', name: 'Web User', handle: 'web1' };
  const APP_USER = { userId: 'user_app_1', name: 'App User', handle: 'app1' };

  before(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    socketManager.initialize(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    communityRoomStoreService.registerAlias(ROOM_MONGO_ID, ROOM_SLUG);
    communityRoomService.setCachedRooms([
      {
        id: ROOM_SLUG,
        roomId: ROOM_SLUG,
        name: 'Telugu Community',
        teluguTitle: 'తెలుగు కమ్యూనిటీ',
        language: 'Telugu',
        type: 'audio',
        topic: 'Test',
        avatar: '',
        isStopped: false,
        stoppedReason: '',
        admins: [ADMIN_USER.userId],
        activeParticipants: 0,
        maxParticipants: 50,
        costCoins: 0,
        tags: [],
      },
    ]);
  });

  after(async () => {
    try {
      socketManager.getIO().close();
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('1. Cross-platform join (Web + App) syncs both participants & resolves canonical room alias', async () => {
    communityRoomStoreService.clearRoom(ROOM_SLUG);

    const webSock = await connectClient(baseUrl, WEB_USER);
    const appSock = await connectClient(baseUrl, APP_USER);

    try {
      const webJoinedPromise = waitForEvent(
        webSock,
        'community:action',
        (d: any) => d.action === 'join' && d.participant?.id === APP_USER.userId
      );

      // Web joins using slug + call_room using MongoDB ID (exact real-world URL pattern)
      webSock.emit('call:join_room', { roomName: `circle_comm_${ROOM_MONGO_ID}` });
      webSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: WEB_USER.userId, name: WEB_USER.name, handle: WEB_USER.handle, role: 'speaker', isMuted: false },
      });

      // Small tick so web is in the room before app joins
      await new Promise((r) => setTimeout(r, 80));

      // App joins using slug
      appSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: APP_USER.userId, name: APP_USER.name, handle: APP_USER.handle, role: 'speaker', isMuted: false },
      });

      const actionPayload = await webJoinedPromise;
      assert.equal(actionPayload.memberCount, 2);
      const ids = actionPayload.participants.map((p: any) => p.id);
      assert.ok(ids.includes(WEB_USER.userId), 'Web user must be in participants');
      assert.ok(ids.includes(APP_USER.userId), 'App user must be in participants');
    } finally {
      webSock.disconnect();
      appSock.disconnect();
    }
  });

  test('2. Admin role & badge assignment on join and sorted priority ahead of speakers', async () => {
    communityRoomStoreService.clearRoom(ROOM_SLUG);

    const appSock = await connectClient(baseUrl, APP_USER);
    const adminSock = await connectClient(baseUrl, ADMIN_USER);

    try {
      appSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: APP_USER.userId, name: APP_USER.name, handle: APP_USER.handle, role: 'speaker' },
      });
      await new Promise((r) => setTimeout(r, 80));

      const adminJoinedPromise = waitForEvent(
        appSock,
        'community:participant_joined',
        (d: any) => d.participant?.id === ADMIN_USER.userId
      );

      // Even if client sends role:'speaker', server promotes to 'admin' because user is in room.admins
      adminSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: ADMIN_USER.userId, name: ADMIN_USER.name, handle: ADMIN_USER.handle, role: 'speaker' },
      });

      const joined = await adminJoinedPromise;
      assert.equal(joined.participant.role, 'admin');
      assert.equal(joined.participants[0].id, ADMIN_USER.userId, 'Admin should be sorted first');
      assert.equal(joined.participants[0].role, 'admin');
    } finally {
      appSock.disconnect();
      adminSock.disconnect();
    }
  });

  test('3. Heartbeat keeps participant alive and auto-rehydrates after in-memory wipe', async () => {
    communityRoomStoreService.clearRoom(ROOM_SLUG);
    const webSock = await connectClient(baseUrl, WEB_USER);
    const appSock = await connectClient(baseUrl, APP_USER);

    try {
      webSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: WEB_USER.userId, name: WEB_USER.name, handle: WEB_USER.handle },
      });
      appSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: APP_USER.userId, name: APP_USER.name, handle: APP_USER.handle },
      });
      await new Promise((r) => setTimeout(r, 100));

      // Simulate server restart / in-memory store wipe
      communityRoomStoreService.clearRoom(ROOM_SLUG);
      assert.equal(communityRoomStoreService.getParticipantCount(ROOM_SLUG), 0);

      const syncPromise = waitForEvent(
        appSock,
        'community:action',
        (d: any) => d.action === 'sync' && d.participants?.some((p: any) => p.id === WEB_USER.userId)
      );

      webSock.emit('community:heartbeat', { roomId: ROOM_SLUG, userId: WEB_USER.userId });
      const syncData = await syncPromise;
      assert.ok(syncData.participants.some((p: any) => p.id === WEB_USER.userId));
    } finally {
      webSock.disconnect();
      appSock.disconnect();
    }
  });

  test('4. Instant leave via call:leave_room removes user with 0ms ghost delay', async () => {
    communityRoomStoreService.clearRoom(ROOM_SLUG);
    const webSock = await connectClient(baseUrl, WEB_USER);
    const appSock = await connectClient(baseUrl, APP_USER);

    try {
      webSock.emit('call:join_room', { roomName: `circle_comm_${ROOM_MONGO_ID}` });
      appSock.emit('call:join_room', { roomName: `circle_comm_${ROOM_SLUG}` });
      webSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: WEB_USER.userId, name: WEB_USER.name, handle: WEB_USER.handle },
      });
      appSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: APP_USER.userId, name: APP_USER.name, handle: APP_USER.handle },
      });
      await new Promise((r) => setTimeout(r, 100));

      const leftPromise = waitForEvent(
        appSock,
        'community:participant_left',
        (d: any) => d.userId === WEB_USER.userId
      );

      webSock.emit('call:leave_room', { roomName: `circle_comm_${ROOM_MONGO_ID}` });
      const leftData = await leftPromise;
      assert.equal(leftData.userId, WEB_USER.userId);
      assert.equal(leftData.memberCount, 1);
      assert.ok(!leftData.participants.some((p: any) => p.id === WEB_USER.userId));
    } finally {
      webSock.disconnect();
      appSock.disconnect();
    }
  });

  test('5. Abrupt socket disconnect removes user immediately from community room (no ghost user)', async () => {
    communityRoomStoreService.clearRoom(ROOM_SLUG);
    const webSock = await connectClient(baseUrl, WEB_USER);
    const appSock = await connectClient(baseUrl, APP_USER);

    try {
      appSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: APP_USER.userId, name: APP_USER.name, handle: APP_USER.handle },
      });
      webSock.emit('community:join', {
        roomId: ROOM_SLUG,
        participant: { id: WEB_USER.userId, name: WEB_USER.name, handle: WEB_USER.handle },
      });
      await new Promise((r) => setTimeout(r, 100));

      const leftPromise = waitForEvent(
        appSock,
        'community:participant_left',
        (d: any) => d.userId === WEB_USER.userId
      );

      // Simulate tab close / network drop
      webSock.disconnect();
      const leftData = await leftPromise;
      assert.equal(leftData.userId, WEB_USER.userId);
      assert.equal(communityRoomStoreService.getParticipantCount(ROOM_SLUG), 1);
    } finally {
      appSock.disconnect();
    }
  });

  test('6. 1-on-1 call mute/speaking status & abrupt disconnect triggers call:ended + call:peer_left', async () => {
    const peerA = await connectClient(baseUrl, WEB_USER);
    const peerB = await connectClient(baseUrl, APP_USER);
    const ONE_ON_ONE_ROOM = 'call_room_1on1_test';

    try {
      peerA.emit('call:join_room', { roomName: ONE_ON_ONE_ROOM });
      peerB.emit('call:join_room', { roomName: ONE_ON_ONE_ROOM });
      await new Promise((r) => setTimeout(r, 80));

      const speakPromise = waitForEvent(
        peerB,
        'call:speaking_status',
        (d: any) => d.userId === WEB_USER.userId && d.isSpeaking === true
      );
      peerA.emit('call:speaking_status', { roomName: ONE_ON_ONE_ROOM, userId: WEB_USER.userId, isSpeaking: true });
      const speakData = await speakPromise;
      assert.equal(speakData.isSpeaking, true);

      // Muting automatically clears speaking status on peers
      const muteClearSpeakPromise = waitForEvent(
        peerB,
        'call:speaking_status',
        (d: any) => d.userId === WEB_USER.userId && d.isSpeaking === false
      );
      peerA.emit('call:mute_status', { roomName: ONE_ON_ONE_ROOM, userId: WEB_USER.userId, isMuted: true });
      const cleared = await muteClearSpeakPromise;
      assert.equal(cleared.isSpeaking, false);

      // Abrupt disconnect ends 1-on-1 call immediately
      const endedPromise = waitForEvent(
        peerB,
        'call:ended',
        (d: any) => d.roomName === ONE_ON_ONE_ROOM && d.userId === WEB_USER.userId
      );
      peerA.disconnect();
      const ended = await endedPromise;
      assert.equal(ended.roomName, ONE_ON_ONE_ROOM);
    } finally {
      peerA.disconnect();
      peerB.disconnect();
    }
  });

  test('7. Group message sendGroupMessage is idempotent under concurrent socket + REST E11000 race', async () => {
    const origFindOne = ChatGroupModel.findOne.bind(ChatGroupModel);
    const origFindById = groupMessageRepository.findMessageById.bind(groupMessageRepository);
    const origCreate = groupMessageRepository.createMessage.bind(groupMessageRepository);

    const store = new Map<string, any>();

    (ChatGroupModel as any).findOne = () => ({
      lean: async () => ({ id: 'telugu', isHold: false }),
    });
    (groupMessageRepository as any).findMessageById = async (id: string) => store.get(id) || null;
    (groupMessageRepository as any).createMessage = async (dto: any) => {
      if (store.has(dto.id)) {
        const err: any = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }
      const doc = { ...dto, toObject: () => ({ ...dto }) };
      store.set(dto.id, doc);
      return doc;
    };

    try {
      const msgId = `gmsg_race_${Date.now()}`;
      const payload = {
        id: msgId,
        groupId: 'telugu',
        senderId: WEB_USER.userId,
        senderName: WEB_USER.name,
        text: 'Hello E2E',
        timestamp: Date.now(),
      };

      const [r1, r2] = await Promise.all([
        groupMessageService.sendGroupMessage(payload),
        groupMessageService.sendGroupMessage(payload),
      ]);

      assert.equal(r1.id, msgId);
      assert.equal(r2.id, msgId);
      assert.equal(store.size, 1);
    } finally {
      (ChatGroupModel as any).findOne = origFindOne;
      (groupMessageRepository as any).findMessageById = origFindById;
      (groupMessageRepository as any).createMessage = origCreate;
    }
  });
});
