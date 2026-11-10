import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import UserModel from '../models/user.model';
import PostModel from '../models/post.model';

export class UserController {
  async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const query = ((req.query.q || '') as string).trim();
      const type = req.query.type as string; // 'followers' | 'following'
      const targetUserId = (req.query.userId as string) || currentUserId;

      const conditions: any[] = [];

      if (type === 'followers' && targetUserId) {
        let targetDoc: any = null;
        if (mongoose.Types.ObjectId.isValid(targetUserId)) {
          targetDoc = await UserModel.findById(targetUserId).select('followers isShielded').lean();
        }
        if (!targetDoc) {
          targetDoc = await UserModel.findOne({
            $or: [{ handle: targetUserId.toLowerCase() }, { mitraId: targetUserId.toLowerCase() }],
          }).select('_id followers isShielded').lean();
        }

        if (!targetDoc) {
          res.json({ success: true, users: [], totalUsersCount: 0 });
          return;
        }

        const followerIds = Array.isArray(targetDoc.followers) ? targetDoc.followers : [];
        conditions.push({
          $or: [
            ...(followerIds.length > 0 ? [{ _id: { $in: followerIds } }] : []),
            { following: targetDoc._id },
          ],
        });
      } else if (type === 'following' && targetUserId) {
        let targetDoc: any = null;
        if (mongoose.Types.ObjectId.isValid(targetUserId)) {
          targetDoc = await UserModel.findById(targetUserId).select('following isShielded').lean();
        }
        if (!targetDoc) {
          targetDoc = await UserModel.findOne({
            $or: [{ handle: targetUserId.toLowerCase() }, { mitraId: targetUserId.toLowerCase() }],
          }).select('_id following isShielded').lean();
        }

        if (!targetDoc) {
          res.json({ success: true, users: [], totalUsersCount: 0 });
          return;
        }

        const followingIds = Array.isArray(targetDoc.following) ? targetDoc.following : [];
        conditions.push({
          $or: [
            ...(followingIds.length > 0 ? [{ _id: { $in: followingIds } }] : []),
            { followers: targetDoc._id },
          ],
        });
      }

      if (query) {
        const cleanQ = query.replace(/^@/, '');
        const qRegex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        conditions.push({
          $or: [
            { name: qRegex },
            { teluguName: qRegex },
            { handle: qRegex },
            { mitraId: qRegex },
            { location: qRegex },
          ],
        });
      }

      // Hide banned accounts
      conditions.push({ moderationStatus: { $ne: 'banned' } });

      const finalFilter = conditions.length > 0 ? { $and: conditions } : {};

      const dbUsers: any[] = await UserModel.find(finalFilter)
        .select('name teluguName handle mitraId avatar bio teluguBio location isVerified friends followers following interests isShielded lastSeen')
        .limit(limit)
        .lean();

      let currentDbUser: any = null;
      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        currentDbUser = await UserModel.findById(currentUserId).select('friends following followers').lean();
      }

      const myFollowingSet = new Set((currentDbUser?.following || []).map((f: any) => f.toString()));
      const myFollowersSet = new Set((currentDbUser?.followers || []).map((f: any) => f.toString()));
      const myFriendsSet = new Set((currentDbUser?.friends || []).map((f: any) => f.toString()));

      const users = dbUsers.map((u) => {
        const uid = u._id.toString();
        const isFollowed = myFollowingSet.has(uid);
        const isFollower = myFollowersSet.has(uid);
        const isFriend = myFriendsSet.has(uid) || (isFollowed && isFollower);

        return {
          id: uid,
          _id: uid,
          name: u.name,
          teluguName: u.teluguName || u.name,
          handle: u.mitraId || u.handle,
          mitraId: u.mitraId || u.handle,
          avatar: u.avatar || '',
          bio: u.bio || '',
          teluguBio: u.teluguBio || '',
          location: u.location || 'హైదరాబాద్',
          friendsCount: (u.friends || []).length,
          followersCount: (u.followers || []).length,
          followingCount: (u.following || []).length,
          isVerified: Boolean(u.isVerified),
          isFollowing: isFollowed,
          isFollower,
          friendStatus: isFriend ? 'friends' : isFollowed ? 'following' : 'none',
          interests: u.interests || [],
          lastSeen: u.lastSeen,
        };
      });

      res.json({ success: true, users, totalUsersCount: users.length });
    } catch (err: any) {
      console.error('[UserController.getUsers error]:', err);
      res.status(500).json({ error: err.message || 'యూజర్లను లోడ్ చేయడం విఫలమైంది' });
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      const targetQuery = (req.query.userId || req.query.handle || currentUserId) as string;

      if (!targetQuery) {
        res.status(400).json({ error: 'Target user is required' });
        return;
      }

      let user: any = null;
      if (mongoose.Types.ObjectId.isValid(targetQuery)) {
        user = await UserModel.findById(targetQuery).lean();
      }
      if (!user) {
        const cleanHandle = targetQuery.toLowerCase().replace(/^@/, '');
        user = await UserModel.findOne({
          $or: [{ handle: cleanHandle }, { mitraId: cleanHandle }],
        }).lean();
      }

      if (!user) {
        res.status(404).json({ error: 'యూజర్ ప్రొఫైల్ దొరకలేదు (User not found)' });
        return;
      }

      const uid = user._id.toString();
      const postsCount = await PostModel.countDocuments({ author: user._id });

      let isFollowing = false;
      let isFollower = false;
      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        const currentUser: any = await UserModel.findById(currentUserId).select('following followers').lean();
        if (currentUser) {
          isFollowing = (currentUser.following || []).some((f: any) => f.toString() === uid);
          isFollower = (currentUser.followers || []).some((f: any) => f.toString() === uid);
        }
      }

      res.json({
        success: true,
        user: {
          id: uid,
          _id: uid,
          name: user.name,
          teluguName: user.teluguName || user.name,
          handle: user.mitraId || user.handle,
          mitraId: user.mitraId || user.handle,
          avatar: user.avatar || '',
          bio: user.bio || '',
          teluguBio: user.teluguBio || '',
          location: user.location || 'హైదరాబాద్',
          friendsCount: (user.friends || []).length,
          followersCount: (user.followers || []).length,
          followingCount: (user.following || []).length,
          postsCount,
          coins: user.coins || 0,
          earnedCoins: user.earnedCoins || 0,
          isVerified: Boolean(user.isVerified),
          isFollowing,
          isFollower,
          friendStatus: isFollowing && isFollower ? 'friends' : isFollowing ? 'following' : 'none',
          interests: user.interests || [],
          lastSeen: user.lastSeen,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { name, teluguName, bio, teluguBio, location, avatar, interests, handle, mitraId } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (teluguName) updateData.teluguName = teluguName.trim();
      if (bio !== undefined) updateData.bio = bio;
      if (teluguBio !== undefined) updateData.teluguBio = teluguBio;
      if (location) updateData.location = location;
      if (avatar) updateData.avatar = avatar;
      if (Array.isArray(interests)) updateData.interests = interests;
      if (mitraId || handle) {
        const clean = (mitraId || handle).trim().toLowerCase().replace(/^@/, '');
        updateData.mitraId = clean;
        updateData.handle = clean;
      }

      const updated = await UserModel.findByIdAndUpdate(currentUserId, updateData, { new: true }).lean();
      res.json({ success: true, user: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async toggleFollow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { targetUserId } = req.body;
      if (!targetUserId || targetUserId === currentUserId) {
        res.status(400).json({ error: 'Invalid target user' });
        return;
      }

      const me = await UserModel.findById(currentUserId);
      const target = await UserModel.findById(targetUserId);
      if (!me || !target) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const targetObjId = new mongoose.Types.ObjectId(targetUserId);
      const myObjId = new mongoose.Types.ObjectId(currentUserId);

      const isFollowing = (me.following || []).some((f) => f.toString() === targetUserId);

      if (isFollowing) {
        me.following = (me.following || []).filter((f) => f.toString() !== targetUserId);
        target.followers = (target.followers || []).filter((f) => f.toString() !== currentUserId);
      } else {
        me.following = me.following || [];
        me.following.push(targetObjId);
        target.followers = target.followers || [];
        target.followers.push(myObjId);
      }

      await me.save();
      await target.save();

      res.json({
        success: true,
        isFollowing: !isFollowing,
        followersCount: target.followers.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async toggleFriend(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required to add friends', requiresAuth: true });
        return;
      }

      const { targetUserId } = req.body;
      if (!targetUserId || targetUserId === currentUserId) {
        res.status(400).json({ error: 'Invalid target user' });
        return;
      }

      const currentObjectId = new mongoose.Types.ObjectId(currentUserId);
      const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

      const targetUser = await UserModel.findById(targetObjectId);
      const currentUser = await UserModel.findById(currentObjectId);

      if (!targetUser || !currentUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      currentUser.friends = currentUser.friends || [];
      targetUser.friends = targetUser.friends || [];

      const isFriend = currentUser.friends.some((f) => f.toString() === targetUserId);

      if (isFriend) {
        currentUser.friends = currentUser.friends.filter((f) => f.toString() !== targetUserId);
        targetUser.friends = targetUser.friends.filter((f) => f.toString() !== currentUserId);
      } else {
        currentUser.friends.push(targetObjectId);
        targetUser.friends.push(currentObjectId);
      }

      await currentUser.save();
      await targetUser.save();

      res.json({
        success: true,
        friendStatus: !isFriend ? 'friends' : 'none',
        friendsCount: currentUser.friends.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getBlocked(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const me: any = await UserModel.findById(currentUserId).select('blockedUsers').lean();
      const blockedUserIds = (me?.blockedUsers || []).map((id: any) => id.toString());
      res.json({ success: true, blockedUserIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async toggleBlock(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { targetUserId, block = true } = req.body;
      if (!targetUserId) {
        res.status(400).json({ error: 'Target user ID is required' });
        return;
      }

      const targetObjId = new mongoose.Types.ObjectId(targetUserId);
      if (block) {
        await UserModel.findByIdAndUpdate(currentUserId, {
          $addToSet: { blockedUsers: targetObjId },
        });
      } else {
        await UserModel.findByIdAndUpdate(currentUserId, {
          $pull: { blockedUsers: targetObjId },
        });
      }

      res.json({ success: true, isBlocked: block });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Schedule deletion in 7 days or execute immediately
      await UserModel.findByIdAndUpdate(currentUserId, {
        scheduledDeletionAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      res.json({ success: true, message: 'Account scheduled for deletion' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const userController = new UserController();
export default userController;
