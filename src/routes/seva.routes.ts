import { Router } from 'express';
import { sevaController } from '../controllers/seva.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get(['/api/seva/institutions', '/api/seva/institutions/', '/seva/institutions', '/seva/institutions/'], (req, res) =>
  sevaController.getInstitutions(req, res)
);
router.get(['/api/seva/institutions/:slug', '/api/seva/institutions/:slug/', '/seva/institutions/:slug', '/seva/institutions/:slug/'], (req, res) =>
  sevaController.getInstitutionBySlug(req, res)
);
router.post(['/api/seva/donate/create-order', '/api/seva/donate/create-order/', '/seva/donate/create-order', '/seva/donate/create-order/'], optionalAuth, (req, res) =>
  sevaController.createDonationOrder(req, res)
);
router.post(['/api/seva/donate/verify', '/api/seva/donate/verify/', '/seva/donate/verify', '/seva/donate/verify/'], optionalAuth, (req, res) =>
  sevaController.verifyDonation(req, res)
);
router.get(['/api/seva/track/:trackingId', '/api/seva/track/:trackingId/', '/seva/track/:trackingId', '/seva/track/:trackingId/'], (req, res) =>
  sevaController.trackDonation(req, res)
);

export default router;
