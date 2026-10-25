"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin || env_1.ALLOWED_ORIGINS.includes(origin) || env_1.ALLOWED_ORIGINS.includes('*')) {
                callback(null, true);
            }
            else {
                callback(null, true); // Permissive for local development & pairing
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-mitrulu-client', 'x-mitrulu-encrypt', 'Accept'],
    }));
    app.use(express_1.default.json());
    // Mount API & health routes
    app.use(routes_1.default);
    return app;
}
exports.default = createApp;
