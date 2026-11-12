"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// GET notifications - supports both /api/notifications and /notifications with or without trailing slash
router.get(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.getNotifications(req, res));
// Mark as read - supports POST, PUT, and PATCH with or without trailing slash
router.post(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.markAsRead(req, res));
router.put(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.markAsRead(req, res));
router.patch(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.markAsRead(req, res));
// FCM Web Push Token registration
router.post(['/api/notifications/fcm-token', '/api/notifications/fcm-token/', '/notifications/fcm-token', '/notifications/fcm-token/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.saveFcmToken(req, res));
// Direct message push dispatch
router.post(['/api/notifications/dispatch-dm', '/api/notifications/dispatch-dm/', '/notifications/dispatch-dm', '/notifications/dispatch-dm/'], auth_middleware_1.requireAuth, (req, res) => notification_controller_1.notificationController.dispatchDmPush(req, res));
exports.default = router;
