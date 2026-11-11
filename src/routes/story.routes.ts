import { Router } from 'express';
import { storyController } from '../controllers/story.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get(['/api/stories', '/api/stories/', '/stories', '/stories/'], optionalAuth, (req, res) =>
  storyController.getStories(req, res)
);
router.post(['/api/stories', '/api/stories/', '/stories', '/stories/'], requireAuth, (req, res) =>
  storyController.createStory(req, res)
);

export default router;
