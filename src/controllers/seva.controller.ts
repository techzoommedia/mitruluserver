import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import InstitutionModel from '../models/institution.model';
import DonationModel from '../models/donation.model';

export class SevaController {
  async getInstitutions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const type = req.query.type as string;
      const filter: any = {};
      if (type && type !== 'all') {
        filter.type = type;
      }

      const institutions = await InstitutionModel.find(filter).sort({ residentsCount: -1 }).lean();
      res.json({ success: true, institutions });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch institutions' });
    }
  }

  async getInstitutionBySlug(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const institution = await InstitutionModel.findOne({ slug }).lean();
      if (!institution) {
        res.status(404).json({ error: 'Institution not found' });
        return;
      }
      res.json({ success: true, institution });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async createDonationOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { institutionId, amount, donorName, donorEmail, donorPhone, purpose = 'general', isAnonymous = false } = req.body;
      const grossAmount = Number(amount);
      if (!grossAmount || grossAmount <= 0) {
        res.status(400).json({ error: 'Valid amount is required' });
        return;
      }

      const trackingId = `SEVA-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const donation = await DonationModel.create({
        trackingId,
        donorId: req.userId && mongoose.Types.ObjectId.isValid(req.userId) ? new mongoose.Types.ObjectId(req.userId) : undefined,
        donorName: donorName || 'Anonymous Donor',
        donorEmail: donorEmail || '',
        donorPhone: donorPhone || '',
        institutionId: new mongoose.Types.ObjectId(institutionId),
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create donation order' });
    }
  }

  async verifyDonation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { trackingId, razorpayPaymentId, razorpayOrderId } = req.body;
      const donation = await DonationModel.findOne({ trackingId });
      if (!donation) {
        res.status(404).json({ error: 'Donation record not found' });
        return;
      }

      donation.paymentStatus = 'captured';
      donation.razorpayPaymentId = razorpayPaymentId;
      donation.razorpayOrderId = razorpayOrderId;
      await donation.save();

      // Update current month raised for institution
      await InstitutionModel.findByIdAndUpdate(donation.institutionId, {
        $inc: { currentMonthRaised: donation.netSettlementAmount },
      });

      res.json({ success: true, trackingId, donation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async trackDonation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;
      const donation: any = await DonationModel.findOne({ trackingId })
        .populate('institutionId', 'name teluguName coverImage address')
        .lean();

      if (!donation) {
        res.status(404).json({ error: 'Donation not found' });
        return;
      }

      res.json({ success: true, donation });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const sevaController = new SevaController();
export default sevaController;

