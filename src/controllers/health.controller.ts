import { Request, Response } from 'express';
import { socketManager } from '../sockets/socket.manager';

export class HealthController {
  getHealth(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      activeSockets: socketManager.getActiveSocketsCount(),
      onlineUsersCount: socketManager.getOnlineUsersCount(),
    });
  }
}

export const healthController = new HealthController();
