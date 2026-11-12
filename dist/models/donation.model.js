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
exports.DonationModel = exports.DonationSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.DonationSchema = new mongoose_1.Schema({
    trackingId: { type: String, required: true, unique: true, index: true },
    donorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    donorName: { type: String, required: true },
    donorEmail: { type: String, required: true },
    donorPhone: { type: String, required: true },
    donorPan: { type: String },
    isAnonymous: { type: Boolean, default: false },
    institutionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Institution', required: true },
    purpose: {
        type: String,
        enum: ['general', 'sponsor_meal', 'medicines', 'education', 'infrastructure'],
        default: 'general',
    },
    sponsorshipDate: { type: Date },
    message: { type: String, default: '' },
    grossAmount: { type: Number, required: true },
    paymentGatewayFee: { type: Number, default: 0 },
    cloudPlatformFee: { type: Number, default: 0 },
    platformTipAmount: { type: Number, default: 0 },
    netSettlementAmount: { type: Number, required: true },
    paymentStatus: {
        type: String,
        enum: ['pending', 'captured', 'failed', 'refunded'],
        default: 'pending',
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    settlementStatus: {
        type: String,
        enum: ['in_escrow', 'processing', 'settled_to_bank'],
        default: 'settled_to_bank',
    },
    settlementUtrNumber: { type: String },
    settlementDate: { type: Date },
    isSpendProofSubmitted: { type: Boolean, default: false },
    receiptPdfUrl: { type: String },
}, { collection: 'donations', timestamps: true });
exports.DonationModel = mongoose_1.default.models.Donation ||
    mongoose_1.default.model('Donation', exports.DonationSchema);
exports.default = exports.DonationModel;
