import http from 'http';
import mongoose from 'mongoose';
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
const roomsBroadcastInterval = setInterval(async () => {
  if (socketManager.getActiveSocketsCount() > 0) {
    await socketManager.broadcastCommunityRooms();
  }
}, 3000);

let isShuttingDown = false;
let listenRetries = 0;
const MAX_LISTEN_RETRIES = 10;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE' && !isShuttingDown && listenRetries < MAX_LISTEN_RETRIES) {
    listenRetries += 1;
    const waitMs = Math.min(500 * listenRetries, 3000);
    console.warn(
      `[Mitrulu Server] Port ${PORT} is still releasing (EADDRINUSE). Retrying in ${waitMs}ms (${listenRetries}/${MAX_LISTEN_RETRIES})...`
    );
    setTimeout(() => {
      if (!isShuttingDown) {
        server.close();
        server.listen(PORT);
      }
    }, waitMs);
  } else {
    console.error('[Mitrulu Server] HTTP server error:', err);
    if (err.code === 'EADDRINUSE') {
      process.exit(1);
    }
  }
});

async function startServer() {
  server.listen(PORT, () => {
    listenRetries = 0;
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

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Mitrulu Server] Received ${signal}. Shutting down gracefully...`);
  clearInterval(roomsBroadcastInterval);

  try {
    const io = socketManager.getIO();
    io.close();
  } catch {
    // Socket.IO may not be initialized
  }

  server.close(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  server.closeAllConnections?.();

  // Force exit if sockets hang beyond 1.5s so nodemon can bind immediately
  setTimeout(() => {
    process.exit(0);
  }, 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2'));

startServer();

export { app, server };
