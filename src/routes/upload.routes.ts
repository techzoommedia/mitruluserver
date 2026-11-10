import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/api/upload/sign', optionalAuth, (req, res) => uploadController.signUpload(req, res));
router.post('/api/upload/process', optionalAuth, (req, res) => uploadController.processUpload(req, res));

export default router;

