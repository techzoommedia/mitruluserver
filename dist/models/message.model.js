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
exports.DirectMessageModel = exports.DirectMessageSchema = void 0;
exports.buildConversationKey = buildConversationKey;
const mongoose_1 = __importStar(require("mongoose"));
exports.DirectMessageSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true, trim: true },
    senderAvatar: { type: String, default: '' },
    senderHandle: { type: String, default: '' },
    senderTeluguName: { type: String, default: '' },
    targetUserId: { type: String, required: true, index: true },
    targetUserName: { type: String, required: true, trim: true },
    targetUserAvatar: { type: String, default: '' },
    targetUserHandle: { type: String, default: '' },
    targetUserTeluguName: { type: String, default: '' },
    text: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'file'] },
    audioDuration: { type: Number },
    timestamp: { type: Number, required: true, index: true },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent', index: true },
    conversationKey: { type: String, required: true, index: true },
    deletedFor: { type: [String], default: [], index: true },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Number },
}, {
    collection: 'directmessages',
    timestamps: true,
});
// High-performance compound indexes for zero-latency queries & realtime sync
exports.DirectMessageSchema.index({ conversationKey: 1, timestamp: -1 });
exports.DirectMessageSchema.index({ targetUserId: 1, status: 1 });
exports.DirectMessageSchema.index({ senderId: 1, timestamp: -1 });
exports.DirectMessageSchema.index({ targetUserId: 1, timestamp: -1 });
exports.DirectMessageSchema.index({ senderId: 1, targetUserId: 1, timestamp: -1 });
function buildConversationKey(userA, userB) {
    const a = String(userA || '').trim().toLowerCase();
    const b = String(userB || '').trim().toLowerCase();
    return [a, b].sort().join(':');
}
exports.DirectMessageModel = mongoose_1.default.models.DirectMessage ||
    mongoose_1.default.model('DirectMessage', exports.DirectMessageSchema);
