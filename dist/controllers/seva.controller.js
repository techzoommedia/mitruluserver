"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sevaController = exports.SevaController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const institution_model_1 = __importDefault(require("../models/institution.model"));
const donation_model_1 = __importDefault(require("../models/donation.model"));
class SevaController {
    async getInstitutions(req, res) {
        try {
            const type = req.query.type;
            const filter = {};
            if (type && type !== 'all') {
                filter.type = type;
            }
            const institutions = await institution_model_1.default.find(filter).sort({ residentsCount: -1 }).lean();
            res.json({ success: true, institutions });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to fetch institutions' });
        }
    }
    async getInstitutionBySlug(req, res) {
        try {
            const { slug } = req.params;
            const institution = await institution_model_1.default.findOne({ slug }).lean();
            if (!institution) {
                res.status(404).json({ error: 'Institution not found' });
                return;
            }
            res.json({ success: true, institution });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async createDonationOrder(req, res) {
        try {
            const { institutionId, amount, donorName, donorEmail, donorPhone, purpose = 'general', isAnonymous = false } = req.body;
            const grossAmount = Number(amount);
            if (!grossAmount || grossAmount <= 0) {
                res.status(400).json({ error: 'Valid amount is required' });
                return;
            }
            const trackingId = `SEVA-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const donation = await donation_model_1.default.create({
                trackingId,
                donorId: req.userId && mongoose_1.default.Types.ObjectId.isValid(req.userId) ? new mongoose_1.default.Types.ObjectId(req.userId) : undefined,
                donorName: donorName || 'Anonymous Donor',
                donorEmail: donorEmail || '',
                donorPhone: donorPhone || '',
                institutionId: new mongoose_1.default.Types.ObjectId(institutionId),
                purpose,
                isAnonymous: Boolean(isAnonymous),
                grossAmount,
                paymentGatewayFee: 0,
                cloudPlatformFee: 0,
                platformTipAmount: 0,
                netSettlementAmount: grossAmount,
                paymentStatus: 'pending',
            });
            res.json({
                success: true,
                trackingId,
                amount: grossAmount,
                donationId: donation._id.toString(),
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create donation order' });
        }
    }
    async verifyDonation(req, res) {
        try {
            const { trackingId, razorpayPaymentId, razorpayOrderId } = req.body;
            const donation = await donation_model_1.default.findOne({ trackingId });
            if (!donation) {
                res.status(404).json({ error: 'Donation record not found' });
                return;
            }
            donation.paymentStatus = 'captured';
            donation.razorpayPaymentId = razorpayPaymentId;
            donation.razorpayOrderId = razorpayOrderId;
            await donation.save();
            // Update current month raised for institution
            await institution_model_1.default.findByIdAndUpdate(donation.institutionId, {
                $inc: { currentMonthRaised: donation.netSettlementAmount },
            });
            res.json({ success: true, trackingId, donation });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async trackDonation(req, res) {
        try {
            const { trackingId } = req.params;
            const donation = await donation_model_1.default.findOne({ trackingId })
                .populate('institutionId', 'name teluguName coverImage address')
                .lean();
            if (!donation) {
                res.status(404).json({ error: 'Donation not found' });
                return;
            }
            res.json({ success: true, donation });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.SevaController = SevaController;
exports.sevaController = new SevaController();
exports.default = exports.sevaController;
