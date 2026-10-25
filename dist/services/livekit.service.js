"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveKitService = exports.LiveKitService = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("../config/env");
class LiveKitService {
    roomService;
    cachedCounts = new Map();
    lastFetchTime = 0;
    isFetching = false;
    constructor() {
        this.roomService = new livekit_server_sdk_1.RoomServiceClient(env_1.LIVEKIT_HTTP_URL, env_1.LIVEKIT_API_KEY, env_1.LIVEKIT_API_SECRET);
    }
    /**
     * Resilient participant counts query from LiveKit Cloud with ultra-fast 2.5s in-memory caching
     * and in-flight deduplication to keep live counts updated within seconds.
     */
    async getRoomParticipantCounts(force = false) {
        const now = Date.now();
        // Cache counts for 2.5 seconds (was 20s) to keep live numbers quickly updating
        if (!force && now - this.lastFetchTime < 2500 && this.cachedCounts.size > 0) {
            return this.cachedCounts;
        }
        if (this.isFetching) {
            return this.cachedCounts;
        }
        this.isFetching = true;
        try {
            const listPromise = this.roomService.listRooms();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit timeout')), 3500));
            const rooms = await Promise.race([listPromise, timeoutPromise]);
            const newCounts = new Map();
            for (const room of rooms) {
                newCounts.set(room.name, room.numParticipants);
            }
            this.cachedCounts = newCounts;
            this.lastFetchTime = now;
        }
        catch {
            // Return previous cached counts silently without crashing or logging noise
        }
        finally {
            this.isFetching = false;
        }
        return this.cachedCounts;
    }
    /**
     * Generates a 2-hour LiveKit JWT AccessToken for 1-on-1 calls.
     */
    async generateToken(identity, name, roomName) {
        const token = new livekit_server_sdk_1.AccessToken(env_1.LIVEKIT_API_KEY, env_1.LIVEKIT_API_SECRET, {
            identity,
            name,
            ttl: '2h',
        });
        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
        return token.toJwt();
    }
    /**
     * Generates a 4-hour LiveKit JWT AccessToken for community group rooms.
     */
    async generateCommunityToken(identity, name, roomName) {
        const token = new livekit_server_sdk_1.AccessToken(env_1.LIVEKIT_API_KEY, env_1.LIVEKIT_API_SECRET, {
            identity,
            name,
            ttl: '4h',
        });
        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
        return token.toJwt();
    }
}
exports.LiveKitService = LiveKitService;
exports.liveKitService = new LiveKitService();
