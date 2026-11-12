"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_controller_1 = require("../controllers/upload.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post(['/api/upload/sign', '/api/upload/sign/', '/upload/sign', '/upload/sign/'], auth_middleware_1.optionalAuth, (req, res) => upload_controller_1.uploadController.signUpload(req, res));
router.post(['/api/upload/process', '/api/upload/process/', '/upload/process', '/upload/process/'], auth_middleware_1.optionalAuth, (req, res) => upload_controller_1.uploadController.processUpload(req, res));
exports.default = router;
