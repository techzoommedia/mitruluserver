"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const post_controller_1 = require("../controllers/post.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Feed & clips
router.get(['/api/posts', '/api/posts/', '/posts', '/posts/'], auth_middleware_1.optionalAuth, (req, res) => post_controller_1.postController.getPosts(req, res));
router.get(['/api/clips', '/api/clips/', '/clips', '/clips/'], auth_middleware_1.optionalAuth, (req, res) => {
    req.query.type = 'video';
    return post_controller_1.postController.getPosts(req, res);
});
router.post(['/api/posts', '/api/posts/', '/posts', '/posts/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.createPost(req, res));
router.post(['/api/posts/seen', '/api/posts/seen/', '/posts/seen', '/posts/seen/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.markSeen(req, res));
// Single post operations
router.get(['/api/posts/:id', '/api/posts/:id/', '/posts/:id', '/posts/:id/'], auth_middleware_1.optionalAuth, (req, res) => post_controller_1.postController.getPostById(req, res));
router.post(['/api/posts/:id/like', '/api/posts/:id/like/', '/posts/:id/like', '/posts/:id/like/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.toggleLike(req, res));
router.post(['/api/posts/:id/comment', '/api/posts/:id/comment/', '/posts/:id/comment', '/posts/:id/comment/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.addComment(req, res));
router.post(['/api/posts/:id/save', '/api/posts/:id/save/', '/posts/:id/save', '/posts/:id/save/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.toggleSave(req, res));
router.post(['/api/posts/:id/unlock', '/api/posts/:id/unlock/', '/posts/:id/unlock', '/posts/:id/unlock/'], auth_middleware_1.requireAuth, (req, res) => post_controller_1.postController.unlockPost(req, res));
exports.default = router;
