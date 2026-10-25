import { Router } from 'express';
import healthRoutes from './health.routes';
import circleRoutes from './circle.routes';

const router = Router();

router.use(healthRoutes);
router.use(circleRoutes);

export default router;
