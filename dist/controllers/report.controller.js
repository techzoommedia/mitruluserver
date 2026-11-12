"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportController = exports.ReportController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../models/report.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
class ReportController {
    async createReport(req, res) {
        try {
            const { targetType = 'post', targetId, severity = 'blue', category, categoryLabel = '', categoryLabelTe = '', reasonDetails = '', } = req.body;
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
            if (reporterId && mongoose_1.default.Types.ObjectId.isValid(reporterId)) {
                const u = await user_model_1.default.findById(reporterId).select('name handle mitraId email').lean();
                if (u) {
                    reporterDetails = {
                        name: u.name || 'Mitrulu Member',
                        handle: u.handle || u.mitraId || 'user',
                        mitraId: u.mitraId || '',
                        email: u.email || '',
                    };
                }
            }
            let reportedUserId = null;
            let reportedUserDetails = {
                name: 'Unknown Creator',
                handle: 'creator',
                mitraId: '',
                avatar: '',
            };
            if (targetType === 'post') {
                const targetPost = await post_model_1.default.findById(targetId).populate('author').lean();
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
            }
            else if (targetType === 'profile') {
                if (mongoose_1.default.Types.ObjectId.isValid(targetId)) {
                    const targetUser = await user_model_1.default.findById(targetId).lean();
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
            const report = new report_model_1.default({
                reportNumber,
                targetType: targetType,
                targetId: String(targetId),
                reporterId: reporterId && mongoose_1.default.Types.ObjectId.isValid(reporterId) ? new mongoose_1.default.Types.ObjectId(reporterId) : undefined,
                reporterDetails,
                reportedUserId: reportedUserId && mongoose_1.default.Types.ObjectId.isValid(reportedUserId) ? new mongoose_1.default.Types.ObjectId(reportedUserId) : undefined,
                reportedUserDetails,
                severity: severity,
                category,
                reason: reasonDetails || categoryLabel || categoryLabelTe,
                status: severity === 'red' ? 'hidden_pending_review' : 'pending',
            });
            await report.save();
            // If severe (red), automatically flag post for review
            if (severity === 'red' && targetType === 'post') {
                await post_model_1.default.findByIdAndUpdate(targetId, {
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
        }
        catch (error) {
            console.error('Error in createReport:', error);
            res.status(500).json({ error: error.message || 'Failed to submit report' });
        }
    }
    async getReports(req, res) {
        try {
            const { status, targetType, limit = '50', page = '1' } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            if (targetType)
                filter.targetType = targetType;
            const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
            const reports = await report_model_1.default.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Math.min(100, parseInt(limit, 10)))
                .lean();
            res.json({ success: true, reports });
        }
        catch (error) {
            console.error('Error in getReports:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch reports' });
        }
    }
}
exports.ReportController = ReportController;
exports.reportController = new ReportController();
