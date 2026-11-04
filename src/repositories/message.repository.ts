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

  async findMessages(query: any, limit = 30, before?: number): Promise<any[]> {
    const filter = { ...query };
    if (before && !isNaN(before)) {
      filter.timestamp = { $lt: before };
    }

    const docs = await DirectMessageModel.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();
    return docs;
  }

  async updateManyStatus(filter: any, status: MessageStatus): Promise<number> {
    const res = await DirectMessageModel.updateMany(filter, { $set: { status } }).exec();
    return res.modifiedCount;
  }

  async aggregateConversations(myId: string): Promise<any[]> {
    return DirectMessageModel.aggregate([
      {
        $match: {
          $or: [{ senderId: myId }, { targetUserId: myId }],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $addFields: {
          _convKey: {
            $cond: {
              if: { $and: [{ $ifNull: ['$conversationKey', false] }, { $ne: ['$conversationKey', ''] }] },
              then: '$conversationKey',
              else: {
                $let: {
                  vars: {
                    sorted: {
                      $cond: {
                        if: { $lte: ['$senderId', '$targetUserId'] },
                        then: { $concat: ['$senderId', ':', '$targetUserId'] },
                        else: { $concat: ['$targetUserId', ':', '$senderId'] },
                      },
                    },
                  },
                  in: '$$sorted',
                },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_convKey',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$targetUserId', myId] },
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

  async deleteConversation(keys: string[], userA: string, userB: string): Promise<number> {
    const res = await DirectMessageModel.deleteMany({
      $or: [
        { conversationKey: { $in: keys } },
        {
          $and: [
            { senderId: { $in: [userA, userB] } },
            { targetUserId: { $in: [userA, userB] } },
          ],
        },
      ],
    }).exec();
    return res.deletedCount || 0;
  }
}

export const messageRepository = new MessageRepository();
