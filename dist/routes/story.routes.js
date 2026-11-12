"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const story_controller_1 = require("../controllers/story.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get(['/api/stories', '/api/stories/', '/stories', '/stories/'], auth_middleware_1.optionalAuth, (req, res) => story_controller_1.storyController.getStories(req, res));
router.post(['/api/stories', '/api/stories/', '/stories', '/stories/'], auth_middleware_1.requireAuth, (req, res) => story_controller_1.storyController.createStory(req, res));
exports.default = router;
