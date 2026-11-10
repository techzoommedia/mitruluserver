import { Router } from 'express';
import healthRoutes from './health.routes';
import circleRoutes from './circle.routes';
import messageRoutes from './message.routes';
import groupRoutes from './group.routes';
import postRoutes from './post.routes';
import userRoutes from './user.routes';
import storyRoutes from './story.routes';
import nowRoutes from './now.routes';
import notificationRoutes from './notification.routes';
import sevaRoutes from './seva.routes';
import walletRoutes from './wallet.routes';
import livekitRoutes from './livekit.routes';
import reportRoutes from './report.routes';
import uploadRoutes from './upload.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use(healthRoutes);
router.use(circleRoutes);
router.use(messageRoutes);
router.use(groupRoutes);
router.use(postRoutes);
router.use(userRoutes);
router.use(storyRoutes);
router.use(nowRoutes);
router.use(notificationRoutes);
router.use(sevaRoutes);
router.use(walletRoutes);
router.use(livekitRoutes);
router.use(reportRoutes);
router.use(uploadRoutes);
router.use(adminRoutes);

export default router;
