import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// ── Admin Session & Authentication ──────────────────────────────────────────
router.get(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], optionalAuth, (req, res) =>
  adminController.checkAuth(req, res)
);
router.post(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], optionalAuth, (req, res) =>
  adminController.login(req, res)
);
router.delete(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], optionalAuth, (req, res) =>
  adminController.logout(req, res)
);

// ── Overview & Statistics ───────────────────────────────────────────────────
router.get(['/api/admin/stats', '/api/admin/stats/', '/admin/stats', '/admin/stats/'], optionalAuth, (req, res) =>
  adminController.getStats(req, res)
);

// ── User Management & Coins ─────────────────────────────────────────────────
router.get(['/api/admin/users', '/api/admin/users/', '/admin/users', '/admin/users/'], optionalAuth, (req, res) =>
  adminController.getUsers(req, res)
);
router.patch(['/api/admin/users', '/api/admin/users/', '/admin/users', '/admin/users/'], optionalAuth, (req, res) =>
  adminController.updateUser(req, res)
);
router.get(
  ['/api/admin/users/history', '/api/admin/users/history/', '/admin/users/history', '/admin/users/history/'],
  optionalAuth,
  (req, res) => adminController.getUserCoinHistory(req, res)
);

// ── Posts & Content Management ──────────────────────────────────────────────
router.get(['/api/admin/posts', '/api/admin/posts/', '/admin/posts', '/admin/posts/'], optionalAuth, (req, res) =>
  adminController.getPosts(req, res)
);
router.delete(['/api/admin/posts', '/api/admin/posts/', '/admin/posts', '/admin/posts/'], optionalAuth, (req, res) =>
  adminController.deletePost(req, res)
);

// ── Moderation & Safety Reports ─────────────────────────────────────────────
router.get(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], optionalAuth, (req, res) =>
  adminController.getModerationQueue(req, res)
);
router.post(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], optionalAuth, (req, res) =>
  adminController.resolveReport(req, res)
);

// ── Payouts & Creator Earnings ──────────────────────────────────────────────
router.get(['/api/admin/payouts', '/api/admin/payouts/', '/admin/payouts', '/admin/payouts/'], optionalAuth, (req, res) =>
  adminController.getPayouts(req, res)
);
router.patch(['/api/admin/payouts', '/api/admin/payouts/', '/admin/payouts', '/admin/payouts/'], optionalAuth, (req, res) =>
  adminController.updatePayout(req, res)
);

// ── Algorithm Configuration ─────────────────────────────────────────────────
router.get(['/api/admin/algorithm', '/api/admin/algorithm/', '/admin/algorithm', '/admin/algorithm/'], optionalAuth, (req, res) =>
  adminController.getAlgorithm(req, res)
);
router.post(['/api/admin/algorithm', '/api/admin/algorithm/', '/admin/algorithm', '/admin/algorithm/'], optionalAuth, (req, res) =>
  adminController.saveAlgorithm(req, res)
);

// ── Telemetry & System Health Logs ──────────────────────────────────────────
router.get(['/api/admin/logs', '/api/admin/logs/', '/admin/logs', '/admin/logs/'], optionalAuth, (req, res) =>
  adminController.getLogs(req, res)
);
router.post(['/api/admin/logs', '/api/admin/logs/', '/admin/logs', '/admin/logs/'], optionalAuth, (req, res) =>
  adminController.actionLogs(req, res)
);

export default router;
