import { Router } from 'express';
import { groupMessageController } from '../controllers/group-message.controller';

const router = Router();

router.get('/api/groups', (req, res) => groupMessageController.getGroups(req, res));
router.get('/api/groups/:groupId/messages', (req, res) => groupMessageController.getMessages(req, res));
router.post('/api/groups/:groupId/messages', (req, res) => groupMessageController.sendMessage(req, res));

export default router;

