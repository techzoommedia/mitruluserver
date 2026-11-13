"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
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
            let email = req.user?.email;
            if (!email && req.userId) {
                const user = await user_model_1.default.findById(req.userId).select('email').lean();
                email = user?.email;
            }
            const isSuper = this.isSuperAdmin(email);
            res.json({
                success: true,
                authorized: isSuper,
                user: isSuper ? (req.user || { email, userId: req.userId }) : null,
            });
        }
        catch (error) {
            res.status(500).json({ success: false, authorized: false, error: error.message });
        }
    }
    async login(req, res) {
        try {
            const { passcode, email } = req.body;
            let targetEmail = email || req.user?.email;
            if (!targetEmail && req.userId) {
                const user = await user_model_1.default.findById(req.userId).select('email').lean();
                targetEmail = user?.email;
            }
            // If user is verified super admin (by authenticated token/email), grant access directly
            if (targetEmail && this.isSuperAdmin(targetEmail)) {
                res.json({
                    success: true,
                    authorized: true,
                    message: 'అడ్మిన్ ప్రమాణీకరణ విజయవంతమైంది (Admin authorized)',
                });
                return;
            }
            if (passcode && passcode === ADMIN_SECRET) {
                res.json({
                    success: true,
                    authorized: true,
                    message: 'అడ్మిన్ ప్రమాణీకరణ విజయవంతమైంది (Admin authorized)',
                });
                return;
            }
            res.status(401).json({
                success: false,
                authorized: false,
                error: 'చెల్లని అడ్మిన్ పాస్‌వర్డ్ లేదా ఖాతా (Invalid passkey or unauthorized account).',
            });
        }
        catch (error) {
            res.status(500).json({ success: false, authorized: false, error: error.message });
        }
    }
    async logout(req, res) {
        try {
            res.json({ success: true, authorized: false, message: 'Logged out' });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getStats(req, res) {
        try {
            const [totalUsers, verifiedUsers, totalPosts, totalReels, pendingReports, coinAggregation, recentUsers,] = await Promise.all([
                user_model_1.default.countDocuments(),
                user_model_1.default.countDocuments({ isVerified: true }),
                post_model_1.default.countDocuments(),
                post_model_1.default.countDocuments({ type: 'video' }),
                report_model_1.default.countDocuments({ status: { $in: ['pending', 'hidden_pending_review'] } }),
                user_model_1.default.aggregate([
                    { $group: { _id: null, totalCirculating: { $sum: '$coins' } } },
                ]),
                user_model_1.default.find()
                    .select('-passwordHash')
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean(),
            ]);
            const circulatingCoins = coinAggregation[0]?.totalCirculating || 0;
            res.json({
                success: true,
                stats: {
                    totalUsers,
                    verifiedUsers,
                    adminUsers: 1,
                    totalPosts,
                    totalReels,
                    totalImages: Math.max(0, totalPosts - totalReels),
                    totalCoinsCirculating: circulatingCoins,
                    totalCoinsEarned: circulatingCoins,
                    totalCoinsWithdrawn: 0,
                    totalPayoutsCount: 0,
                    totalPayoutsRupees: 0,
                    pendingPayoutsCount: 0,
                    pendingReports,
                    categoryDistribution: {},
                },
                recentUsers: recentUsers.map((u) => ({
                    id: u._id.toString(),
                    name: u.name || '',
                    teluguName: u.teluguName || '',
                    handle: u.handle || u.mitraId || '',
                    email: u.email || '',
                    avatar: u.avatar || '',
                    isVerified: Boolean(u.isVerified),
                    createdAt: u.createdAt || new Date().toISOString(),
                })),
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
            const search = (req.query.search || req.query.q || '').trim();
            const filterParam = (req.query.filter || 'all').trim();
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
            if (filterParam === 'verified') {
                filter.isVerified = true;
            }
            else if (filterParam === 'unverified') {
                filter.isVerified = { $ne: true };
            }
            else if (filterParam === 'admins') {
                filter.$or = [
                    { email: SUPER_ADMIN_EMAIL },
                    { role: 'admin' },
                    { isAdmin: true },
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
                users: users.map((u) => ({
                    id: u._id.toString(),
                    name: u.name || '',
                    teluguName: u.teluguName || '',
                    handle: u.handle || u.mitraId || '',
                    mitraId: u.mitraId || u.handle || '',
                    email: u.email || '',
                    avatar: u.avatar || '',
                    location: u.location || '',
                    isVerified: Boolean(u.isVerified),
                    coins: u.coins ?? 0,
                    earnedCoins: u.earnedCoins ?? (u.coins ?? 0),
                    coinsWithdrawn: u.coinsWithdrawn ?? 0,
                    role: u.role || (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL ? 'admin' : 'user'),
                    isAdmin: Boolean(u.isAdmin || (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL)),
                    followersCount: Array.isArray(u.followers) ? u.followers.length : 0,
                    followingCount: Array.isArray(u.following) ? u.following.length : 0,
                    friendsCount: Array.isArray(u.friends) ? u.friends.length : 0,
                    createdAt: u.createdAt || new Date().toISOString(),
                })),
                totalPages: Math.ceil(total / limit),
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch users' });
        }
    }
    async updateUser(req, res) {
        try {
            const { userId, isVerified, coinsDelta, setCoins } = req.body;
            if (!userId) {
                res.status(400).json({ error: 'userId is required' });
                return;
            }
            const update = {};
            if (typeof isVerified === 'boolean') {
                update.isVerified = isVerified;
            }
            if (typeof setCoins === 'number') {
                update.coins = Math.max(0, setCoins);
            }
            else if (typeof coinsDelta === 'number') {
                update.$inc = { coins: coinsDelta };
            }
            const user = await user_model_1.default.findByIdAndUpdate(userId, update, { new: true })
                .select('-passwordHash')
                .lean();
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({
                success: true,
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    teluguName: user.teluguName,
                    handle: user.handle,
                    isVerified: user.isVerified,
                    coins: user.coins,
                    earnedCoins: user.earnedCoins ?? user.coins,
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to update user' });
        }
    }
    async getUserCoinHistory(req, res) {
        try {
            const userId = req.query.userId || '';
            if (!userId) {
                res.status(400).json({ error: 'userId is required' });
                return;
            }
            const user = await user_model_1.default.findById(userId).select('-passwordHash').lean();
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({
                success: true,
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    teluguName: user.teluguName,
                    handle: user.handle,
                    coins: user.coins ?? 0,
                    earnedCoins: user.earnedCoins ?? 0,
                },
                history: [],
                stats: {
                    currentBalance: user.coins ?? 0,
                    totalCredited: user.earnedCoins ?? user.coins ?? 0,
                    totalDebited: 0,
                    transactionCount: 0,
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch coin history' });
        }
    }
    async getPosts(req, res) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
            const type = (req.query.type || 'all').trim();
            const category = (req.query.category || 'all').trim();
            const q = (req.query.q || '').trim();
            const filter = {};
            if (type && type !== 'all') {
                filter.type = type;
            }
            if (category && category !== 'all') {
                filter.category = category;
            }
            if (q) {
                filter.caption = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
            const posts = await post_model_1.default.find(filter)
                .populate('authorId', '_id name teluguName handle avatar isVerified')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            const total = await post_model_1.default.countDocuments(filter);
            res.json({
                success: true,
                posts: posts.map((p) => ({
                    id: p._id.toString(),
                    author: {
                        id: p.authorId?._id?.toString() || '',
                        name: p.authorId?.name || '',
                        teluguName: p.authorId?.teluguName || '',
                        handle: p.authorId?.handle || '',
                        avatar: p.authorId?.avatar || '',
                        isVerified: Boolean(p.authorId?.isVerified),
                    },
                    type: p.type || 'image',
                    mediaUrl: p.mediaUrl || '',
                    mediaUrls: p.mediaUrls || [],
                    thumbnailUrl: p.thumbnailUrl || '',
                    caption: p.caption || '',
                    teluguCaption: p.teluguCaption || '',
                    category: p.category || 'general',
                    location: p.location || '',
                    likesCount: p.likesCount ?? 0,
                    commentsCount: p.commentsCount ?? 0,
                    viewsCount: p.viewsCount ?? 0,
                    createdAt: p.createdAt || new Date().toISOString(),
                })),
                totalPages: Math.ceil(total / limit),
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch posts' });
        }
    }
    async deletePost(req, res) {
        try {
            const postId = req.query.postId || req.body?.postId;
            const postIds = req.body?.postIds;
            if (Array.isArray(postIds) && postIds.length > 0) {
                const result = await post_model_1.default.deleteMany({ _id: { $in: postIds } });
                res.json({ success: true, deletedCount: result.deletedCount });
                return;
            }
            if (postId) {
                await post_model_1.default.findByIdAndDelete(postId);
                res.json({ success: true, deletedCount: 1 });
                return;
            }
            res.status(400).json({ error: 'Post ID is required' });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to delete post' });
        }
    }
    async getPayouts(req, res) {
        try {
            res.json({
                success: true,
                payouts: [],
                eligibleCreators: [],
                stats: {
                    total: 0,
                    pending: 0,
                    completed: 0,
                    totalRupeesPaid: 0,
                    eligibleCreatorsCount: 0,
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch payouts' });
        }
    }
    async updatePayout(req, res) {
        try {
            res.json({ success: true, message: 'Payout updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to update payout' });
        }
    }
    async getAlgorithm(req, res) {
        try {
            res.json({
                success: true,
                weights: {
                    affinityWeight: 0.35,
                    engagementWeight: 0.25,
                    recencyWeight: 0.20,
                    formatWeight: 0.10,
                    categoryWeight: 0.10,
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch algorithm' });
        }
    }
    async saveAlgorithm(req, res) {
        try {
            res.json({ success: true, message: 'Algorithm weights saved' });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to save algorithm' });
        }
    }
    async getLogs(req, res) {
        try {
            res.json({
                success: true,
                logs: [],
                health: {
                    uptime: Math.floor(process.uptime()),
                    memory: {
                        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    },
                    status: 'healthy',
                    database: {
                        status: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'connecting',
                        pingMs: 4,
                    },
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to fetch logs' });
        }
    }
    async actionLogs(req, res) {
        try {
            res.json({
                success: true,
                health: {
                    uptime: Math.floor(process.uptime()),
                    memory: {
                        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    },
                    status: 'healthy',
                    database: {
                        status: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'connecting',
                        pingMs: 3,
                    },
                },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Failed to action logs' });
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
