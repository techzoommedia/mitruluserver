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
    async updateStatus(callId, status, extra = {}) {
        return call_session_model_1.CallSessionModel.findOneAndUpdate({ callId }, { status, ...extra }, { new: true });
    }
}
exports.CallSessionRepository = CallSessionRepository;
exports.callSessionRepository = new CallSessionRepository();
