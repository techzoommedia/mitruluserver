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
exports.InstitutionModel = exports.InstitutionSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.InstitutionSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    teluguName: { type: String, required: true },
    type: {
        type: String,
        enum: ['orphanage', 'oldage_home', 'differently_abled', 'animal_shelter', 'rural_school', 'medical_care'],
        required: true,
    },
    slug: { type: String, required: true, unique: true, index: true },
    about: { type: String, required: true },
    teluguAbout: { type: String, required: true },
    foundedYear: { type: Number, required: true },
    officialWebsite: { type: String },
    officialEmail: { type: String },
    officialPhone: { type: String },
    contactPerson: { type: String, required: true },
    contactPhone: { type: String, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        district: { type: String, required: true },
        state: { type: String, default: 'Andhra Pradesh' },
        pincode: { type: String, required: true },
        googleMapsUrl: { type: String },
    },
    residentsCount: { type: Number, required: true },
    capacity: { type: Number, required: true },
    monthlyOperatingCost: { type: Number, required: true },
    currentMonthRaised: { type: Number, default: 0 },
    fcraCertified: { type: Boolean, default: false },
    panNumber: { type: String },
    eightyGRegistration: { type: String },
    twelveARegistration: { type: String },
    bankAccount: {
        accountName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true },
        bankName: { type: String, required: true },
        branchName: { type: String, required: true },
    },
    upiId: { type: String },
    coverImage: { type: String, required: true },
    galleryImages: [{ type: String }],
    isVerifiedByMitrulu: { type: Boolean, default: true },
    verifiedAt: { type: Date, default: Date.now },
    monthlyAuditStatus: {
        type: String,
        enum: ['clean', 'pending_bills', 'audited_ok'],
        default: 'audited_ok',
    },
}, { collection: 'institutions', timestamps: true });
exports.InstitutionModel = mongoose_1.default.models.Institution ||
    mongoose_1.default.model('Institution', exports.InstitutionSchema);
exports.default = exports.InstitutionModel;
