"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRepository = exports.MessageRepository = void 0;
const message_model_1 = require("../models/message.model");
class MessageRepository {
    async upsertMessage(data) {
        const doc = await message_model_1.DirectMessageModel.findOneAndUpdate({ id: data.id }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean().exec();
        return doc;
    }
    async findMessages(query, limit = 30, before, excludeForIds) {
        const filter = { ...query };
        if (before && !isNaN(before)) {
            filter.timestamp = { $lt: before };
        }
        if (Array.isArray(excludeForIds) && excludeForIds.length > 0) {
            filter.deletedFor = { $nin: excludeForIds };
        }
        const docs = await message_model_1.DirectMessageModel.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean()
            .exec();
        return docs;
    }
    async findMessageById(messageId) {
        return message_model_1.DirectMessageModel.findOne({ id: messageId }).lean().exec();
    }
    async updateMessageText(messageId, text, editedAt) {
        return message_model_1.DirectMessageModel.findOneAndUpdate({ id: messageId }, { $set: { text, isEdited: true, editedAt } }, { new: true })
            .lean()
            .exec();
    }
    async deleteMessageById(messageId) {
        const res = await message_model_1.DirectMessageModel.deleteOne({ id: messageId }).exec();
        return res.deletedCount || 0;
    }
    async markDeletedForUser(messageId, userIds) {
        const res = await message_model_1.DirectMessageModel.updateOne({ id: messageId }, { $addToSet: { deletedFor: { $each: userIds } } }).exec();
        return res.modifiedCount || 0;
    }
    async updateManyStatus(filter, status) {
        const res = await message_model_1.DirectMessageModel.updateMany(filter, { $set: { status } }).exec();
        return res.modifiedCount;
    }
    async aggregateConversations(myIds) {
        const ids = Array.isArray(myIds) ? myIds : [myIds];
        return message_model_1.DirectMessageModel.aggregate([
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
    async deleteConversation(keys, myIds, partnerIds, scope = 'both') {
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
            const res = await message_model_1.DirectMessageModel.updateMany(filter, {
                $addToSet: { deletedFor: { $each: myIds } },
            }).exec();
            return res.modifiedCount || 0;
        }
        const res = await message_model_1.DirectMessageModel.deleteMany(filter).exec();
        return res.deletedCount || 0;
    }
}
exports.MessageRepository = MessageRepository;
exports.messageRepository = new MessageRepository();
