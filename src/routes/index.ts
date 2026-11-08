import { Router } from 'express';
import healthRoutes from './health.routes';
import circleRoutes from './circle.routes';
import messageRoutes from './message.routes';
import groupRoutes from './group.routes';

const router = Router();

router.use(healthRoutes);
router.use(circleRoutes);
router.use(messageRoutes);
router.use(groupRoutes);

export default router;
