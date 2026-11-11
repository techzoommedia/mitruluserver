import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post(['/api/wallet/create-order', '/api/wallet/create-order/', '/wallet/create-order', '/wallet/create-order/'], requireAuth, (req, res) =>
  walletController.createOrder(req, res)
);
router.post(['/api/wallet/verify-payment', '/api/wallet/verify-payment/', '/wallet/verify-payment', '/wallet/verify-payment/'], requireAuth, (req, res) =>
  walletController.verifyPayment(req, res)
);
router.post(['/api/wallet/payout', '/api/wallet/payout/', '/wallet/payout', '/wallet/payout/'], requireAuth, (req, res) =>
  walletController.requestPayout(req, res)
);

export default router;
