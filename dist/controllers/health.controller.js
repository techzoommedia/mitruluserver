"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = exports.HealthController = void 0;
const socket_manager_1 = require("../sockets/socket.manager");
class HealthController {
    getHealth(_req, res) {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            activeSockets: socket_manager_1.socketManager.getActiveSocketsCount(),
            onlineUsersCount: socket_manager_1.socketManager.getOnlineUsersCount(),
        });
    }
}
exports.HealthController = HealthController;
exports.healthController = new HealthController();
