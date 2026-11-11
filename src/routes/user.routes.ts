import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get(['/api/users', '/api/users/', '/users', '/users/'], optionalAuth, (req, res) =>
  userController.getUsers(req, res)
);
router.get(['/api/users/profile', '/api/users/profile/', '/users/profile', '/users/profile/'], optionalAuth, (req, res) =>
  userController.getProfile(req, res)
);
router.post(['/api/users/profile', '/api/users/profile/', '/users/profile', '/users/profile/'], requireAuth, (req, res) =>
  userController.updateProfile(req, res)
);
router.post(['/api/users/follow', '/api/users/follow/', '/users/follow', '/users/follow/'], requireAuth, (req, res) =>
  userController.toggleFollow(req, res)
);
router.post(['/api/users/friend', '/api/users/friend/', '/users/friend', '/users/friend/'], requireAuth, (req, res) =>
  userController.toggleFriend(req, res)
);
router.get(['/api/users/block', '/api/users/block/', '/users/block', '/users/block/'], requireAuth, (req, res) =>
  userController.getBlocked(req, res)
);
router.post(['/api/users/block', '/api/users/block/', '/users/block', '/users/block/'], requireAuth, (req, res) =>
  userController.toggleBlock(req, res)
);
router.post(['/api/users/delete-account', '/api/users/delete-account/', '/users/delete-account', '/users/delete-account/'], requireAuth, (req, res) =>
  userController.deleteAccount(req, res)
);

export default router;
