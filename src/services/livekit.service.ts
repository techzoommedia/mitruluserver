import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HTTP_URL } from '../config/env';

export class LiveKitService {
  private roomService: RoomServiceClient;
  private cachedCounts = new Map<string, number>();
  private lastFetchTime = 0;
  private isFetching = false;

  constructor() {
    this.roomService = new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }

  /**
   * Resilient participant counts query from LiveKit Cloud with ultra-fast 2.5s in-memory caching
   * and in-flight deduplication to keep live counts updated within seconds.
   */
  async getRoomParticipantCounts(force = false): Promise<Map<string, number>> {
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
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LiveKit timeout')), 3500)
      );
      const rooms = await Promise.race([listPromise, timeoutPromise]);
      const newCounts = new Map<string, number>();
      for (const room of rooms) {
        newCounts.set(room.name, room.numParticipants);
      }
      this.cachedCounts = newCounts;
      this.lastFetchTime = now;
    } catch {
      // Return previous cached counts silently without crashing or logging noise
    } finally {
      this.isFetching = false;
    }

    return this.cachedCounts;
  }

  /**
   * Generates a 2-hour LiveKit JWT AccessToken for 1-on-1 calls.
   */
  async generateToken(identity: string, name: string, roomName: string): Promise<string> {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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
  async generateCommunityToken(identity: string, name: string, roomName: string): Promise<string> {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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

export const liveKitService = new LiveKitService();
