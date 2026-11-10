import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Feed & clips
router.get('/api/posts', optionalAuth, (req, res) => postController.getPosts(req, res));
router.get('/api/clips', optionalAuth, (req, res) => {
  req.query.type = 'video';
  return postController.getPosts(req, res);
});
router.post('/api/posts', requireAuth, (req, res) => postController.createPost(req, res));
router.post('/api/posts/seen', requireAuth, (req, res) => postController.markSeen(req, res));

// Single post operations
router.get('/api/posts/:id', optionalAuth, (req, res) => postController.getPostById(req, res));
router.post('/api/posts/:id/like', requireAuth, (req, res) => postController.toggleLike(req, res));
router.post('/api/posts/:id/comment', requireAuth, (req, res) => postController.addComment(req, res));
router.post('/api/posts/:id/save', requireAuth, (req, res) => postController.toggleSave(req, res));
router.post('/api/posts/:id/unlock', requireAuth, (req, res) => postController.unlockPost(req, res));

export default router;

