import mongoose, { Schema, Document } from 'mongoose';

export interface ICommentReply {
  user: mongoose.Types.ObjectId;
  userName: string;
  userTeluguName?: string;
  userAvatar: string;
  userMitraId?: string;
  text: string;
  createdAt: Date;
}

export interface IComment {
  _id?: any;
  user: mongoose.Types.ObjectId;
  userName: string;
  userTeluguName?: string;
  userAvatar: string;
  userMitraId?: string;
  text: string;
  replies?: ICommentReply[];
  createdAt: Date;
}

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  type: 'image' | 'video';
  mediaUrl: string;
  mediaUrls?: string[];
  aspectRatio?: '1:1' | '3:4' | '9:16';
  thumbnailUrl?: string;
  caption: string;
  teluguCaption?: string;
  category: string;
  location: string;
  tags: string[];
  likes: mongoose.Types.ObjectId[];
  comments: IComment[];
  sharesCount: number;
  saves: mongoose.Types.ObjectId[];
  viewsCount: number;
  audioTrack?: {
    title: string;
    artist: string;
  };
  isPremium?: boolean;
  coinsRequired?: number;
  previewMediaUrl?: string;
  unlockedBy?: mongoose.Types.ObjectId[];
  totalCoinsEarned?: number;
  isModerationHidden?: boolean;
  moderationStatus?: 'normal' | 'flagged' | 'hidden_pending_review' | 'removed';
  reportsCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommentReplySchema = new Schema<ICommentReply>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userTeluguName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    userMitraId: { type: String, default: '' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CommentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userTeluguName: { type: String, default: '' },
    userAvatar: { type: String, default: '' },
    userMitraId: { type: String, default: '' },
    text: { type: String, required: true },
    replies: [CommentReplySchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

export const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    mediaUrl: { type: String, required: true },
    mediaUrls: { type: [String], default: [] },
    aspectRatio: { type: String, enum: ['1:1', '3:4', '9:16'], default: '1:1' },
    thumbnailUrl: { type: String, default: '' },
    caption: { type: String, required: true },
    teluguCaption: { type: String, default: '' },
    category: { type: String, required: true },
    location: { type: String, default: 'హైదరాబాద్' },
    tags: { type: [String], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [CommentSchema],
    sharesCount: { type: Number, default: 0 },
    saves: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    viewsCount: { type: Number, default: 0 },
    audioTrack: {
      title: { type: String },
      artist: { type: String },
    },
    isPremium: { type: Boolean, default: false },
    coinsRequired: { type: Number, default: 0 },
    previewMediaUrl: { type: String, default: '' },
    unlockedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    totalCoinsEarned: { type: Number, default: 0 },
    isModerationHidden: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ['normal', 'flagged', 'hidden_pending_review', 'removed'],
      default: 'normal',
    },
    reportsCount: { type: Number, default: 0 },
  },
  { collection: 'posts', timestamps: true }
);

export const PostModel: mongoose.Model<IPost> =
  (mongoose.models.Post as mongoose.Model<IPost>) || mongoose.model<IPost>('Post', PostSchema);

export default PostModel;

