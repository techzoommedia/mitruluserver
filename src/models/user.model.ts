import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  teluguName: string;
  handle: string;
  mitraId?: string;
  avatar: string;
  bio?: string;
  teluguBio?: string;
  location: string;
  isVerified?: boolean;
  gender?: string;
  profession?: string;
  callCategory?: string;
  isCallActive?: boolean;
  callActiveAt?: Date;
  callLanguage?: string;
  callRating?: number;
  callRatingCount?: number;
  callRateCoins?: number;
  coins?: number;
  earnedCoins?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    teluguName: { type: String, required: true },
    handle: { type: String, required: true },
    mitraId: { type: String },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    teluguBio: { type: String, default: '' },
    location: { type: String, default: 'హైదరాబాద్' },
    isVerified: { type: Boolean, default: false },
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
  },
  { collection: 'users', timestamps: true }
);

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
