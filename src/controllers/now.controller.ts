import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import NowNewsModel from '../models/now.model';
import UserModel from '../models/user.model';

export class NowController {
  async getNowNews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const category = req.query.category as string;
      const currentUserId = req.userId;
      const limit = parseInt((req.query.limit as string) || '50', 10);

      const filter: any = { status: 'approved' };
      if (category && category !== 'All') {
        filter.category = category;
      }

      const news: any[] = await NowNewsModel.find(filter)
        .populate('author', 'name teluguName handle avatar isVerified')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formatted = news.map((item) => {
        const isLiked = currentUserId
          ? (item.likes || []).some((l: any) => l.toString() === currentUserId)
          : false;

        return {
          id: item._id.toString(),
          title: item.title,
          teluguTitle: item.teluguTitle || item.title,
          content: item.content,
          teluguContent: item.teluguContent || item.content,
          imageUrl: item.imageUrl,
          author: {
            id: item.author?._id?.toString() || 'editor',
            name: item.author?.name || 'Mitrulu Editorial',
            avatar: item.author?.avatar || '/mitrulu-logo.webp',
          },
          category: item.category,
          source: item.source || 'Mitrulu Editorial',
          likesCount: (item.likes || []).length,
          commentsCount: (item.comments || []).length,
          sharesCount: item.sharesCount || 0,
          viewsCount: item.viewsCount || 1,
          isLiked,
          createdAt: item.createdAt,
          comments: (item.comments || []).map((c: any) => ({
            id: c._id?.toString(),
            userName: c.userName || 'Mitrudu',
            userTeluguName: c.userTeluguName,
            userAvatar: c.userAvatar,
            text: c.text,
            createdAt: c.createdAt,
          })),
        };
      });

      res.json({ success: true, news: formatted });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch now news' });
    }
  }

  async toggleLikeNow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const item = await NowNewsModel.findById(id);
      if (!item) {
        res.status(404).json({ error: 'News item not found' });
        return;
      }

      const uObjId = new mongoose.Types.ObjectId(currentUserId);
      const isLiked = item.likes.some((l) => l.toString() === currentUserId);

      if (isLiked) {
        item.likes = item.likes.filter((l) => l.toString() !== currentUserId);
        item.likesCount = Math.max(0, (item.likesCount || 1) - 1);
      } else {
        item.likes.push(uObjId);
        item.likesCount = (item.likesCount || 0) + 1;
      }

      await item.save();
      res.json({ success: true, isLiked: !isLiked, likesCount: item.likesCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async addCommentNow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { text } = req.body;
      if (!text?.trim()) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      const item = await NowNewsModel.findById(id);
      if (!item) {
        res.status(404).json({ error: 'News item not found' });
        return;
      }

      const user: any = await UserModel.findById(currentUserId).lean();
      item.comments.push({
        user: new mongoose.Types.ObjectId(currentUserId),
        userName: user?.name || 'Mitrudu',
        userTeluguName: user?.teluguName || user?.name || 'మిత్రుడు',
        userHandle: user?.mitraId || user?.handle || '',
        userAvatar: user?.avatar || '',
        text: text.trim(),
        createdAt: new Date(),
      });
      item.commentsCount = (item.commentsCount || 0) + 1;

      await item.save();
      res.json({ success: true, commentsCount: item.commentsCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async shareNow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await NowNewsModel.findByIdAndUpdate(id, { $inc: { sharesCount: 1 } });
      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  }
}

export const nowController = new NowController();
export default nowController;

