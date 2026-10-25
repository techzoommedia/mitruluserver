import http from 'http';
import { createApp } from './app';
import { PORT } from './config/env';
import { connectMongoDBWithRetry } from './config/database';
import { socketManager } from './sockets/socket.manager';
import { userService } from './services/user.service';
import { communityRoomService } from './services/community-room.service';

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO with all signaling & authentication handlers
socketManager.initialize(server);

// Periodic background sync for community rooms (every 3s broadcast to all sockets)
setInterval(async () => {
  if (socketManager.getActiveSocketsCount() > 0) {
    await socketManager.broadcastCommunityRooms();
  }
}, 3000);

async function startServer() {
  server.listen(PORT, () => {
    console.log(`[Mitrulu Server] Real-Time Circle Server running on port ${PORT}`);
    console.log(`[Mitrulu Server] WebSocket URL: ws://localhost:${PORT}`);
  });

  // Connect MongoDB with resilience & retry logic
  connectMongoDBWithRetry(async () => {
    // Pre-warm in-memory cache so connected clients get 0ms instantaneous data
    await userService.syncActiveUsersFromDB();
    communityRoomService.fetchCommunityRoomsWithCounts().catch(() => {});
  }).catch((e) => console.error('[Mitrulu Server] MongoDB loop error:', e));
}

startServer();

export { app, server };
