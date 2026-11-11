import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post(['/api/reports', '/api/reports/', '/reports', '/reports/'], optionalAuth, (req, res) =>
  reportController.createReport(req, res)
);
router.get(['/api/reports', '/api/reports/', '/reports', '/reports/'], optionalAuth, (req, res) =>
  reportController.getReports(req, res)
);

export default router;
