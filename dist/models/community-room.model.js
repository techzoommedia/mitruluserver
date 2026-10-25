"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityRoomModel = exports.CommunityRoomSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.CommunityRoomSchema = new mongoose_1.Schema({
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    teluguTitle: { type: String, required: true },
    language: { type: String, default: 'Telugu' },
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    topic: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isStopped: { type: Boolean, default: false },
    stoppedReason: { type: String, default: '' },
    admins: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    maxParticipants: { type: Number, default: 50 },
    costCoins: { type: Number, default: 0 },
}, { collection: 'communityrooms', timestamps: true });
exports.CommunityRoomModel = mongoose_1.default.models.CommunityRoom ||
    mongoose_1.default.model('CommunityRoom', exports.CommunityRoomSchema);
