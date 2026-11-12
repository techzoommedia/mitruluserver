import { GroupMessageModel, IGroupMessage } from '../models/group-message.model';

export class GroupMessageRepository {
  async createMessage(data: Partial<IGroupMessage>): Promise<IGroupMessage> {
    const doc = new GroupMessageModel(data);
    return await doc.save();
  }

  async findMessagesByGroup(
    groupId: string,
    limit = 50,
    beforeTimestamp?: number,
    excludeForIds?: string[]
  ): Promise<IGroupMessage[]> {
    const query: any = { groupId };
    if (beforeTimestamp) {
      query.timestamp = { $lt: beforeTimestamp };
    }
    if (Array.isArray(excludeForIds) && excludeForIds.length > 0) {
      query.deletedFor = { $nin: excludeForIds };
    }

    const messages = await GroupMessageModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return (messages as unknown as IGroupMessage[]).reverse();
  }

  async findMessageById(messageId: string): Promise<any> {
    return GroupMessageModel.findOne({ id: messageId }).lean().exec();
  }

  async updateMessageText(messageId: string, text: string, editedAt: number): Promise<any> {
    return GroupMessageModel.findOneAndUpdate(
      { id: messageId },
      { $set: { text, isEdited: true, editedAt } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async deleteMessageById(messageId: string): Promise<number> {
    const res = await GroupMessageModel.deleteOne({ id: messageId }).exec();
    return res.deletedCount || 0;
  }

  async markDeletedForUser(messageId: string, userIds: string[]): Promise<number> {
    const res = await GroupMessageModel.updateOne(
      { id: messageId },
      { $addToSet: { deletedFor: { $each: userIds } } }
    ).exec();
    return res.modifiedCount || 0;
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

