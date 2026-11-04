import { Router } from 'express';
import { messageController } from '../controllers/message.controller';

const router = Router();

// Full RESTful message endpoints
router.get('/api/messages', (req, res) => messageController.getMessages(req, res));
router.post('/api/messages', (req, res) => messageController.sendMessage(req, res));
router.get('/api/messages/conversations', (req, res) => messageController.getConversations(req, res));
router.post('/api/messages/status', (req, res) => messageController.updateStatus(req, res));
router.delete('/api/messages', (req, res) => messageController.deleteConversation(req, res));

export default router;

