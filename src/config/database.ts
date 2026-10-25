import mongoose from 'mongoose';
import { MONGO_URI } from './env';

export async function connectMongoDBWithRetry(onConnected?: () => Promise<void>): Promise<void> {
  while (true) {
    try {
      console.log('[Mitrulu Server] Connecting to MongoDB...');
      await mongoose.connect(MONGO_URI);
      console.log('[Mitrulu Server] MongoDB Connected successfully.');

      if (onConnected) {
        await onConnected();
      }
      break;
    } catch (err: any) {
      console.warn('[Mitrulu Server] MongoDB connection failed, retrying in 3s...', err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
