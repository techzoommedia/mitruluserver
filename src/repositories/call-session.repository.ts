import { CallSessionModel, ICallSession } from '../models/call-session.model';

export interface ICallSessionRepository {
  create(data: Partial<ICallSession>): Promise<ICallSession>;
  findByCallId(callId: string): Promise<ICallSession | null>;
  findByCallOrRoom(callId?: string, roomName?: string): Promise<ICallSession | null>;
  findActiveIncomingCall(targetUserId: string): Promise<ICallSession | null>;
  findLatestRingingSession(callerId: string, targetUserId?: string): Promise<ICallSession | null>;
  updateStatus(callId: string, status: string, extra?: any): Promise<ICallSession | null>;
  findRecentCalls(userId: string, targetUserId?: string, limit?: number): Promise<any[]>;
}

export class CallSessionRepository implements ICallSessionRepository {
  async create(data: Partial<ICallSession>): Promise<ICallSession> {
    return CallSessionModel.create(data);
  }

  async findByCallId(callId: string): Promise<ICallSession | null> {
    return CallSessionModel.findOne({ callId });
  }

  async findByCallOrRoom(callId?: string, roomName?: string): Promise<ICallSession | null> {
    const filters: any[] = [];
    if (callId) filters.push({ callId });
    if (roomName) filters.push({ roomName });
    if (filters.length === 0) return null;

    return CallSessionModel.findOne({ $or: filters });
  }

  async findActiveIncomingCall(targetUserId: string): Promise<ICallSession | null> {
    const threeMinutesAgo = new Date(Date.now() - 180_000);
    return CallSessionModel.findOne({
      targetUserId: { $in: [targetUserId, String(targetUserId)] },
      status: 'ringing',
      createdAt: { $gte: threeMinutesAgo },
    }).sort({ createdAt: -1 });
  }

  async findLatestRingingSession(callerId: string, targetUserId?: string): Promise<ICallSession | null> {
    const query: any = {
      callerId: { $in: [callerId, String(callerId)] },
      status: 'ringing',
    };
    if (targetUserId) {
      query.targetUserId = { $in: [targetUserId, String(targetUserId)] };
    }
    return CallSessionModel.findOne(query).sort({ createdAt: -1 });
  }

  async updateStatus(callId: string, status: string, extra: any = {}): Promise<ICallSession | null> {
    return CallSessionModel.findOneAndUpdate(
      { callId },
      { status, ...extra },
      { new: true }
    );
  }

  async findRecentCalls(userId: string, targetUserId?: string, limit: number = 10): Promise<any[]> {
    const cappedLimit = Math.min(10, Math.max(1, limit || 10));
    const userIds = [userId, String(userId)];

    let query: any;
    if (targetUserId) {
      const targetIds = [targetUserId, String(targetUserId)];
      query = {
        $or: [
          { callerId: { $in: userIds }, targetUserId: { $in: targetIds } },
          { callerId: { $in: targetIds }, targetUserId: { $in: userIds } },
        ],
      };
    } else {
      query = {
        $or: [
          { callerId: { $in: userIds } },
          { targetUserId: { $in: userIds } },
        ],
      };
    }

    return CallSessionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(cappedLimit)
      .lean();
  }
}

export const callSessionRepository = new CallSessionRepository();
