"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const report_model_1 = __importDefault(require("../models/report.model"));
const SUPER_ADMIN_EMAIL = 'srikanthtelkalapally888@gmail.com';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'mitrulu2026';
class AdminController {
    isSuperAdmin(email) {
        if (!email)
            return false;
        return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase().trim();
    }
    async checkAuth(req, res) {
        try {
            const email = req.user?.email;
            const isSuper = this.isSuperAdmin(email);
            res.json({
                success: true,
                authorized: isSuper,
                user: isSuper ? req.user : null,
            });
        }
        catch (error) {
            res.status(500).json({ success: false, authorized: false, error: error.message });
        }
    }
    async login(req, res) {
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
        }
        catch (error) {
            res.status(500).json({ success: false, authorized: false, error: error.message });
        }
    }
    async getStats(req, res) {
        try {
            const [totalUsers, verifiedUsers, totalPosts, totalReels, pendingReports, coinAggregation,] = await Promise.all([
                user_model_1.default.countDocuments(),
                user_model_1.default.countDocuments({ isVerified: true }),
                post_model_1.default.countDocuments(),
                post_model_1.default.countDocuments({ type: 'video' }),
                report_model_1.default.countDocuments({ status: { $in: ['pending', 'hidden_pending_review'] } }),
                user_model_1.default.aggregate([
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
        }
        catch (error) {
            console.error('Error in getStats:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch admin stats' });
        }
    }
    async getUsers(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
            const search = (req.query.search || '').trim();
            const filter = {};
            if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { name: regex },
                    { email: regex },
                    { handle: regex },
                    { mitraId: regex },
                ];
            }
            const users = await user_model_1.default.find(filter)
                .select('-passwordHash')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            const total = await user_model_1.default.countDocuments(filter);
            res.json({
                success: true,
                users,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch users' });
        }
    }
    async getModerationQueue(req, res) {
        try {
            const reports = await report_model_1.default.find({
                status: { $in: ['pending', 'hidden_pending_review', 'escalated'] },
            })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean();
            res.json({ success: true, reports });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch moderation queue' });
        }
    }
    async resolveReport(req, res) {
        try {
            const { reportId, action, targetType, targetId } = req.body;
            if (!reportId || !action) {
                res.status(400).json({ error: 'reportId and action are required' });
                return;
            }
            if (action === 'dismiss') {
                await report_model_1.default.findByIdAndUpdate(reportId, { status: 'dismissed' });
                if (targetType === 'post' && targetId) {
                    await post_model_1.default.findByIdAndUpdate(targetId, {
                        isModerationHidden: false,
                        moderationStatus: 'active',
                    });
                }
            }
            else if (action === 'remove_content') {
                await report_model_1.default.findByIdAndUpdate(reportId, { status: 'resolved' });
                if (targetType === 'post' && targetId) {
                    await post_model_1.default.findByIdAndUpdate(targetId, {
                        isModerationHidden: true,
                        moderationStatus: 'removed',
                    });
                }
            }
            else if (action === 'ban_user') {
                await report_model_1.default.findByIdAndUpdate(reportId, { status: 'resolved' });
                const report = await report_model_1.default.findById(reportId).lean();
                if (report?.reportedUserId) {
                    await user_model_1.default.findByIdAndUpdate(report.reportedUserId, {
                        isShielded: true,
                        moderationStatus: 'banned',
                    });
                }
            }
            res.json({ success: true, message: 'చర్య విజయవంతంగా అమలు చేయబడింది (Action applied)' });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to resolve report' });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
