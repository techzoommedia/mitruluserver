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
exports.PostModel = exports.PostSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CommentReplySchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userTeluguName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    userMitraId: { type: String, default: '' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const CommentSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userTeluguName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    userMitraId: { type: String, default: '' },
    text: { type: String, required: true },
    replies: [CommentReplySchema],
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
exports.PostSchema = new mongoose_1.Schema({
    author: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    mediaUrl: { type: String, required: true },
    mediaUrls: { type: [String], default: [] },
    aspectRatio: { type: String, enum: ['1:1', '3:4', '9:16'], default: '1:1' },
    thumbnailUrl: { type: String, default: '' },
    caption: { type: String, required: true },
    teluguCaption: { type: String, default: '' },
    category: { type: String, required: true },
    location: { type: String, default: 'హైదరాబాద్' },
    tags: { type: [String], default: [] },
    likes: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    comments: [CommentSchema],
    sharesCount: { type: Number, default: 0 },
    saves: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    viewsCount: { type: Number, default: 0 },
    audioTrack: {
        title: { type: String },
        artist: { type: String },
    },
    isPremium: { type: Boolean, default: false },
    coinsRequired: { type: Number, default: 0 },
    previewMediaUrl: { type: String, default: '' },
    unlockedBy: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    totalCoinsEarned: { type: Number, default: 0 },
    isModerationHidden: { type: Boolean, default: false },
    moderationStatus: {
        type: String,
        enum: ['normal', 'flagged', 'hidden_pending_review', 'removed'],
        default: 'normal',
    },
    reportsCount: { type: Number, default: 0 },
}, { collection: 'posts', timestamps: true });
exports.PostModel = mongoose_1.default.models.Post || mongoose_1.default.model('Post', exports.PostSchema);
exports.default = exports.PostModel;
