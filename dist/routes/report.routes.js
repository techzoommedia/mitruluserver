"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post(['/api/reports', '/api/reports/', '/reports', '/reports/'], auth_middleware_1.optionalAuth, (req, res) => report_controller_1.reportController.createReport(req, res));
router.get(['/api/reports', '/api/reports/', '/reports', '/reports/'], auth_middleware_1.optionalAuth, (req, res) => report_controller_1.reportController.getReports(req, res));
exports.default = router;
