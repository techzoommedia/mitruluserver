import { Router } from 'express';
import { livekitController } from '../controllers/livekit.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/api/livekit/token', optionalAuth, (req, res) => livekitController.getToken(req, res));

export default router;

