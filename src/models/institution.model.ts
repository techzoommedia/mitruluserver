import mongoose, { Schema, Document } from 'mongoose';

export type InstitutionType =
  | 'orphanage'
  | 'oldage_home'
  | 'differently_abled'
  | 'animal_shelter'
  | 'rural_school'
  | 'medical_care';

export interface IInstitution extends Document {
  name: string;
  teluguName: string;
  type: InstitutionType;
  slug: string;
  about: string;
  teluguAbout: string;
  foundedYear: number;
  officialWebsite?: string;
  officialEmail?: string;
  officialPhone?: string;
  contactPerson: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    googleMapsUrl?: string;
  };
  residentsCount: number;
  capacity: number;
  monthlyOperatingCost: number;
  currentMonthRaised: number;
  fcraCertified?: boolean;
  panNumber?: string;
  eightyGRegistration?: string;
  twelveARegistration?: string;
  bankAccount: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
  };
  upiId?: string;
  coverImage: string;
  galleryImages: string[];
  isVerifiedByMitrulu: boolean;
  verifiedAt?: Date;
  monthlyAuditStatus: 'clean' | 'pending_bills' | 'audited_ok';
  createdAt: Date;
  updatedAt: Date;
}

export const InstitutionSchema = new Schema<IInstitution>(
  {
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
  },
  { collection: 'institutions', timestamps: true }
);

export const InstitutionModel: mongoose.Model<IInstitution> =
  (mongoose.models.Institution as mongoose.Model<IInstitution>) ||
  mongoose.model<IInstitution>('Institution', InstitutionSchema);

export default InstitutionModel;

