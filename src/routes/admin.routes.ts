import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], optionalAuth, (req, res) =>
  adminController.checkAuth(req, res)
);
router.post(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], optionalAuth, (req, res) =>
  adminController.login(req, res)
);
router.get(['/api/admin/stats', '/api/admin/stats/', '/admin/stats', '/admin/stats/'], optionalAuth, (req, res) =>
  adminController.getStats(req, res)
);
router.get(['/api/admin/users', '/api/admin/users/', '/admin/users', '/admin/users/'], optionalAuth, (req, res) =>
  adminController.getUsers(req, res)
);
router.get(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], optionalAuth, (req, res) =>
  adminController.getModerationQueue(req, res)
);
router.post(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], optionalAuth, (req, res) =>
  adminController.resolveReport(req, res)
);

export default router;
