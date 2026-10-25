import { CommunityRoomModel, ICommunityRoom } from '../models/community-room.model';

export interface ICommunityRoomRepository {
  findAll(): Promise<any[]>;
  findByRoomId(roomId: string): Promise<ICommunityRoom | null>;
  create(data: Partial<ICommunityRoom>): Promise<ICommunityRoom>;
}

export class CommunityRoomRepository implements ICommunityRoomRepository {
  async findAll(): Promise<any[]> {
    return CommunityRoomModel.find().sort({ createdAt: 1 }).lean();
  }

  async findByRoomId(roomId: string): Promise<ICommunityRoom | null> {
    return CommunityRoomModel.findOne({ roomId });
  }

  async create(data: Partial<ICommunityRoom>): Promise<ICommunityRoom> {
    return CommunityRoomModel.create(data);
  }
}

export const communityRoomRepository = new CommunityRoomRepository();
