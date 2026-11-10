import mongoose, { Schema, Document } from 'mongoose';

export interface IStory extends Document {
  author: mongoose.Types.ObjectId;
  mediaUrl: string;
  type: 'image' | 'video' | 'text';
  caption?: string;
  textContent?: string;
  backgroundGradient?: string;
  aspectRatio?: '9:16' | '3:4' | '1:1';
  fitMode?: 'cover' | 'contain';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export const StorySchema = new Schema<IStory>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaUrl: { type: String, default: '' },
    type: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true,
      default: 'image',
    },
    caption: { type: String, default: '' },
    textContent: { type: String, default: '' },
    backgroundGradient: { type: String, default: '' },
    aspectRatio: {
      type: String,
      enum: ['9:16', '3:4', '1:1'],
      default: '9:16',
    },
    fitMode: {
      type: String,
      enum: ['cover', 'contain'],
      default: 'cover',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { collection: 'stories', timestamps: true }
);

export const StoryModel: mongoose.Model<IStory> =
  (mongoose.models.Story as mongoose.Model<IStory>) || mongoose.model<IStory>('Story', StorySchema);

export default StoryModel;

