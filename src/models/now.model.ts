import mongoose, { Schema, Document } from 'mongoose';

export interface INowNewsComment {
  _id?: any;
  user: mongoose.Types.ObjectId;
  userName?: string;
  userTeluguName?: string;
  userHandle?: string;
  userAvatar?: string;
  text: string;
  createdAt: Date;
}

export interface INowNews extends Document {
  title: string;
  teluguTitle?: string;
  content: string;
  teluguContent?: string;
  imageUrl: string;
  author: mongoose.Types.ObjectId;
  category: string;
  source?: string;
  status: 'approved' | 'pending' | 'rejected';
  likes: mongoose.Types.ObjectId[];
  likesCount: number;
  comments: INowNewsComment[];
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const NowNewsCommentSchema = new Schema<INowNewsComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true },
    userTeluguName: { type: String, trim: true },
    userHandle: { type: String, trim: true },
    userAvatar: { type: String, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

export const NowNewsSchema = new Schema<INowNews>(
  {
    title: { type: String, required: true, trim: true },
    teluguTitle: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    teluguContent: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true, default: 'General' },
    source: { type: String, default: 'Mitrulu Editorial' },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    comments: [NowNewsCommentSchema],
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
  },
  { collection: 'now_news', timestamps: true }
);

export const NowNewsModel: mongoose.Model<INowNews> =
  (mongoose.models.NowNews as mongoose.Model<INowNews>) ||
  mongoose.model<INowNews>('NowNews', NowNewsSchema);

export default NowNewsModel;

