import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import StoryModel from '../models/story.model';

export class StoryController {
  async getStories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const now = new Date();
      const rawStories: any[] = await StoryModel.find({
        expiresAt: { $gt: now },
      })
        .populate('author', 'name teluguName handle mitraId avatar isVerified')
        .sort({ createdAt: -1 })
        .lean();

      // Group stories by author
      const authorMap = new Map<string, any>();
      for (const s of rawStories) {
        if (!s.author) continue;
        const authorId = s.author._id.toString();
        if (!authorMap.has(authorId)) {
          authorMap.set(authorId, {
            user: {
              id: authorId,
              name: s.author.name,
              teluguName: s.author.teluguName || s.author.name,
              handle: s.author.mitraId || s.author.handle,
              avatar: s.author.avatar || '',
              isVerified: Boolean(s.author.isVerified),
            },
            hasUnseen: true,
            stories: [],
          });
        }

        authorMap.get(authorId).stories.push({
          id: s._id.toString(),
          mediaUrl: s.mediaUrl,
          type: s.type || 'image',
          caption: s.caption || '',
          textContent: s.textContent || '',
          backgroundGradient: s.backgroundGradient || '',
          aspectRatio: s.aspectRatio || '9:16',
          fitMode: s.fitMode || 'cover',
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        });
      }

      res.json({ success: true, stories: Array.from(authorMap.values()) });
    } catch (err: any) {
      console.error('[StoryController.getStories error]:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch stories' });
    }
  }

  async createStory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { mediaUrl, type = 'image', caption = '', textContent = '', backgroundGradient = '', aspectRatio = '9:16', fitMode = 'cover' } = req.body;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const story = await StoryModel.create({
        author: new mongoose.Types.ObjectId(currentUserId),
        mediaUrl: mediaUrl || '',
        type,
        caption,
        textContent,
        backgroundGradient,
        aspectRatio,
        fitMode,
        expiresAt,
      });

      res.status(201).json({ success: true, story });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create story' });
    }
  }
}

export const storyController = new StoryController();
export default storyController;

