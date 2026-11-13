"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
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
exports.default = router;
