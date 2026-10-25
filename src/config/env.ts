import 'dotenv/config';

export const PORT = Number(process.env.PORT) || 5001;

export const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://techzoommedia_db_user:1k6rMUI3yxcX4YTq@cluster0.mmlkjl0.mongodb.net/?appName=Cluster0';

export const JWT_SECRET =
  process.env.JWT_SECRET ||
  '8f7c2b9a1d5e4f3c6b8a9d2e5f7c1a4b9e2d5f8c1a4b7d0e3f6a9c2d5e8f1b';

export const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://mitrulu-5c5htvzx.livekit.cloud';
export const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APITymSKfzLomnf';
export const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '7fjW0sYBfs58nBRXM1eFvJsGKlcYDLCTbrVe80tiaKVA';
export const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

export const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://mitrulu.in,http://localhost:3001')
  .split(',')
  .map((o) => o.trim());
