"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => health_controller_1.healthController.getHealth(req, res));
exports.default = router;
