import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/api/notifications', requireAuth, (req, res) => notificationController.getNotifications(req, res));
router.post('/api/notifications', requireAuth, (req, res) => notificationController.markAsRead(req, res));
router.post('/api/notifications/fcm-token', requireAuth, (req, res) => notificationController.saveFcmToken(req, res));
router.post('/api/notifications/dispatch-dm', requireAuth, (req, res) => notificationController.dispatchDmPush(req, res));

export default router;

