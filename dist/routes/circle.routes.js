"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const circle_controller_1 = require("../controllers/circle.controller");
const router = (0, express_1.Router)();
// Public Circle routes
router.get('/api/circle/users', (req, res) => circle_controller_1.circleController.getActiveUsers(req, res));
router.get('/api/circle/community/rooms', (req, res) => circle_controller_1.circleController.getCommunityRooms(req, res));
router.post('/api/circle/community/rooms', (req, res) => circle_controller_1.circleController.joinCommunityRoom(req, res));
router.get('/api/circle/community/room-actions', (req, res) => circle_controller_1.circleController.getRoomActions(req, res));
router.post('/api/circle/community/room-actions', (req, res) => circle_controller_1.circleController.postRoomActions(req, res));
router.post('/api/circle/active-status', (req, res) => circle_controller_1.circleController.updateActiveStatus(req, res));
// Internal Next.js <-> Server notification routes
router.post('/api/internal/circle/sync-active', (req, res) => circle_controller_1.circleController.syncActive(req, res));
router.post('/api/internal/circle/notify-incoming-call', (req, res) => circle_controller_1.circleController.notifyIncomingCall(req, res));
router.post('/api/internal/circle/notify-call-response', (req, res) => circle_controller_1.circleController.notifyCallResponse(req, res));
router.post('/api/internal/circle/notify-call-end', (req, res) => circle_controller_1.circleController.notifyCallEnd(req, res));
router.post('/api/internal/circle/notify-rooms-changed', (req, res) => circle_controller_1.circleController.notifyRoomsChanged(req, res));
router.post('/api/internal/circle/notify-room-action', (req, res) => circle_controller_1.circleController.notifyRoomAction(req, res));
exports.default = router;
