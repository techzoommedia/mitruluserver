"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongoDBWithRetry = connectMongoDBWithRetry;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
async function connectMongoDBWithRetry(onConnected) {
    while (true) {
        try {
            console.log('[Mitrulu Server] Connecting to MongoDB...');
            await mongoose_1.default.connect(env_1.MONGO_URI);
            console.log('[Mitrulu Server] MongoDB Connected successfully.');
            if (onConnected) {
                await onConnected();
            }
            break;
        }
        catch (err) {
            console.warn('[Mitrulu Server] MongoDB connection failed, retrying in 3s...', err.message);
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}
