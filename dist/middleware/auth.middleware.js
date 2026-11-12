"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = optionalAuth;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                req.user = decoded;
                req.userId = String(decoded.userId || decoded.id || decoded._id || '');
            }
            catch {
                // invalid token, treat as guest
            }
        }
        if (!req.userId && req.headers['x-mitrulu-userid']) {
            req.userId = String(req.headers['x-mitrulu-userid']).trim();
        }
        next();
    }
    catch (err) {
        next();
    }
}
function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
                req.user = decoded;
                req.userId = String(decoded.userId || decoded.id || decoded._id || '');
                return next();
            }
            catch {
                res.status(401).json({ error: 'సెషన్ ముగిసింది (Invalid or expired token)' });
                return;
            }
        }
        if (req.headers['x-mitrulu-userid']) {
            req.userId = String(req.headers['x-mitrulu-userid']).trim();
            return next();
        }
        res.status(401).json({ error: 'దయచేసి లాగిన్ అవ్వండి (Authentication required)' });
    }
    catch (err) {
        res.status(401).json({ error: 'ధృవీకరణ విఫలమైంది (Authentication failed)' });
    }
}
