import { DirectMessageModel, IDirectMessage, MessageStatus } from '../models/message.model';

export class MessageRepository {
  async upsertMessage(data: Partial<IDirectMessage>): Promise<any> {
    const doc = await DirectMessageModel.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean().exec();
    return doc;
  }

  async findMessages(
    query: any,
    limit = 30,
    before?: number,
    excludeForIds?: string[]
  ): Promise<any[]> {
    const filter = { ...query };
    if (before && !isNaN(before)) {
      filter.timestamp = { $lt: before };
    }
    if (Array.isArray(excludeForIds) && excludeForIds.length > 0) {
      filter.deletedFor = { $nin: excludeForIds };
    }

    const docs = await DirectMessageModel.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();
    return docs;
  }

  async findMessageById(messageId: string): Promise<any> {
    return DirectMessageModel.findOne({ id: messageId }).lean().exec();
  }

  async updateMessageText(messageId: string, text: string, editedAt: number): Promise<any> {
    return DirectMessageModel.findOneAndUpdate(
      { id: messageId },
      { $set: { text, isEdited: true, editedAt } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async deleteMessageById(messageId: string): Promise<number> {
    const res = await DirectMessageModel.deleteOne({ id: messageId }).exec();
    return res.deletedCount || 0;
  }

  async markDeletedForUser(messageId: string, userIds: string[]): Promise<number> {
    const res = await DirectMessageModel.updateOne(
      { id: messageId },
      { $addToSet: { deletedFor: { $each: userIds } } }
    ).exec();
    return res.modifiedCount || 0;
  }

  async updateManyStatus(filter: any, status: MessageStatus): Promise<number> {
    const res = await DirectMessageModel.updateMany(filter, { $set: { status } }).exec();
    return res.modifiedCount;
  }

  async aggregateConversations(myIds: string[]): Promise<any[]> {
    const ids = Array.isArray(myIds) ? myIds : [myIds];
    return DirectMessageModel.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ senderId: { $in: ids } }, { targetUserId: { $in: ids } }] },
            { deletedFor: { $nin: ids } },
          ],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $addFields: {
          _partnerId: {
            $cond: [
              { $in: ['$senderId', ids] },
              '$targetUserId',
              '$senderId',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$_partnerId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$targetUserId', ids] },
                    { $ne: ['$status', 'seen'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.timestamp': -1 },
      },
      {
        $limit: 100,
      },
    ]);
  }

  async deleteConversation(
    keys: string[],
    myIds: string[],
    partnerIds: string[],
    scope: 'me' | 'both' = 'both'
  ): Promise<number> {
    const filter = {
      $or: [
        { conversationKey: { $in: keys } },
        {
          $and: [
            { senderId: { $in: myIds } },
            { targetUserId: { $in: partnerIds } },
          ],
        },
        {
          $and: [
            { senderId: { $in: partnerIds } },
            { targetUserId: { $in: myIds } },
          ],
        },
      ],
    };

    if (scope === 'me') {
      const res = await DirectMessageModel.updateMany(filter, {
        $addToSet: { deletedFor: { $each: myIds } },
      }).exec();
      return res.modifiedCount || 0;
    }

    const res = await DirectMessageModel.deleteMany(filter).exec();
    return res.deletedCount || 0;
  }
}

export const messageRepository = new MessageRepository();
