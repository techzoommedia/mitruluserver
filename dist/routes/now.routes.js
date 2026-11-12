"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const now_controller_1 = require("../controllers/now.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// GET now news feed - supports /api/now and /now with/without trailing slash
router.get(['/api/now', '/api/now/', '/now', '/now/'], auth_middleware_1.optionalAuth, (req, res) => now_controller_1.nowController.getNowNews(req, res));
// Submit / Create news
router.post(['/api/now', '/api/now/', '/now', '/now/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.createNowNews(req, res));
// Status approval/rejection by admin (supports both PATCH and POST)
router.patch(['/api/now/:id/status', '/api/now/:id/status/', '/now/:id/status', '/now/:id/status/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.updateNowStatus(req, res));
router.post(['/api/now/:id/status', '/api/now/:id/status/', '/now/:id/status', '/now/:id/status/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.updateNowStatus(req, res));
// Seed news
router.post(['/api/now/seed', '/api/now/seed/', '/now/seed', '/now/seed/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.seedNowNews(req, res));
// Like, Comment, Share
router.post(['/api/now/:id/like', '/api/now/:id/like/', '/now/:id/like', '/now/:id/like/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.toggleLikeNow(req, res));
router.post(['/api/now/:id/comment', '/api/now/:id/comment/', '/now/:id/comment', '/now/:id/comment/'], auth_middleware_1.requireAuth, (req, res) => now_controller_1.nowController.addCommentNow(req, res));
router.post(['/api/now/:id/share', '/api/now/:id/share/', '/now/:id/share', '/now/:id/share/'], auth_middleware_1.optionalAuth, (req, res) => now_controller_1.nowController.shareNow(req, res));
exports.default = router;
