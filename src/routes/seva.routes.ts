import { Router } from 'express';
import { sevaController } from '../controllers/seva.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/api/seva/institutions', (req, res) => sevaController.getInstitutions(req, res));
router.get('/api/seva/institutions/:slug', (req, res) => sevaController.getInstitutionBySlug(req, res));
router.post('/api/seva/donate/create-order', optionalAuth, (req, res) => sevaController.createDonationOrder(req, res));
router.post('/api/seva/donate/verify', optionalAuth, (req, res) => sevaController.verifyDonation(req, res));
router.get('/api/seva/track/:trackingId', (req, res) => sevaController.trackDonation(req, res));

export default router;

