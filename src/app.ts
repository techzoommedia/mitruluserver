import express from 'express';
import cors from 'cors';
import { ALLOWED_ORIGINS } from './config/env';
import routes from './routes';

export function createApp(): express.Application {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive for local development & pairing
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-mitrulu-client', 'x-mitrulu-encrypt', 'Accept'],
    })
  );

  app.use(express.json());

  // Mount API & health routes
  app.use(routes);

  return app;
}

export default createApp;
