"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callSessionRepository = exports.CallSessionRepository = void 0;
const call_session_model_1 = require("../models/call-session.model");
class CallSessionRepository {
    async create(data) {
        return call_session_model_1.CallSessionModel.create(data);
    }
    async findByCallId(callId) {
        return call_session_model_1.CallSessionModel.findOne({ callId });
    }
    async findByCallOrRoom(callId, roomName) {
        const filters = [];
        if (callId)
            filters.push({ callId });
        if (roomName)
            filters.push({ roomName });
        if (filters.length === 0)
            return null;
        return call_session_model_1.CallSessionModel.findOne({ $or: filters });
    }
    async findActiveIncomingCall(targetUserId) {
        const threeMinutesAgo = new Date(Date.now() - 180_000);
        return call_session_model_1.CallSessionModel.findOne({
            targetUserId: { $in: [targetUserId, String(targetUserId)] },
            status: 'ringing',
            createdAt: { $gte: threeMinutesAgo },
        }).sort({ createdAt: -1 });
    }
    async findLatestRingingSession(callerId, targetUserId) {
        const query = {
            callerId: { $in: [callerId, String(callerId)] },
            status: 'ringing',
        };
        if (targetUserId) {
            query.targetUserId = { $in: [targetUserId, String(targetUserId)] };
        }
        return call_session_model_1.CallSessionModel.findOne(query).sort({ createdAt: -1 });
    }
    async updateStatus(callId, status, extra = {}) {
        return call_session_model_1.CallSessionModel.findOneAndUpdate({ callId }, { status, ...extra }, { new: true });
    }
    async findRecentCalls(userId, targetUserId, limit = 10) {
        const cappedLimit = Math.min(10, Math.max(1, limit || 10));
        const userIds = [userId, String(userId)];
        let query;
        if (targetUserId) {
            const targetIds = [targetUserId, String(targetUserId)];
            query = {
                $or: [
                    { callerId: { $in: userIds }, targetUserId: { $in: targetIds } },
                    { callerId: { $in: targetIds }, targetUserId: { $in: userIds } },
                ],
            };
        }
        else {
            query = {
                $or: [
                    { callerId: { $in: userIds } },
                    { targetUserId: { $in: userIds } },
                ],
            };
        }
        return call_session_model_1.CallSessionModel.find(query)
            .sort({ createdAt: -1 })
            .limit(cappedLimit)
            .lean();
    }
}
exports.CallSessionRepository = CallSessionRepository;
exports.callSessionRepository = new CallSessionRepository();
