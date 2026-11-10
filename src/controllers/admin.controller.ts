import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import UserModel from '../models/user.model';
import PostModel from '../models/post.model';
import ReportModel from '../models/report.model';

const SUPER_ADMIN_EMAIL = 'srikanthtelkalapally888@gmail.com';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'mitrulu2026';

export class AdminController {
  private isSuperAdmin(email?: string): boolean {
    if (!email) return false;
    return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase().trim();
  }

  async checkAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      const isSuper = this.isSuperAdmin(email);
      res.json({
        success: true,
        authorized: isSuper,
        user: isSuper ? req.user : null,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, authorized: false, error: error.message });
    }
  }

  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { passcode, email } = req.body;
      const targetEmail = email || req.user?.email;

      if (!this.isSuperAdmin(targetEmail)) {
        res.status(403).json({
          success: false,
          authorized: false,
          error: 'యాక్సెస్ తిరస్కరించబడింది: సూపర్ అడ్మిన్ ఖాతా మాత్రమే అనుమతించబడుతుంది.',
        });
        return;
      }

      if (passcode !== ADMIN_SECRET) {
        res.status(401).json({
          success: false,
          authorized: false,
          error: 'చెల్లని అడ్మిన్ పాస్‌వర్డ్ (Invalid passkey).',
        });
        return;
      }

      res.json({
        success: true,
        authorized: true,
        message: 'అడ్మిన్ ప్రమాణీకరణ విజయవంతమైంది (Admin authorized)',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, authorized: false, error: error.message });
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        verifiedUsers,
        totalPosts,
        totalReels,
        pendingReports,
        coinAggregation,
      ] = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ isVerified: true }),
        PostModel.countDocuments(),
        PostModel.countDocuments({ type: 'video' }),
        ReportModel.countDocuments({ status: { $in: ['pending', 'hidden_pending_review'] } }),
        UserModel.aggregate([
          { $group: { _id: null, totalCirculating: { $sum: '$coins' } } },
        ]),
      ]);

      const circulatingCoins = coinAggregation[0]?.totalCirculating || 0;

      res.json({
        success: true,
        stats: {
          totalUsers,
          verifiedUsers,
          totalPosts,
          totalReels,
          pendingReports,
          circulatingCoins,
        },
      });
    } catch (error: any) {
      console.error('Error in getStats:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch admin stats' });
    }
  }

  async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const search = (req.query.search as string || '').trim();

      const filter: any = {};
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { name: regex },
          { email: regex },
          { handle: regex },
          { mitraId: regex },
        ];
      }

      const users = await UserModel.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await UserModel.countDocuments(filter);

      res.json({
        success: true,
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  }

  async getModerationQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const reports = await ReportModel.find({
        status: { $in: ['pending', 'hidden_pending_review', 'escalated'] },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({ success: true, reports });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch moderation queue' });
    }
  }

  async resolveReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId, action, targetType, targetId } = req.body;
      if (!reportId || !action) {
        res.status(400).json({ error: 'reportId and action are required' });
        return;
      }

      if (action === 'dismiss') {
        await ReportModel.findByIdAndUpdate(reportId, { status: 'dismissed' });
        if (targetType === 'post' && targetId) {
          await PostModel.findByIdAndUpdate(targetId, {
            isModerationHidden: false,
            moderationStatus: 'active',
          });
        }
      } else if (action === 'remove_content') {
        await ReportModel.findByIdAndUpdate(reportId, { status: 'resolved' });
        if (targetType === 'post' && targetId) {
          await PostModel.findByIdAndUpdate(targetId, {
            isModerationHidden: true,
            moderationStatus: 'removed',
          });
        }
      } else if (action === 'ban_user') {
        await ReportModel.findByIdAndUpdate(reportId, { status: 'resolved' });
        const report = await ReportModel.findById(reportId).lean();
        if (report?.reportedUserId) {
          await UserModel.findByIdAndUpdate(report.reportedUserId, {
            isShielded: true,
            moderationStatus: 'banned',
          });
        }
      }

      res.json({ success: true, message: 'చర్య విజయవంతంగా అమలు చేయబడింది (Action applied)' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to resolve report' });
    }
  }
}

export const adminController = new AdminController();

