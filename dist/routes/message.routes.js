"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
// Full RESTful message endpoints
router.get(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) => message_controller_1.messageController.getMessages(req, res));
router.post(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) => message_controller_1.messageController.sendMessage(req, res));
router.get(['/api/messages/conversations', '/api/messages/conversations/', '/messages/conversations', '/messages/conversations/'], (req, res) => message_controller_1.messageController.getConversations(req, res));
router.post(['/api/messages/status', '/api/messages/status/', '/messages/status', '/messages/status/'], (req, res) => message_controller_1.messageController.updateStatus(req, res));
router.delete(['/api/messages', '/api/messages/', '/messages', '/messages/'], (req, res) => message_controller_1.messageController.deleteConversation(req, res));
router.patch(['/api/messages/:messageId', '/api/messages/:messageId/', '/messages/:messageId', '/messages/:messageId/'], (req, res) => message_controller_1.messageController.editMessage(req, res));
router.delete(['/api/messages/:messageId', '/api/messages/:messageId/', '/messages/:messageId', '/messages/:messageId/'], (req, res) => message_controller_1.messageController.deleteSingleMessage(req, res));
router.post(['/api/messages/:messageId/unsend', '/api/messages/:messageId/unsend/', '/messages/:messageId/unsend', '/messages/:messageId/unsend/'], (req, res) => message_controller_1.messageController.unsendMessage(req, res));
router.post(['/api/messages/:messageId/delete', '/api/messages/:messageId/delete/', '/messages/:messageId/delete', '/messages/:messageId/delete/'], (req, res) => message_controller_1.messageController.deleteMessageForMe(req, res));
exports.default = router;
