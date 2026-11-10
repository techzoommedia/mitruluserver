import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/api/admin/auth', optionalAuth, (req, res) => adminController.checkAuth(req, res));
router.post('/api/admin/auth', optionalAuth, (req, res) => adminController.login(req, res));
router.get('/api/admin/stats', optionalAuth, (req, res) => adminController.getStats(req, res));
router.get('/api/admin/users', optionalAuth, (req, res) => adminController.getUsers(req, res));
router.get('/api/admin/moderation', optionalAuth, (req, res) => adminController.getModerationQueue(req, res));
router.post('/api/admin/moderation', optionalAuth, (req, res) => adminController.resolveReport(req, res));

export default router;

