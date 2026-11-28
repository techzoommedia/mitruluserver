"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAuthToken = extractAuthToken;
exports.verifyAuthToken = verifyAuthToken;
exports.optionalAuth = optionalAuth;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
/** Extract JWT from Authorization Bearer header or mitrulu_token cookie. */
function extractAuthToken(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (bearerToken)
        return bearerToken;
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)mitrulu_token=([^;]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
    }
    return null;
}
/** Verify HS256 JWT and return decoded payload, or null when invalid/expired. */
function verifyAuthToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET, { algorithms: ['HS256'] });
    }
    catch {
        return null;
    }
}
function optionalAuth(req, res, next) {
    try {
        const token = extractAuthToken(req);
        if (token) {
            const decoded = verifyAuthToken(token);
            if (decoded) {
                req.user = decoded;
                req.userId = String(decoded.userId || decoded.id || decoded._id || '');
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
        const token = extractAuthToken(req);
        if (token) {
            const decoded = verifyAuthToken(token);
            if (decoded) {
                req.user = decoded;
                req.userId = String(decoded.userId || decoded.id || decoded._id || '');
                return next();
            }
            res.status(401).json({ error: 'సెషన్ ముగిసింది (Invalid or expired token)' });
            return;
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
