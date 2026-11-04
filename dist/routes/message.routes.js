"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
// Full RESTful message endpoints
router.get('/api/messages', (req, res) => message_controller_1.messageController.getMessages(req, res));
router.post('/api/messages', (req, res) => message_controller_1.messageController.sendMessage(req, res));
router.get('/api/messages/conversations', (req, res) => message_controller_1.messageController.getConversations(req, res));
router.post('/api/messages/status', (req, res) => message_controller_1.messageController.updateStatus(req, res));
router.delete('/api/messages', (req, res) => message_controller_1.messageController.deleteConversation(req, res));
exports.default = router;
