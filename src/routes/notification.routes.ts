import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// GET notifications - supports both /api/notifications and /notifications with or without trailing slash
router.get(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], requireAuth, (req, res) =>
  notificationController.getNotifications(req, res)
);

// Mark as read - supports POST, PUT, and PATCH with or without trailing slash
router.post(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], requireAuth, (req, res) =>
  notificationController.markAsRead(req, res)
);
router.put(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], requireAuth, (req, res) =>
  notificationController.markAsRead(req, res)
);
router.patch(['/api/notifications', '/api/notifications/', '/notifications', '/notifications/'], requireAuth, (req, res) =>
  notificationController.markAsRead(req, res)
);

// FCM Web Push Token registration
router.post(['/api/notifications/fcm-token', '/api/notifications/fcm-token/', '/notifications/fcm-token', '/notifications/fcm-token/'], requireAuth, (req, res) =>
  notificationController.saveFcmToken(req, res)
);

// Direct message push dispatch
router.post(['/api/notifications/dispatch-dm', '/api/notifications/dispatch-dm/', '/notifications/dispatch-dm', '/notifications/dispatch-dm/'], requireAuth, (req, res) =>
  notificationController.dispatchDmPush(req, res)
);

export default router;

