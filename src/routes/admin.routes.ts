import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { adminGroupController } from '../controllers/admin-group.controller';
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

// ── Chat Groups Management ──────────────────────────────────────────────────
router.get(['/api/admin/groups', '/api/admin/groups/', '/admin/groups', '/admin/groups/'], optionalAuth, (req, res) =>
  adminGroupController.getGroups(req, res)
);
router.post(['/api/admin/groups', '/api/admin/groups/', '/admin/groups', '/admin/groups/'], optionalAuth, (req, res) =>
  adminGroupController.createGroup(req, res)
);
router.patch(['/api/admin/groups/:groupId', '/api/admin/groups/:groupId/', '/admin/groups/:groupId', '/admin/groups/:groupId/'], optionalAuth, (req, res) =>
  adminGroupController.updateGroup(req, res)
);
router.post(['/api/admin/groups/:groupId/admins', '/api/admin/groups/:groupId/admins/', '/admin/groups/:groupId/admins', '/admin/groups/:groupId/admins/'], optionalAuth, (req, res) =>
  adminGroupController.promoteAdmin(req, res)
);
router.delete(['/api/admin/groups/:groupId/admins/:userId', '/api/admin/groups/:groupId/admins/:userId/', '/admin/groups/:groupId/admins/:userId', '/admin/groups/:groupId/admins/:userId/'], optionalAuth, (req, res) =>
  adminGroupController.removeAdmin(req, res)
);
router.patch(['/api/admin/groups/:groupId/hold', '/api/admin/groups/:groupId/hold/', '/admin/groups/:groupId/hold', '/admin/groups/:groupId/hold/'], optionalAuth, (req, res) =>
  adminGroupController.toggleHold(req, res)
);
router.delete(['/api/admin/groups/:groupId', '/api/admin/groups/:groupId/', '/admin/groups/:groupId', '/admin/groups/:groupId/'], optionalAuth, (req, res) =>
  adminGroupController.deleteGroup(req, res)
);
router.get(['/api/admin/groups/:groupId/messages', '/api/admin/groups/:groupId/messages/', '/admin/groups/:groupId/messages', '/admin/groups/:groupId/messages/'], optionalAuth, (req, res) =>
  adminGroupController.getGroupMessages(req, res)
);
router.delete(['/api/admin/groups/:groupId/messages', '/api/admin/groups/:groupId/messages/', '/admin/groups/:groupId/messages', '/admin/groups/:groupId/messages/'], optionalAuth, (req, res) =>
  adminGroupController.clearMessages(req, res)
);
router.delete(['/api/admin/groups/:groupId/messages/:messageId', '/api/admin/groups/:groupId/messages/:messageId/', '/admin/groups/:groupId/messages/:messageId', '/admin/groups/:groupId/messages/:messageId/'], optionalAuth, (req, res) =>
  adminGroupController.deleteSingleMessage(req, res)
);

export default router;
