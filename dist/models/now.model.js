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
exports.NowNewsModel = exports.NowNewsSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const NowNewsCommentSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true },
    userTeluguName: { type: String, trim: true },
    userHandle: { type: String, trim: true },
    userAvatar: { type: String, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
exports.NowNewsSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    teluguTitle: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    teluguContent: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    author: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true, default: 'General' },
    source: { type: String, default: 'Mitrulu Editorial' },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
    likes: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    comments: [NowNewsCommentSchema],
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
}, { collection: 'now_news', timestamps: true });
exports.NowNewsModel = mongoose_1.default.models.NowNews ||
    mongoose_1.default.model('NowNews', exports.NowNewsSchema);
exports.default = exports.NowNewsModel;
