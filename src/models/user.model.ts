import mongoose, { Schema, Document } from 'mongoose';

export interface ICoinTransaction {
  _id?: any;
  type: 'credit' | 'debit';
  action: 'deposit' | 'admin_adjust' | 'unlock_post' | 'creator_earning' | 'call' | 'payout' | 'bonus' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  teluguDescription?: string;
  orderId?: string;
  paymentId?: string;
  adminNote?: string;
  createdAt: Date;
}

export interface IFcmToken {
  token: string;
  platform: 'web' | 'android' | 'ios';
  deviceName?: string;
  updatedAt: Date;
}

export interface IUser extends Document {
  email?: string;
  name: string;
  teluguName: string;
  handle: string;
  mitraId?: string;
  avatar: string;
  bio?: string;
  teluguBio?: string;
  location: string;
  isVerified?: boolean;
  interests?: string[];
  friends?: mongoose.Types.ObjectId[];
  followers?: mongoose.Types.ObjectId[];
  following?: mongoose.Types.ObjectId[];
  friendRequestsSent?: mongoose.Types.ObjectId[];
  friendRequestsReceived?: mongoose.Types.ObjectId[];
  blockedUsers?: mongoose.Types.ObjectId[];
  gender?: string;
  profession?: string;
  callCategory?: string;
  isCallActive?: boolean;
  callActiveAt?: Date | null;
  callLanguage?: string;
  callRating?: number;
  callRatingCount?: number;
  callRateCoins?: number;
  coins?: number;
  earnedCoins?: number;
  coinsWithdrawn?: number;
  payoutRequests?: Array<{
    _id?: any;
    amountCoins: number;
    amountRupees: number;
    upiId: string;
    status: 'pending' | 'completed' | 'rejected';
    requestedAt: Date;
  }>;
  coinHistory?: ICoinTransaction[];
  role?: 'admin' | 'author' | 'user';
  isAdmin?: boolean;
  isShielded?: boolean;
  seenPostIds?: string[];
  scheduledDeletionAt?: Date | null;
  moderationStatus?: 'normal' | 'warned' | 'restricted_24h' | 'suspended_7d' | 'suspended_30d' | 'banned';
  suspendedUntil?: Date | null;
  moderationStrikes?: number;
  moderationNotes?: string[];
  fcmTokens?: IFcmToken[];
  lastSeen?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, required: true },
    teluguName: { type: String, required: true },
    handle: { type: String, required: true },
    mitraId: { type: String, sparse: true, index: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    teluguBio: { type: String, default: '' },
    location: { type: String, default: 'హైదరాబాద్' },
    isVerified: { type: Boolean, default: false },
    interests: { type: [String], default: [] },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    friendRequestsSent: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    friendRequestsReceived: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
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
    coinsWithdrawn: { type: Number, default: 0 },
    payoutRequests: [
      {
        amountCoins: { type: Number, required: true },
        amountRupees: { type: Number, required: true },
        upiId: { type: String, required: true },
        status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    coinHistory: [
      {
        type: { type: String, enum: ['credit', 'debit'] },
        action: { type: String },
        amount: { type: Number },
        balanceAfter: { type: Number },
        description: { type: String },
        teluguDescription: { type: String },
        orderId: { type: String },
        paymentId: { type: String },
        adminNote: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    role: { type: String, enum: ['admin', 'author', 'user'], default: 'user' },
    isAdmin: { type: Boolean, default: false },
    isShielded: { type: Boolean, default: false },
    seenPostIds: [{ type: String }],
    scheduledDeletionAt: { type: Date, default: null },
    moderationStatus: {
      type: String,
      enum: ['normal', 'warned', 'restricted_24h', 'suspended_7d', 'suspended_30d', 'banned'],
      default: 'normal',
    },
    suspendedUntil: { type: Date, default: null },
    moderationStrikes: { type: Number, default: 0 },
    moderationNotes: [{ type: String }],
    fcmTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
        deviceName: { type: String },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    lastSeen: { type: Date, default: Date.now, index: true },
  },
  { collection: 'users', timestamps: true }
);

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
