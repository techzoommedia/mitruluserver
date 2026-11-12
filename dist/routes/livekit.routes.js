"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const livekit_controller_1 = require("../controllers/livekit.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post(['/api/livekit/token', '/api/livekit/token/', '/livekit/token', '/livekit/token/'], auth_middleware_1.optionalAuth, (req, res) => livekit_controller_1.livekitController.getToken(req, res));
exports.default = router;
