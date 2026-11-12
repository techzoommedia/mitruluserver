"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupMessageRepository = exports.GroupMessageRepository = void 0;
const group_message_model_1 = require("../models/group-message.model");
class GroupMessageRepository {
    async createMessage(data) {
        const doc = new group_message_model_1.GroupMessageModel(data);
        return await doc.save();
    }
    async findMessagesByGroup(groupId, limit = 50, beforeTimestamp, excludeForIds) {
        const query = { groupId };
        if (beforeTimestamp) {
            query.timestamp = { $lt: beforeTimestamp };
        }
        if (Array.isArray(excludeForIds) && excludeForIds.length > 0) {
            query.deletedFor = { $nin: excludeForIds };
        }
        const messages = await group_message_model_1.GroupMessageModel.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
        return messages.reverse();
    }
    async findMessageById(messageId) {
        return group_message_model_1.GroupMessageModel.findOne({ id: messageId }).lean().exec();
    }
    async updateMessageText(messageId, text, editedAt) {
        return group_message_model_1.GroupMessageModel.findOneAndUpdate({ id: messageId }, { $set: { text, isEdited: true, editedAt } }, { new: true })
            .lean()
            .exec();
    }
    async deleteMessageById(messageId) {
        const res = await group_message_model_1.GroupMessageModel.deleteOne({ id: messageId }).exec();
        return res.deletedCount || 0;
    }
    async markDeletedForUser(messageId, userIds) {
        const res = await group_message_model_1.GroupMessageModel.updateOne({ id: messageId }, { $addToSet: { deletedFor: { $each: userIds } } }).exec();
        return res.modifiedCount || 0;
    }
    async getLatestMessage(groupId) {
        const msg = await group_message_model_1.GroupMessageModel.findOne({ groupId })
            .sort({ timestamp: -1 })
            .lean();
        return msg;
    }
    async countMessages(groupId) {
        return await group_message_model_1.GroupMessageModel.countDocuments({ groupId });
    }
}
exports.GroupMessageRepository = GroupMessageRepository;
exports.groupMessageRepository = new GroupMessageRepository();
