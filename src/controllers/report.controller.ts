import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import ReportModel, { ReportSeverity, ReportTargetType } from '../models/report.model';
import PostModel from '../models/post.model';
import UserModel from '../models/user.model';

export class ReportController {
  async createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        targetType = 'post',
        targetId,
        severity = 'blue',
        category,
        categoryLabel = '',
        categoryLabelTe = '',
        reasonDetails = '',
      } = req.body;

      if (!targetId || !category) {
        res.status(400).json({ error: 'Target ID and category are required' });
        return;
      }

      const reporterId = req.userId;
      let reporterDetails = {
        name: 'Mitrulu Member',
        handle: 'anonymous_user',
        mitraId: '',
        email: '',
      };

      if (reporterId && mongoose.Types.ObjectId.isValid(reporterId)) {
        const u: any = await UserModel.findById(reporterId).select('name handle mitraId email').lean();
        if (u) {
          reporterDetails = {
            name: u.name || 'Mitrulu Member',
            handle: u.handle || u.mitraId || 'user',
            mitraId: u.mitraId || '',
            email: u.email || '',
          };
        }
      }

      let reportedUserId: any = null;
      let reportedUserDetails = {
        name: 'Unknown Creator',
        handle: 'creator',
        mitraId: '',
        avatar: '',
      };

      if (targetType === 'post') {
        const targetPost: any = await PostModel.findById(targetId).populate('author').lean();
        if (targetPost && targetPost.author) {
          const author = targetPost.author;
          reportedUserId = author._id;
          reportedUserDetails = {
            name: author.name || author.teluguName || 'Creator',
            handle: author.handle || author.mitraId || 'creator',
            mitraId: author.mitraId || '',
            avatar: author.avatar || '',
          };
        }
      } else if (targetType === 'profile') {
        if (mongoose.Types.ObjectId.isValid(targetId)) {
          const targetUser: any = await UserModel.findById(targetId).lean();
          if (targetUser) {
            reportedUserId = targetUser._id;
            reportedUserDetails = {
              name: targetUser.name || targetUser.teluguName || 'Creator',
              handle: targetUser.handle || targetUser.mitraId || 'creator',
              mitraId: targetUser.mitraId || '',
              avatar: targetUser.avatar || '',
            };
          }
        }
      }

      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const reportNumber = `REP-${Date.now()}-${randomSuffix}`;

      const report = new ReportModel({
        reportNumber,
        targetType: targetType as ReportTargetType,
        targetId: String(targetId),
        reporterId: reporterId && mongoose.Types.ObjectId.isValid(reporterId) ? new mongoose.Types.ObjectId(reporterId) : undefined,
        reporterDetails,
        reportedUserId: reportedUserId && mongoose.Types.ObjectId.isValid(reportedUserId) ? new mongoose.Types.ObjectId(reportedUserId) : undefined,
        reportedUserDetails,
        severity: severity as ReportSeverity,
        category,
        reason: reasonDetails || categoryLabel || categoryLabelTe,
        status: severity === 'red' ? 'hidden_pending_review' : 'pending',
      });

      await report.save();

      // If severe (red), automatically flag post for review
      if (severity === 'red' && targetType === 'post') {
        await PostModel.findByIdAndUpdate(targetId, {
          isModerationHidden: true,
          moderationStatus: 'hidden_pending_review',
        });
      }

      res.status(201).json({
        success: true,
        reportNumber: report.reportNumber,
        reportId: report._id,
        status: report.status,
        message: 'ఫిర్యాదు విజయవంతంగా నమోదు చేయబడింది (Report registered successfully)',
      });
    } catch (error: any) {
      console.error('Error in createReport:', error);
      res.status(500).json({ error: error.message || 'Failed to submit report' });
    }
  }

  async getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, targetType, limit = '50', page = '1' } = req.query;
      const filter: any = {};
      if (status) filter.status = status;
      if (targetType) filter.targetType = targetType;

      const skip = (Math.max(1, parseInt(page as string, 10)) - 1) * Math.min(100, parseInt(limit as string, 10));
      const reports = await ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, parseInt(limit as string, 10)))
        .lean();

      res.json({ success: true, reports });
    } catch (error: any) {
      console.error('Error in getReports:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch reports' });
    }
  }
}

export const reportController = new ReportController();

