"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ORIGINS = exports.LIVEKIT_HTTP_URL = exports.LIVEKIT_API_SECRET = exports.LIVEKIT_API_KEY = exports.LIVEKIT_URL = exports.JWT_SECRET = exports.MONGO_URI = exports.PORT = void 0;
require("dotenv/config");
exports.PORT = Number(process.env.PORT) || 5001;
exports.MONGO_URI = process.env.MONGO_URI ||
    'mongodb+srv://techzoommedia_db_user:1k6rMUI3yxcX4YTq@cluster0.mmlkjl0.mongodb.net/?appName=Cluster0';
exports.JWT_SECRET = process.env.JWT_SECRET ||
    '8f7c2b9a1d5e4f3c6b8a9d2e5f7c1a4b9e2d5f8c1a4b7d0e3f6a9c2d5e8f1b';
exports.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://mitrulu-5c5htvzx.livekit.cloud';
exports.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APITymSKfzLomnf';
exports.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '7fjW0sYBfs58nBRXM1eFvJsGKlcYDLCTbrVe80tiaKVA';
exports.LIVEKIT_HTTP_URL = exports.LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
exports.ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://mitrulu.in,http://localhost:3001')
    .split(',')
    .map((o) => o.trim());
