import { Router } from 'express';
import { circleController } from '../controllers/circle.controller';
import { socketManager } from '../sockets/socket.manager';

const router = Router();

// Public Circle routes
router.get('/api/circle/online-users', (req, res) => {
  res.json({
    success: true,
    onlineUserIds: socketManager.getOnlineUserIds(),
    count: socketManager.getOnlineUsersCount(),
  });
});
router.get('/api/circle/users', (req, res) => circleController.getActiveUsers(req, res));
router.get('/api/circle/community/rooms', (req, res) => circleController.getCommunityRooms(req, res));
router.post('/api/circle/community/rooms', (req, res) => circleController.joinCommunityRoom(req, res));
router.get('/api/circle/community/room-actions', (req, res) => circleController.getRoomActions(req, res));
router.post('/api/circle/community/room-actions', (req, res) => circleController.postRoomActions(req, res));
router.post('/api/circle/active-status', (req, res) => circleController.updateActiveStatus(req, res));

// Internal Next.js <-> Server notification routes
router.post('/api/internal/circle/sync-active', (req, res) => circleController.syncActive(req, res));
router.post('/api/internal/circle/notify-incoming-call', (req, res) => circleController.notifyIncomingCall(req, res));
router.post('/api/internal/circle/notify-call-response', (req, res) => circleController.notifyCallResponse(req, res));
router.post('/api/internal/circle/notify-call-end', (req, res) => circleController.notifyCallEnd(req, res));
router.post('/api/internal/circle/notify-rooms-changed', (req, res) => circleController.notifyRoomsChanged(req, res));
router.post('/api/internal/circle/notify-room-action', (req, res) => circleController.notifyRoomAction(req, res));

export default router;
