"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRepository = exports.MessageRepository = void 0;
const message_model_1 = require("../models/message.model");
class MessageRepository {
    async upsertMessage(data) {
        const doc = await message_model_1.DirectMessageModel.findOneAndUpdate({ id: data.id }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean().exec();
        return doc;
    }
    async findMessages(query, limit = 30, before) {
        const filter = { ...query };
        if (before && !isNaN(before)) {
            filter.timestamp = { $lt: before };
        }
        const docs = await message_model_1.DirectMessageModel.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean()
            .exec();
        return docs;
    }
    async updateManyStatus(filter, status) {
        const res = await message_model_1.DirectMessageModel.updateMany(filter, { $set: { status } }).exec();
        return res.modifiedCount;
    }
    async aggregateConversations(myId) {
        return message_model_1.DirectMessageModel.aggregate([
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
    async deleteConversation(keys, userA, userB) {
        const res = await message_model_1.DirectMessageModel.deleteMany({
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
exports.MessageRepository = MessageRepository;
exports.messageRepository = new MessageRepository();
