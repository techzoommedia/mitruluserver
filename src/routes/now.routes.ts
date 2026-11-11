import { Router } from 'express';
import { nowController } from '../controllers/now.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// GET now news feed - supports /api/now and /now with/without trailing slash
router.get(['/api/now', '/api/now/', '/now', '/now/'], optionalAuth, (req, res) =>
  nowController.getNowNews(req, res)
);

// Submit / Create news
router.post(['/api/now', '/api/now/', '/now', '/now/'], requireAuth, (req, res) =>
  nowController.createNowNews(req, res)
);

// Status approval/rejection by admin (supports both PATCH and POST)
router.patch(['/api/now/:id/status', '/api/now/:id/status/', '/now/:id/status', '/now/:id/status/'], requireAuth, (req, res) =>
  nowController.updateNowStatus(req, res)
);
router.post(['/api/now/:id/status', '/api/now/:id/status/', '/now/:id/status', '/now/:id/status/'], requireAuth, (req, res) =>
  nowController.updateNowStatus(req, res)
);

// Seed news
router.post(['/api/now/seed', '/api/now/seed/', '/now/seed', '/now/seed/'], requireAuth, (req, res) =>
  nowController.seedNowNews(req, res)
);

// Like, Comment, Share
router.post(['/api/now/:id/like', '/api/now/:id/like/', '/now/:id/like', '/now/:id/like/'], requireAuth, (req, res) =>
  nowController.toggleLikeNow(req, res)
);
router.post(['/api/now/:id/comment', '/api/now/:id/comment/', '/now/:id/comment', '/now/:id/comment/'], requireAuth, (req, res) =>
  nowController.addCommentNow(req, res)
);
router.post(['/api/now/:id/share', '/api/now/:id/share/', '/now/:id/share', '/now/:id/share/'], optionalAuth, (req, res) =>
  nowController.shareNow(req, res)
);

export default router;
