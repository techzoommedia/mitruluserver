import { Router } from 'express';
import { messageController } from '../controllers/message.controller';

const router = Router();

// Full RESTful message endpoints
router.get(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) =>
  messageController.getMessages(req, res)
);
router.post(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) =>
  messageController.sendMessage(req, res)
);
router.get(['/api/messages/conversations', '/api/messages/conversations/', '/messages/conversations', '/messages/conversations/'], (req, res) =>
  messageController.getConversations(req, res)
);
router.post(['/api/messages/status', '/api/messages/status/', '/messages/status', '/messages/status/'], (req, res) =>
  messageController.updateStatus(req, res)
);
router.delete(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) =>
  messageController.deleteConversation(req, res)
);
router.patch(['/api/messages/:messageId', '/api/messages/:messageId/', '/messages/:messageId', '/messages/:messageId/'], (req, res) =>
  messageController.editMessage(req, res)
);
router.delete(['/api/messages/:messageId', '/api/messages/:messageId/', '/messages/:messageId', '/messages/:messageId/'], (req, res) =>
  messageController.deleteSingleMessage(req, res)
);
router.post(['/api/messages/:messageId/unsend', '/api/messages/:messageId/unsend/', '/messages/:messageId/unsend', '/messages/:messageId/unsend/'], (req, res) =>
  messageController.unsendMessage(req, res)
);
router.post(['/api/messages/:messageId/delete', '/api/messages/:messageId/delete/', '/messages/:messageId/delete', '/messages/:messageId/delete/'], (req, res) =>
  messageController.deleteMessageForMe(req, res)
);

export default router;
