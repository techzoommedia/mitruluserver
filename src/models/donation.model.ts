import mongoose, { Schema, Document } from 'mongoose';

export interface IDonation extends Document {
  trackingId: string;
  donorId?: mongoose.Types.ObjectId;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donorPan?: string;
  isAnonymous: boolean;
  institutionId: mongoose.Types.ObjectId;
  purpose: 'general' | 'sponsor_meal' | 'medicines' | 'education' | 'infrastructure';
  sponsorshipDate?: Date;
  message?: string;
  grossAmount: number;
  paymentGatewayFee: number;
  cloudPlatformFee: number;
  platformTipAmount: number;
  netSettlementAmount: number;
  paymentStatus: 'pending' | 'captured' | 'failed' | 'refunded';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  settlementStatus: 'in_escrow' | 'processing' | 'settled_to_bank';
  settlementUtrNumber?: string;
  settlementDate?: Date;
  isSpendProofSubmitted: boolean;
  receiptPdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DonationSchema = new Schema<IDonation>(
  {
    trackingId: { type: String, required: true, unique: true, index: true },
    donorId: { type: Schema.Types.ObjectId, ref: 'User' },
    donorName: { type: String, required: true },
    donorEmail: { type: String, required: true },
    donorPhone: { type: String, required: true },
    donorPan: { type: String },
    isAnonymous: { type: Boolean, default: false },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
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
  },
  { collection: 'donations', timestamps: true }
);

export const DonationModel: mongoose.Model<IDonation> =
  (mongoose.models.Donation as mongoose.Model<IDonation>) ||
  mongoose.model<IDonation>('Donation', DonationSchema);

export default DonationModel;

