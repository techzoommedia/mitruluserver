"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const socket_manager_1 = require("./sockets/socket.manager");
const user_service_1 = require("./services/user.service");
const community_room_service_1 = require("./services/community-room.service");
const app = (0, app_1.createApp)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// Initialize Socket.IO with all signaling & authentication handlers
socket_manager_1.socketManager.initialize(server);
// Periodic background sync for community rooms (every 3s broadcast to all sockets)
const roomsBroadcastInterval = setInterval(async () => {
    if (socket_manager_1.socketManager.getActiveSocketsCount() > 0) {
        await socket_manager_1.socketManager.broadcastCommunityRooms();
    }
}, 3000);
let isShuttingDown = false;
let listenRetries = 0;
const MAX_LISTEN_RETRIES = 10;
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !isShuttingDown && listenRetries < MAX_LISTEN_RETRIES) {
        listenRetries += 1;
        const waitMs = Math.min(500 * listenRetries, 3000);
        console.warn(`[Mitrulu Server] Port ${env_1.PORT} is still releasing (EADDRINUSE). Retrying in ${waitMs}ms (${listenRetries}/${MAX_LISTEN_RETRIES})...`);
        setTimeout(() => {
            if (!isShuttingDown) {
                server.close();
                server.listen(env_1.PORT);
            }
        }, waitMs);
    }
    else {
        console.error('[Mitrulu Server] HTTP server error:', err);
        if (err.code === 'EADDRINUSE') {
            process.exit(1);
        }
    }
});
async function startServer() {
    server.listen(env_1.PORT, () => {
        listenRetries = 0;
        console.log(`[Mitrulu Server] Real-Time Circle Server running on port ${env_1.PORT}`);
        console.log(`[Mitrulu Server] WebSocket URL: ws://localhost:${env_1.PORT}`);
    });
    // Connect MongoDB with resilience & retry logic
    (0, database_1.connectMongoDBWithRetry)(async () => {
        // Pre-warm in-memory cache so connected clients get 0ms instantaneous data
        await user_service_1.userService.syncActiveUsersFromDB();
        community_room_service_1.communityRoomService.fetchCommunityRoomsWithCounts().catch(() => { });
    }).catch((e) => console.error('[Mitrulu Server] MongoDB loop error:', e));
}
async function shutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log(`[Mitrulu Server] Received ${signal}. Shutting down gracefully...`);
    clearInterval(roomsBroadcastInterval);
    try {
        const io = socket_manager_1.socketManager.getIO();
        io.close();
    }
    catch {
        // Socket.IO may not be initialized
    }
    server.close(async () => {
        try {
            await mongoose_1.default.disconnect();
        }
        catch {
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
