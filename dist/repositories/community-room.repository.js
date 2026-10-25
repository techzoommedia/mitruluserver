"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.communityRoomRepository = exports.CommunityRoomRepository = void 0;
const community_room_model_1 = require("../models/community-room.model");
class CommunityRoomRepository {
    async findAll() {
        return community_room_model_1.CommunityRoomModel.find().sort({ createdAt: 1 }).lean();
    }
    async findByRoomId(roomId) {
        return community_room_model_1.CommunityRoomModel.findOne({ roomId });
    }
    async create(data) {
        return community_room_model_1.CommunityRoomModel.create(data);
    }
}
exports.CommunityRoomRepository = CommunityRoomRepository;
exports.communityRoomRepository = new CommunityRoomRepository();
