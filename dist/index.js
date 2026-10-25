"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const http_1 = __importDefault(require("http"));
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
setInterval(async () => {
    if (socket_manager_1.socketManager.getActiveSocketsCount() > 0) {
        await socket_manager_1.socketManager.broadcastCommunityRooms();
    }
}, 3000);
async function startServer() {
    server.listen(env_1.PORT, () => {
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
startServer();
