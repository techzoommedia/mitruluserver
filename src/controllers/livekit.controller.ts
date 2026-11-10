import { Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from '../config/env';

export class LivekitController {
  async getToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { roomName, participantName, participantId } = req.body;

      if (!roomName) {
        res.status(400).json({ error: 'Room name is required' });
        return;
      }

      const identity = participantId || req.userId || `user_${Math.random().toString(36).slice(2, 9)}`;
      const name = participantName || req.user?.name || 'Mitrulu Member';

      const apiKey = process.env.LIVEKIT_API_KEY || LIVEKIT_API_KEY || 'devkey';
      const apiSecret = process.env.LIVEKIT_API_SECRET || LIVEKIT_API_SECRET || 'secret';
      const livekitUrl =
        process.env.LIVEKIT_URL ||
        process.env.NEXT_PUBLIC_LIVEKIT_URL ||
        LIVEKIT_URL ||
        'wss://mitrulu-5c5htvzx.livekit.cloud';

      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        name,
        ttl: '4h',
      });

      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      res.json({
        success: true,
        token,
        serverUrl: livekitUrl,
        roomName,
        identity,
        participantName: name,
      });
    } catch (error: any) {
      console.error('LiveKit token generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate LiveKit token' });
    }
  }
}

export const livekitController = new LivekitController();
