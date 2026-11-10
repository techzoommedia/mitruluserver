import { Router } from 'express';
import { nowController } from '../controllers/now.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/api/now', optionalAuth, (req, res) => nowController.getNowNews(req, res));
router.post('/api/now/:id/like', requireAuth, (req, res) => nowController.toggleLikeNow(req, res));
router.post('/api/now/:id/comment', requireAuth, (req, res) => nowController.addCommentNow(req, res));
router.post('/api/now/:id/share', optionalAuth, (req, res) => nowController.shareNow(req, res));

export default router;

