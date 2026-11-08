import { GroupMessageModel, IGroupMessage } from '../models/group-message.model';

export class GroupMessageRepository {
  async createMessage(data: Partial<IGroupMessage>): Promise<IGroupMessage> {
    const doc = new GroupMessageModel(data);
    return await doc.save();
  }

  async findMessagesByGroup(
    groupId: string,
    limit = 50,
    beforeTimestamp?: number
  ): Promise<IGroupMessage[]> {
    const query: any = { groupId };
    if (beforeTimestamp) {
      query.timestamp = { $lt: beforeTimestamp };
    }

    const messages = await GroupMessageModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return (messages as unknown as IGroupMessage[]).reverse();
  }

  async getLatestMessage(groupId: string): Promise<IGroupMessage | null> {
    const msg = await GroupMessageModel.findOne({ groupId })
      .sort({ timestamp: -1 })
      .lean();
    return msg as unknown as IGroupMessage | null;
  }

  async countMessages(groupId: string): Promise<number> {
    return await GroupMessageModel.countDocuments({ groupId });
  }
}

export const groupMessageRepository = new GroupMessageRepository();

