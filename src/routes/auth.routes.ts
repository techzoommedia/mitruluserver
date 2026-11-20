import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get(['/api/auth/me', '/api/auth/me/', '/auth/me', '/auth/me/'], optionalAuth, (req, res) =>
  authController.getMe(req, res)
);

router.post(['/api/auth/send-otp', '/api/auth/send-otp/', '/auth/send-otp', '/auth/send-otp/'], (req, res) =>
  authController.sendOtp(req, res)
);

router.post(['/api/auth/verify-otp', '/api/auth/verify-otp/', '/auth/verify-otp', '/auth/verify-otp/'], (req, res) =>
  authController.verifyOtp(req, res)
);

export default router;
