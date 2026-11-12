"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyController = exports.StoryController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const story_model_1 = __importDefault(require("../models/story.model"));
class StoryController {
    async getStories(req, res) {
        try {
            const now = new Date();
            const rawStories = await story_model_1.default.find({
                expiresAt: { $gt: now },
            })
                .populate('author', 'name teluguName handle mitraId avatar isVerified')
                .sort({ createdAt: -1 })
                .lean();
            // Group stories by author
            const authorMap = new Map();
            for (const s of rawStories) {
                if (!s.author)
                    continue;
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
        }
        catch (err) {
            console.error('[StoryController.getStories error]:', err);
            res.status(500).json({ error: err.message || 'Failed to fetch stories' });
        }
    }
    async createStory(req, res) {
        try {
            const currentUserId = req.userId;
            if (!currentUserId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const { mediaUrl, type = 'image', caption = '', textContent = '', backgroundGradient = '', aspectRatio = '9:16', fitMode = 'cover' } = req.body;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            const story = await story_model_1.default.create({
                author: new mongoose_1.default.Types.ObjectId(currentUserId),
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
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create story' });
        }
    }
}
exports.StoryController = StoryController;
exports.storyController = new StoryController();
exports.default = exports.storyController;
