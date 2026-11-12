"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livekitController = exports.LivekitController = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("../config/env");
class LivekitController {
    async getToken(req, res) {
        try {
            const { roomName, participantName, participantId } = req.body;
            if (!roomName) {
                res.status(400).json({ error: 'Room name is required' });
                return;
            }
            const identity = participantId || req.userId || `user_${Math.random().toString(36).slice(2, 9)}`;
            const name = participantName || req.user?.name || 'Mitrulu Member';
            const apiKey = process.env.LIVEKIT_API_KEY || env_1.LIVEKIT_API_KEY || 'devkey';
            const apiSecret = process.env.LIVEKIT_API_SECRET || env_1.LIVEKIT_API_SECRET || 'secret';
            const livekitUrl = process.env.LIVEKIT_URL ||
                process.env.NEXT_PUBLIC_LIVEKIT_URL ||
                env_1.LIVEKIT_URL ||
                'wss://mitrulu-5c5htvzx.livekit.cloud';
            const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, {
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
        }
        catch (error) {
            console.error('LiveKit token generation error:', error);
            res.status(500).json({ error: error.message || 'Failed to generate LiveKit token' });
        }
    }
}
exports.LivekitController = LivekitController;
exports.livekitController = new LivekitController();
