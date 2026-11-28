"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const admin_group_controller_1 = require("../controllers/admin-group.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Admin Session & Authentication ──────────────────────────────────────────
router.get(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.checkAuth(req, res));
router.post(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.login(req, res));
router.delete(['/api/admin/auth', '/api/admin/auth/', '/admin/auth', '/admin/auth/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.logout(req, res));
// ── Overview & Statistics ───────────────────────────────────────────────────
router.get(['/api/admin/stats', '/api/admin/stats/', '/admin/stats', '/admin/stats/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getStats(req, res));
// ── User Management & Coins ─────────────────────────────────────────────────
router.get(['/api/admin/users', '/api/admin/users/', '/admin/users', '/admin/users/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getUsers(req, res));
router.patch(['/api/admin/users', '/api/admin/users/', '/admin/users', '/admin/users/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.updateUser(req, res));
router.get(['/api/admin/users/history', '/api/admin/users/history/', '/admin/users/history', '/admin/users/history/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getUserCoinHistory(req, res));
// ── Posts & Content Management ──────────────────────────────────────────────
router.get(['/api/admin/posts', '/api/admin/posts/', '/admin/posts', '/admin/posts/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getPosts(req, res));
router.delete(['/api/admin/posts', '/api/admin/posts/', '/admin/posts', '/admin/posts/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.deletePost(req, res));
// ── Moderation & Safety Reports ─────────────────────────────────────────────
router.get(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getModerationQueue(req, res));
router.post(['/api/admin/moderation', '/api/admin/moderation/', '/admin/moderation', '/admin/moderation/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.resolveReport(req, res));
// ── Payouts & Creator Earnings ──────────────────────────────────────────────
router.get(['/api/admin/payouts', '/api/admin/payouts/', '/admin/payouts', '/admin/payouts/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getPayouts(req, res));
router.patch(['/api/admin/payouts', '/api/admin/payouts/', '/admin/payouts', '/admin/payouts/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.updatePayout(req, res));
// ── Algorithm Configuration ─────────────────────────────────────────────────
router.get(['/api/admin/algorithm', '/api/admin/algorithm/', '/admin/algorithm', '/admin/algorithm/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getAlgorithm(req, res));
router.post(['/api/admin/algorithm', '/api/admin/algorithm/', '/admin/algorithm', '/admin/algorithm/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.saveAlgorithm(req, res));
// ── Telemetry & System Health Logs ──────────────────────────────────────────
router.get(['/api/admin/logs', '/api/admin/logs/', '/admin/logs', '/admin/logs/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.getLogs(req, res));
router.post(['/api/admin/logs', '/api/admin/logs/', '/admin/logs', '/admin/logs/'], auth_middleware_1.optionalAuth, (req, res) => admin_controller_1.adminController.actionLogs(req, res));
// ── Chat Groups Management ──────────────────────────────────────────────────
router.get(['/api/admin/groups', '/api/admin/groups/', '/admin/groups', '/admin/groups/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.getGroups(req, res));
router.post(['/api/admin/groups', '/api/admin/groups/', '/admin/groups', '/admin/groups/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.createGroup(req, res));
router.patch(['/api/admin/groups/:groupId', '/api/admin/groups/:groupId/', '/admin/groups/:groupId', '/admin/groups/:groupId/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.updateGroup(req, res));
router.post(['/api/admin/groups/:groupId/admins', '/api/admin/groups/:groupId/admins/', '/admin/groups/:groupId/admins', '/admin/groups/:groupId/admins/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.promoteAdmin(req, res));
router.delete(['/api/admin/groups/:groupId/admins/:userId', '/api/admin/groups/:groupId/admins/:userId/', '/admin/groups/:groupId/admins/:userId', '/admin/groups/:groupId/admins/:userId/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.removeAdmin(req, res));
router.patch(['/api/admin/groups/:groupId/hold', '/api/admin/groups/:groupId/hold/', '/admin/groups/:groupId/hold', '/admin/groups/:groupId/hold/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.toggleHold(req, res));
router.delete(['/api/admin/groups/:groupId', '/api/admin/groups/:groupId/', '/admin/groups/:groupId', '/admin/groups/:groupId/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.deleteGroup(req, res));
router.get(['/api/admin/groups/:groupId/messages', '/api/admin/groups/:groupId/messages/', '/admin/groups/:groupId/messages', '/admin/groups/:groupId/messages/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.getGroupMessages(req, res));
router.delete(['/api/admin/groups/:groupId/messages', '/api/admin/groups/:groupId/messages/', '/admin/groups/:groupId/messages', '/admin/groups/:groupId/messages/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.clearMessages(req, res));
router.delete(['/api/admin/groups/:groupId/messages/:messageId', '/api/admin/groups/:groupId/messages/:messageId/', '/admin/groups/:groupId/messages/:messageId', '/admin/groups/:groupId/messages/:messageId/'], auth_middleware_1.optionalAuth, (req, res) => admin_group_controller_1.adminGroupController.deleteSingleMessage(req, res));
exports.default = router;
