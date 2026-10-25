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
exports.CallSessionModel = exports.CallSessionSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.CallSessionSchema = new mongoose_1.Schema({
    callId: { type: String, required: true, unique: true, index: true },
    roomName: { type: String, required: true, index: true },
    callerId: { type: String, required: true, index: true },
    callerName: { type: String, required: true },
    callerTeluguName: { type: String },
    callerHandle: { type: String, required: true },
    callerAvatar: { type: String, default: '' },
    targetUserId: { type: String, required: true, index: true },
    targetUserName: { type: String },
    targetUserTeluguName: { type: String },
    targetUserAvatar: { type: String },
    callType: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: {
        type: String,
        enum: ['ringing', 'accepted', 'declined', 'ended', 'timeout'],
        default: 'ringing',
        index: true,
    },
    durationSeconds: { type: Number, default: 0 },
    endedAt: { type: Date },
}, { collection: 'callsessions', timestamps: true });
exports.CallSessionModel = mongoose_1.default.models.CallSession ||
    mongoose_1.default.model('CallSession', exports.CallSessionSchema);
