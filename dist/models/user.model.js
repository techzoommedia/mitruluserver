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
exports.UserModel = exports.UserSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.UserSchema = new mongoose_1.Schema({
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, required: true },
    teluguName: { type: String, required: true },
    handle: { type: String, required: true },
    mitraId: { type: String, sparse: true, index: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    teluguBio: { type: String, default: '' },
    location: { type: String, default: 'హైదరాబాద్' },
    isVerified: { type: Boolean, default: false },
    interests: { type: [String], default: [] },
    friends: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    followers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    following: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    friendRequestsSent: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    friendRequestsReceived: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    blockedUsers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: [] }],
    gender: { type: String, default: 'prefer_not_to_say' },
    profession: { type: String, default: '' },
    callCategory: { type: String, default: 'casuals' },
    isCallActive: { type: Boolean, default: false },
    callActiveAt: { type: Date, default: null },
    callLanguage: { type: String, default: 'తెలుగు (Telugu)' },
    callRating: { type: Number, default: 5.0 },
    callRatingCount: { type: Number, default: 0 },
    callRateCoins: { type: Number, default: 500 },
    coins: { type: Number, default: 0 },
    earnedCoins: { type: Number, default: 0 },
    coinsWithdrawn: { type: Number, default: 0 },
    payoutRequests: [
        {
            amountCoins: { type: Number, required: true },
            amountRupees: { type: Number, required: true },
            upiId: { type: String, required: true },
            status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
            requestedAt: { type: Date, default: Date.now },
        },
    ],
    coinHistory: [
        {
            type: { type: String, enum: ['credit', 'debit'] },
            action: { type: String },
            amount: { type: Number },
            balanceAfter: { type: Number },
            description: { type: String },
            teluguDescription: { type: String },
            orderId: { type: String },
            paymentId: { type: String },
            adminNote: { type: String },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    role: { type: String, enum: ['admin', 'author', 'user'], default: 'user' },
    isAdmin: { type: Boolean, default: false },
    isShielded: { type: Boolean, default: false },
    seenPostIds: [{ type: String }],
    scheduledDeletionAt: { type: Date, default: null },
    moderationStatus: {
        type: String,
        enum: ['normal', 'warned', 'restricted_24h', 'suspended_7d', 'suspended_30d', 'banned'],
        default: 'normal',
    },
    suspendedUntil: { type: Date, default: null },
    moderationStrikes: { type: Number, default: 0 },
    moderationNotes: [{ type: String }],
    fcmTokens: [
        {
            token: { type: String, required: true },
            platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
            deviceName: { type: String },
            updatedAt: { type: Date, default: Date.now },
        },
    ],
    lastSeen: { type: Date, default: Date.now, index: true },
}, { collection: 'users', timestamps: true });
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model('User', exports.UserSchema);
exports.default = exports.UserModel;
