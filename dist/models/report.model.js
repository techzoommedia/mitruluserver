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
exports.ReportModel = exports.ReportSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.ReportSchema = new mongoose_1.Schema({
    reportNumber: { type: String, required: true, unique: true },
    targetType: {
        type: String,
        enum: ['post', 'comment', 'profile', 'message', 'call', 'story'],
        required: true,
    },
    targetId: { type: String, required: true },
    reporterId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    reporterDetails: {
        name: { type: String, default: '' },
        handle: { type: String, default: '' },
        mitraId: { type: String, default: '' },
        email: { type: String, default: '' },
    },
    reportedUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    reportedUserDetails: {
        name: { type: String, default: '' },
        handle: { type: String, default: '' },
        mitraId: { type: String, default: '' },
        avatar: { type: String, default: '' },
    },
    severity: {
        type: String,
        enum: ['red', 'orange', 'yellow', 'blue', 'grey'],
        default: 'yellow',
    },
    category: { type: String, required: true },
    reason: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'hidden_pending_review', 'escalated', 'resolved', 'dismissed', 'appealed'],
        default: 'pending',
    },
}, { collection: 'reports', timestamps: true });
exports.ReportModel = mongoose_1.default.models.Report || mongoose_1.default.model('Report', exports.ReportSchema);
exports.default = exports.ReportModel;
