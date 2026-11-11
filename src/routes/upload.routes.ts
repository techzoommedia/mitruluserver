import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post(['/api/upload/sign', '/api/upload/sign/', '/upload/sign', '/upload/sign/'], optionalAuth, (req, res) =>
  uploadController.signUpload(req, res)
);
router.post(['/api/upload/process', '/api/upload/process/', '/upload/process', '/upload/process/'], optionalAuth, (req, res) =>
  uploadController.processUpload(req, res)
);

export default router;
