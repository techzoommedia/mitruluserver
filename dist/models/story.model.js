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
exports.StoryModel = exports.StorySchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.StorySchema = new mongoose_1.Schema({
    author: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    mediaUrl: { type: String, default: '' },
    type: {
        type: String,
        enum: ['image', 'video', 'text'],
        required: true,
        default: 'image',
    },
    caption: { type: String, default: '' },
    textContent: { type: String, default: '' },
    backgroundGradient: { type: String, default: '' },
    aspectRatio: {
        type: String,
        enum: ['9:16', '3:4', '1:1'],
        default: '9:16',
    },
    fitMode: {
        type: String,
        enum: ['cover', 'contain'],
        default: 'cover',
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
}, { collection: 'stories', timestamps: true });
exports.StoryModel = mongoose_1.default.models.Story || mongoose_1.default.model('Story', exports.StorySchema);
exports.default = exports.StoryModel;
