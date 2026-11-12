import { Router } from 'express';
import { groupMessageController } from '../controllers/group-message.controller';

const router = Router();

router.get(['/api/groups', '/api/groups/', '/groups', '/groups/'], (req, res) =>
  groupMessageController.getGroups(req, res)
);
router.get(['/api/groups/:groupId/messages', '/api/groups/:groupId/messages/', '/groups/:groupId/messages', '/groups/:groupId/messages/'], (req, res) =>
  groupMessageController.getMessages(req, res)
);
router.post(['/api/groups/:groupId/messages', '/api/groups/:groupId/messages/', '/groups/:groupId/messages', '/groups/:groupId/messages/'], (req, res) =>
  groupMessageController.sendMessage(req, res)
);
router.patch(['/api/groups/:groupId/messages/:messageId', '/api/groups/:groupId/messages/:messageId/', '/groups/:groupId/messages/:messageId', '/groups/:groupId/messages/:messageId/'], (req, res) =>
  groupMessageController.editMessage(req, res)
);
router.delete(['/api/groups/:groupId/messages/:messageId', '/api/groups/:groupId/messages/:messageId/', '/groups/:groupId/messages/:messageId', '/groups/:groupId/messages/:messageId/'], (req, res) =>
  groupMessageController.deleteSingleMessage(req, res)
);
router.post(['/api/groups/:groupId/messages/:messageId/unsend', '/api/groups/:groupId/messages/:messageId/unsend/', '/groups/:groupId/messages/:messageId/unsend', '/groups/:groupId/messages/:messageId/unsend/'], (req, res) =>
  groupMessageController.unsendMessage(req, res)
);
router.post(['/api/groups/:groupId/messages/:messageId/delete', '/api/groups/:groupId/messages/:messageId/delete/', '/groups/:groupId/messages/:messageId/delete', '/groups/:groupId/messages/:messageId/delete/'], (req, res) =>
  groupMessageController.deleteMessageForMe(req, res)
);

export default router;
