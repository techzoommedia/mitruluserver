import { CallSessionModel, ICallSession } from '../models/call-session.model';

export interface ICallSessionRepository {
  create(data: Partial<ICallSession>): Promise<ICallSession>;
  findByCallId(callId: string): Promise<ICallSession | null>;
  findByCallOrRoom(callId?: string, roomName?: string): Promise<ICallSession | null>;
  updateStatus(callId: string, status: string, extra?: any): Promise<ICallSession | null>;
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

  async updateStatus(callId: string, status: string, extra: any = {}): Promise<ICallSession | null> {
    return CallSessionModel.findOneAndUpdate(
      { callId },
      { status, ...extra },
      { new: true }
    );
  }
}

export const callSessionRepository = new CallSessionRepository();
