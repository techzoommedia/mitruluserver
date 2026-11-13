import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import PostModel from '../models/post.model';
import UserModel from '../models/user.model';

export class PostController {
  async getPosts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const category = req.query.category as string;
      const currentUserId = req.userId;

      let userSeenIds: string[] = [];
      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        const dbUser: any = await UserModel.findById(currentUserId).select('seenPostIds').lean();
        if (dbUser && Array.isArray(dbUser.seenPostIds)) {
          userSeenIds = dbUser.seenPostIds;
        }
      }

      const querySeenParam = req.query.seenPostIds as string;
      const clientSeenIds = querySeenParam ? querySeenParam.split(',').filter(Boolean) : [];
      const allSeenIds = Array.from(new Set([...userSeenIds, ...clientSeenIds]));

      const filter: any = {};
      if (category && category !== 'all') {
        filter.category = category;
      }

      const searchQuery = (req.query.q || req.query.search) as string;
      if (searchQuery && searchQuery.trim()) {
        const qRegex = new RegExp(searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { caption: qRegex },
          { teluguCaption: qRegex },
          { tags: qRegex },
          { location: qRegex },
        ];
      }

      const typeFilter = req.query.type as string;
      if (typeFilter === 'video') {
        filter.type = 'video';
      }

      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
      const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 60;
      const skip = (page - 1) * limit;

      const rawPosts: any[] = await PostModel.find(filter)
        .populate('author', 'name teluguName handle mitraId avatar location isVerified friends followers following isShielded scheduledDeletionAt moderationStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const visiblePosts = rawPosts.filter((p: any) => {
        if (p.isModerationHidden || p.moderationStatus === 'hidden_pending_review' || p.moderationStatus === 'removed') {
          return false;
        }
        const author = p.author;
        if (!author) return true;
        if (author.moderationStatus === 'banned') return false;
        if (author.scheduledDeletionAt) {
          return Boolean(currentUserId && author._id?.toString() === currentUserId);
        }
        if (author.isShielded) {
          return currentUserId && author._id?.toString() === currentUserId;
        }
        return true;
      });

      const posts = visiblePosts.map((p: any) => {
        const author = p.author || {};
        const authorId = author._id ? author._id.toString() : 'unknown';
        const isLikedByMe = currentUserId
          ? (p.likes || []).some((id: any) => id.toString() === currentUserId)
          : false;
        const isSavedByMe = currentUserId
          ? (p.saves || []).some((id: any) => id.toString() === currentUserId)
          : false;

        const isAuthorFriend = currentUserId && Array.isArray(author.friends)
          ? author.friends.some((f: any) => f.toString() === currentUserId)
          : false;
        const isAuthorFollowed = currentUserId && Array.isArray(author.followers)
          ? author.followers.some((f: any) => f.toString() === currentUserId)
          : false;

        const mediaUrlsList: string[] =
          Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0
            ? p.mediaUrls
            : p.mediaUrl
            ? [p.mediaUrl]
            : [];

        const isPremium = Boolean(p.isPremium);
        const coinsRequired = Number(p.coinsRequired) || 0;
        const previewMediaUrl = p.previewMediaUrl || '';
        const isAuthor = currentUserId && authorId === currentUserId;
        const isUnlockedByMe = currentUserId
          ? (p.unlockedBy || []).some((id: any) => id.toString() === currentUserId)
          : false;
        const isUnlocked = !isPremium || isAuthor || isUnlockedByMe;

        return {
          id: p._id.toString(),
          author: {
            id: authorId,
            name: author.name || 'Telugu Mitrudu',
            teluguName: author.teluguName || 'తెలుగు మిత్రుడు',
            handle: author.mitraId || author.handle || 'mitrudu',
            avatar:
              author.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            bio: author.bio || '',
            location: author.location || p.location || 'హైదరాబాద్',
            isVerified: Boolean(author.isVerified),
            friendsCount: author.friends ? author.friends.length : 0,
            friendStatus: isAuthorFriend || isAuthorFollowed ? 'friends' : 'none',
            isFollowing: isAuthorFriend || isAuthorFollowed,
            isShielded: Boolean(author.isShielded),
            isOnline: true,
            interests: author.interests || ['tollywood', 'memes'],
          },
          type: p.type || 'image',
          mediaUrl: isUnlocked ? (mediaUrlsList[0] || p.mediaUrl || '') : (previewMediaUrl || mediaUrlsList[0] || p.mediaUrl || ''),
          mediaUrls: isUnlocked ? mediaUrlsList : (previewMediaUrl ? [previewMediaUrl] : mediaUrlsList),
          aspectRatio: p.aspectRatio || '1:1',
          thumbnailUrl: p.thumbnailUrl || mediaUrlsList[0] || p.mediaUrl || '',
          caption: p.caption || '',
          teluguCaption: p.teluguCaption || p.caption || '',
          category: p.category || 'tollywood',
          location: p.location || 'హైదరాబాద్',
          tags: p.tags || ['Mitrulu'],
          likesCount: p.likes ? p.likes.length : 0,
          commentsCount: p.comments ? p.comments.length : 0,
          sharesCount: p.sharesCount || 0,
          savesCount: p.saves ? p.saves.length : 0,
          viewsCount: p.viewsCount || 1,
          createdAt: new Date(p.createdAt).toISOString(),
          timestampMs: new Date(p.createdAt).getTime(),
          audioTrack: p.audioTrack,
          isLiked: isLikedByMe,
          isSaved: isSavedByMe,
          isSeen: allSeenIds.includes(p._id.toString()),
          isPremium,
          coinsRequired,
          previewMediaUrl,
          isUnlocked,
          totalCoinsEarned: p.totalCoinsEarned || 0,
          comments: (p.comments || []).map((c: any, cIdx: number) => ({
            id: c._id ? c._id.toString() : `c_${p._id?.toString() || 'p'}_${cIdx}`,
            author: {
              id: c.user ? c.user.toString() : 'unknown',
              name: c.userName || 'Mitrudu',
              teluguName: c.userTeluguName || c.userName || 'మిత్రుడు',
              handle: c.userMitraId || 'mitrudu',
              avatar: c.userAvatar || '',
            },
            text: c.text,
            createdAt: new Date(c.createdAt).toISOString(),
            replies: (c.replies || []).map((r: any, rIdx: number) => ({
              id: r._id ? r._id.toString() : `r_${cIdx}_${rIdx}`,
              author: {
                id: r.user ? r.user.toString() : 'unknown',
                name: r.userName || 'Mitrudu',
                teluguName: r.userTeluguName || r.userName || 'మిత్రుడు',
                handle: r.userMitraId || 'mitrudu',
                avatar: r.userAvatar || '',
              },
              text: r.text,
              createdAt: new Date(r.createdAt).toISOString(),
            })),
          })),
        };
      });

      res.json({ success: true, posts });
    } catch (err: any) {
      console.error('[PostController.getPosts error]:', err);
      res.status(500).json({ error: err.message || 'పోస్ట్‌లను లోడ్ చేయడం విఫలమైంది' });
    }
  }

  async createPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'దయచేసి లాగిన్ అవ్వండి (Authentication required)' });
        return;
      }

      const {
        mediaUrl,
        mediaUrls,
        type = 'image',
        caption,
        teluguCaption,
        category = 'general',
        location = 'హైదరాబాద్',
        tags = [],
        aspectRatio = '1:1',
        isPremium = false,
        coinsRequired = 0,
        previewMediaUrl = '',
      } = req.body;

      if (!caption?.trim()) {
        res.status(400).json({ error: 'దయచేసి క్యాప్షన్ రాయండి (Caption is required)' });
        return;
      }

      const post = await PostModel.create({
        author: new mongoose.Types.ObjectId(currentUserId),
        mediaUrl: mediaUrl || (Array.isArray(mediaUrls) ? mediaUrls[0] : ''),
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : mediaUrl ? [mediaUrl] : [],
        type,
        caption: caption.trim(),
        teluguCaption: teluguCaption?.trim() || caption.trim(),
        category,
        location,
        tags: Array.isArray(tags) ? tags : [],
        aspectRatio,
        isPremium: Boolean(isPremium),
        coinsRequired: Number(coinsRequired) || 0,
        previewMediaUrl: previewMediaUrl || '',
        likes: [],
        comments: [],
        saves: [],
        viewsCount: 1,
      });

      const populatedPost: any = await PostModel.findById(post._id)
        .populate('author', 'name teluguName handle mitraId avatar location isVerified')
        .lean();

      res.status(201).json({ success: true, post: populatedPost });
    } catch (err: any) {
      console.error('[PostController.createPost error]:', err);
      res.status(500).json({ error: err.message || 'పోస్ట్ సృష్టించడం విఫలమైంది' });
    }
  }

  async getPostById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid post ID' });
        return;
      }

      const post: any = await PostModel.findById(id)
        .populate('author', 'name teluguName handle mitraId avatar location isVerified')
        .lean();

      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json({ success: true, post });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async toggleLike(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const uObjId = new mongoose.Types.ObjectId(currentUserId);
      const isLiked = post.likes.some((l) => l.toString() === currentUserId);

      if (isLiked) {
        post.likes = post.likes.filter((l) => l.toString() !== currentUserId);
      } else {
        post.likes.push(uObjId);
      }

      await post.save();
      res.json({ success: true, isLiked: !isLiked, likesCount: post.likes.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { text, parentCommentId } = req.body;
      if (!text?.trim()) {
        res.status(400).json({ error: 'Comment text is required' });
        return;
      }

      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const user: any = await UserModel.findById(currentUserId).lean();
      const uObjId = new mongoose.Types.ObjectId(currentUserId);

      if (parentCommentId) {
        const comment = post.comments.find((c: any) => c._id?.toString() === parentCommentId);
        if (comment) {
          comment.replies = comment.replies || [];
          comment.replies.push({
            user: uObjId,
            userName: user?.name || 'Mitrudu',
            userTeluguName: user?.teluguName || user?.name || 'మిత్రుడు',
            userAvatar: user?.avatar || '',
            userMitraId: user?.mitraId || user?.handle || '',
            text: text.trim(),
            createdAt: new Date(),
          });
        }
      } else {
        post.comments.push({
          user: uObjId,
          userName: user?.name || 'Mitrudu',
          userTeluguName: user?.teluguName || user?.name || 'మిత్రుడు',
          userAvatar: user?.avatar || '',
          userMitraId: user?.mitraId || user?.handle || '',
          text: text.trim(),
          replies: [],
          createdAt: new Date(),
        });
      }

      await post.save();
      res.json({ success: true, commentsCount: post.comments.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async toggleSave(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const uObjId = new mongoose.Types.ObjectId(currentUserId);
      const isSaved = post.saves.some((s) => s.toString() === currentUserId);

      if (isSaved) {
        post.saves = post.saves.filter((s) => s.toString() !== currentUserId);
      } else {
        post.saves.push(uObjId);
      }

      await post.save();
      res.json({ success: true, isSaved: !isSaved, savesCount: post.saves.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async unlockPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const coinsNeeded = post.coinsRequired || 0;
      const user: any = await UserModel.findById(currentUserId);
      if (!user || (user.coins || 0) < coinsNeeded) {
        res.status(400).json({ error: 'నాణేలు సరిపోవు (Insufficient coins)' });
        return;
      }

      user.coins = (user.coins || 0) - coinsNeeded;
      await user.save();

      post.unlockedBy = post.unlockedBy || [];
      const uObjId = new mongoose.Types.ObjectId(currentUserId);
      if (!post.unlockedBy.some((u) => u.toString() === currentUserId)) {
        post.unlockedBy.push(uObjId);
        post.totalCoinsEarned = (post.totalCoinsEarned || 0) + coinsNeeded;
        await post.save();
      }

      res.json({ success: true, isUnlocked: true, remainingCoins: user.coins });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getSeen(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.json({ success: true, seenPostIds: [] });
        return;
      }
      const dbUser: any = await UserModel.findById(currentUserId).select('seenPostIds').lean();
      const seenPostIds = Array.isArray(dbUser?.seenPostIds) ? dbUser.seenPostIds : [];
      res.json({ success: true, seenPostIds });
    } catch {
      res.json({ success: true, seenPostIds: [] });
    }
  }

  async markSeen(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      const { postIds } = req.body;
      if (!currentUserId || !Array.isArray(postIds) || postIds.length === 0) {
        res.json({ success: true });
        return;
      }

      await UserModel.findByIdAndUpdate(currentUserId, {
        $addToSet: { seenPostIds: { $each: postIds } },
      });

      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  }
}

export const postController = new PostController();
export default postController;

