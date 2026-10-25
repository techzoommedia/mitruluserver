"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importStar(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI ||
    'mongodb+srv://techzoommedia_db_user:1k6rMUI3yxcX4YTq@cluster0.mmlkjl0.mongodb.net/?appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET ||
    '8f7c2b9a1d5e4f3c6b8a9d2e5f7c1a4b9e2d5f8c1a4b7d0e3f6a9c2d5e8f1b';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://mitrulu-5c5htvzx.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APITymSKfzLomnf';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '7fjW0sYBfs58nBRXM1eFvJsGKlcYDLCTbrVe80tiaKVA';
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    teluguName: { type: String, required: true },
    handle: { type: String, required: true },
    mitraId: { type: String },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    teluguBio: { type: String, default: '' },
    location: { type: String, default: 'హైదరాబాద్' },
    isVerified: { type: Boolean, default: false },
    gender: { type: String, default: 'prefer_not_to_say' },
    profession: { type: String, default: '' },
    callCategory: { type: String, default: 'casuals' },
    isCallActive: { type: Boolean, default: false },
    callActiveAt: { type: Date, default: null },
    callLanguage: { type: String, default: 'తెలుగు (Telugu)' },
    callRating: { type: Number, default: 5.0 },
    callRatingCount: { type: Number, default: 0 },
    callRateCoins: { type: Number, default: 500 },
    coins: { type: Number, default: 0 },
    earnedCoins: { type: Number, default: 0 },
}, { collection: 'users', timestamps: true });
const User = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema);
const CallSessionSchema = new mongoose_1.Schema({
    callId: { type: String, required: true, unique: true, index: true },
    roomName: { type: String, required: true, index: true },
    callerId: { type: String, required: true, index: true },
    callerName: { type: String, required: true },
    callerTeluguName: { type: String },
    callerHandle: { type: String, required: true },
    callerAvatar: { type: String, default: '' },
    targetUserId: { type: String, required: true, index: true },
    targetUserName: { type: String },
    targetUserTeluguName: { type: String },
    targetUserAvatar: { type: String },
    callType: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: {
        type: String,
        enum: ['ringing', 'accepted', 'declined', 'ended', 'timeout'],
        default: 'ringing',
        index: true,
    },
    durationSeconds: { type: Number, default: 0 },
    endedAt: { type: Date },
}, { collection: 'callsessions', timestamps: true });
const CallSession = mongoose_1.default.models.CallSession ||
    mongoose_1.default.model('CallSession', CallSessionSchema);
const CommunityRoomSchema = new mongoose_1.Schema({
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    teluguTitle: { type: String, required: true },
    language: { type: String, default: 'Telugu' },
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    topic: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isStopped: { type: Boolean, default: false },
    stoppedReason: { type: String, default: '' },
    admins: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    maxParticipants: { type: Number, default: 50 },
    costCoins: { type: Number, default: 0 },
}, { collection: 'communityrooms', timestamps: true });
const CommunityRoom = mongoose_1.default.models.CommunityRoom ||
    mongoose_1.default.model('CommunityRoom', CommunityRoomSchema);
// ─────────────────────────────────────────────────────────────
// 2. EXPRESS & HTTP SETUP
// ─────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://mitrulu.in,http://localhost:3001')
    .split(',')
    .map((o) => o.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        }
        else {
            callback(null, true); // Permissive for pairing during development
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// ─────────────────────────────────────────────────────────────
// 3. SOCKET.IO REAL-TIME SIGNALING SERVER
// ─────────────────────────────────────────────────────────────
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (reqOrigin, callback) => {
            // Dynamic origin reflection allows credentials: true without wildcard failure
            callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
});
// Map of userId -> Set of socket IDs (to support multiple tabs / devices per user)
const userSocketsMap = new Map();
// Map of callId -> timeout timer for 60s auto-cancel
const callTimeoutsMap = new Map();
const activeUsersCache = new Map();
let cachedCommunityRooms = [];
function getCachedActiveUsersList() {
    return Array.from(activeUsersCache.values()).sort((a, b) => (b.callActiveAt || 0) - (a.callActiveAt || 0) || b.callRating - a.callRating);
}
function broadcastActiveUsersInstant() {
    const users = getCachedActiveUsersList();
    console.log(`[CircleSocket] Broadcasting ${users.length} active users to all ${io.sockets.sockets.size} connected sockets`);
    io.emit('circle:users_updated', { users });
}
// LiveKit Cloud Room Client
const roomService = new livekit_server_sdk_1.RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
/**
 * Helper: Query LiveKit Cloud for real-time room participant counts
 * Guaranteed never to hang (2.5s maximum timeout)
 */
async function getLiveKitRoomCounts() {
    const counts = new Map();
    try {
        const listPromise = roomService.listRooms();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit timeout')), 2500));
        const rooms = await Promise.race([listPromise, timeoutPromise]);
        for (const room of rooms) {
            counts.set(room.name, room.numParticipants);
        }
    }
    catch (err) {
        // Silently continue with empty counts without blocking the server
    }
    return counts;
}
/**
 * Helper: Synchronize active callers from MongoDB into in-memory cache
 */
async function syncActiveUsersFromDB() {
    try {
        const users = await User.find({ isCallActive: true })
            .select('name teluguName handle mitraId avatar bio teluguBio location isVerified gender profession callCategory isCallActive callLanguage callRating callRatingCount callRateCoins coins earnedCoins callActiveAt')
            .sort({ callActiveAt: -1, callRating: -1 })
            .lean();
        activeUsersCache.clear();
        for (const u of users) {
            const id = u._id.toString();
            activeUsersCache.set(id, {
                id,
                _id: id,
                name: u.name,
                teluguName: u.teluguName || u.name,
                handle: u.mitraId || u.handle,
                mitraId: u.mitraId || u.handle,
                avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
                bio: u.bio || '',
                teluguBio: u.teluguBio || '',
                location: u.location || 'హైదరాబాద్, తెలంగాణ',
                isVerified: Boolean(u.isVerified),
                gender: u.gender || 'prefer_not_to_say',
                profession: u.profession || 'కమ్యూనిటీ మిత్రులు',
                callCategory: u.callCategory || 'casuals',
                isCallActive: true,
                callLanguage: u.callLanguage || 'తెలుగు (Telugu)',
                callRating: u.callRating ?? 5.0,
                callRatingCount: u.callRatingCount ?? 0,
                callRateCoins: u.callRateCoins ?? 500,
                isOnline: true,
                callActiveAt: u.callActiveAt ? new Date(u.callActiveAt).getTime() : Date.now(),
            });
        }
    }
    catch (err) {
        console.warn('[syncActiveUsersFromDB Error]:', err);
    }
}
/**
 * Helper: Fetch all active callers (cache-first for speed, DB fallback)
 */
async function fetchActiveCircleUsers() {
    if (activeUsersCache.size === 0) {
        await syncActiveUsersFromDB();
    }
    return getCachedActiveUsersList();
}
/**
 * Helper: Fetch community rooms with live LiveKit Cloud participant counts
 */
async function fetchCommunityRoomsWithCounts() {
    try {
        const [dbRooms, livekitCounts] = await Promise.all([
            CommunityRoom.find().sort({ createdAt: 1 }).lean(),
            getLiveKitRoomCounts(),
        ]);
        const mappedRooms = dbRooms.map((r) => {
            const rId = r.roomId || r.id;
            const dbId = r._id ? r._id.toString() : '';
            const liveCount = Math.max((dbId ? livekitCounts.get(`circle_comm_${dbId}`) : 0) || 0, (rId ? livekitCounts.get(`circle_comm_${rId}`) : 0) || 0, (rId ? livekitCounts.get(rId) : 0) || 0, (dbId ? livekitCounts.get(dbId) : 0) || 0, 0);
            return {
                id: rId,
                roomId: rId,
                name: r.name,
                teluguTitle: r.teluguTitle,
                language: r.language || 'Telugu',
                type: r.type || 'audio',
                topic: r.topic || '',
                avatar: r.avatar,
                isStopped: Boolean(r.isStopped),
                stoppedReason: r.stoppedReason || '',
                admins: r.admins || [],
                activeParticipants: liveCount,
                maxParticipants: r.maxParticipants || 50,
                costCoins: r.costCoins || 0,
                tags: r.tags || [],
            };
        });
        if (mappedRooms.length > 0) {
            cachedCommunityRooms = mappedRooms;
        }
        return mappedRooms;
    }
    catch (err) {
        console.warn('[fetchCommunityRoomsWithCounts Error]:', err);
        return cachedCommunityRooms;
    }
}
/**
 * Broadcast active callers list to all connected clients
 */
async function broadcastActiveUsers() {
    broadcastActiveUsersInstant();
}
/**
 * Broadcast community rooms list to all connected clients
 */
async function broadcastCommunityRooms() {
    try {
        const rooms = await fetchCommunityRoomsWithCounts();
        io.emit('circle:rooms_updated', { rooms });
    }
    catch (err) {
        console.error('[broadcastCommunityRooms] Error:', err);
    }
}
// ─────────────────────────────────────────────────────────────
// 4. SOCKET.IO AUTH & EVENT HANDLERS
// ─────────────────────────────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
            ? socket.handshake.headers.authorization.slice(7)
            : null);
    const authUserId = socket.handshake.auth?.userId;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            socket.data.userId = decoded.userId || decoded.id;
            socket.data.user = decoded;
        }
        catch (e) {
            if (authUserId) {
                socket.data.userId = authUserId;
            }
        }
    }
    else if (authUserId) {
        socket.data.userId = authUserId;
    }
    // Allow guests to connect in view mode; actions requiring auth check socket.data.userId
    next();
});
io.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (userId) {
        // Join user's personal room for direct 1-on-1 signaling
        const userRoom = `user_${userId}`;
        socket.join(userRoom);
        if (!userSocketsMap.has(userId)) {
            userSocketsMap.set(userId, new Set());
        }
        userSocketsMap.get(userId).add(socket.id);
        // Send user's own current active status from DB asynchronously (never blocks socket setup)
        User.findById(userId)
            .select('isCallActive gender profession callLanguage')
            .lean()
            .then((dbUser) => {
            if (dbUser) {
                socket.emit('circle:my_status_init', {
                    isCallActive: Boolean(dbUser.isCallActive),
                    gender: dbUser.gender,
                    profession: dbUser.profession,
                    callLanguage: dbUser.callLanguage,
                });
            }
        })
            .catch(() => { });
    }
    // 1. EMIT INSTANT INITIAL DATA FROM CACHE (0ms DELAY)
    socket.emit('circle:users_updated', { users: getCachedActiveUsersList() });
    socket.emit('circle:rooms_updated', { rooms: cachedCommunityRooms });
    // 2. Refresh cache asynchronously in background if cold
    if (activeUsersCache.size === 0) {
        syncActiveUsersFromDB()
            .then(() => {
            socket.emit('circle:users_updated', { users: getCachedActiveUsersList() });
        })
            .catch(() => { });
    }
    if (cachedCommunityRooms.length === 0) {
        fetchCommunityRoomsWithCounts()
            .then((rooms) => {
            socket.emit('circle:rooms_updated', { rooms });
        })
            .catch(() => { });
    }
    // ── A. Toggle "Take Calls" (Online/Offline Status) ───────────
    socket.on('circle:toggle_active', async (data, callback) => {
        const uid = socket.data.userId || data?.userId || data?.user?.id;
        if (!uid) {
            console.warn('[circle:toggle_active] Unauthorized: no userId found');
            return callback?.({ success: false, error: 'Unauthorized: missing user identifier' });
        }
        try {
            const { isCallActive, gender, profession, callLanguage, callCategory, user } = data || {};
            const activeState = Boolean(isCallActive);
            if (activeState) {
                // User turned ONLINE: immediately register in activeUsersCache
                const existing = activeUsersCache.get(uid);
                const activeItem = {
                    id: uid,
                    _id: uid,
                    name: user?.name || existing?.name || socket.data.user?.name || 'మిత్రులు',
                    teluguName: user?.teluguName || existing?.teluguName || user?.name || 'మిత్రులు',
                    handle: user?.mitraId || user?.handle || existing?.handle || 'user',
                    mitraId: user?.mitraId || user?.handle || existing?.mitraId || 'user',
                    avatar: user?.avatar || existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
                    bio: user?.bio || existing?.bio || '',
                    teluguBio: user?.teluguBio || existing?.teluguBio || '',
                    location: user?.location || existing?.location || 'హైదరాబాద్, తెలంగాణ',
                    isVerified: Boolean(user?.isVerified ?? existing?.isVerified),
                    gender: gender || user?.gender || existing?.gender || 'prefer_not_to_say',
                    profession: profession || user?.profession || existing?.profession || 'కమ్యూనిటీ మిత్రులు',
                    callCategory: callCategory || user?.callCategory || existing?.callCategory || 'casuals',
                    isCallActive: true,
                    callLanguage: callLanguage || user?.callLanguage || existing?.callLanguage || 'తెలుగు (Telugu)',
                    callRating: user?.callRating ?? existing?.callRating ?? 5.0,
                    callRatingCount: user?.callRatingCount ?? existing?.callRatingCount ?? 0,
                    callRateCoins: user?.callRateCoins ?? existing?.callRateCoins ?? 500,
                    isOnline: true,
                    callActiveAt: Date.now(),
                };
                activeUsersCache.set(uid, activeItem);
            }
            else {
                // User turned OFFLINE: immediately remove from activeUsersCache
                activeUsersCache.delete(uid);
            }
            // 1. INSTANT BROADCAST TO ALL CONNECTED CLIENTS (0ms DELAY)
            broadcastActiveUsersInstant();
            // 2. Emit confirmation back to all sockets of this user (syncs tabs)
            io.to(`user_${uid}`).emit('circle:my_status_updated', {
                isCallActive: activeState,
                gender,
                profession,
                callLanguage,
            });
            callback?.({ success: true, isCallActive: activeState });
            // 3. Persist in MongoDB asynchronously
            const updateFields = {
                isCallActive: activeState,
                callActiveAt: activeState ? new Date() : null,
            };
            if (gender)
                updateFields.gender = gender;
            if (profession)
                updateFields.profession = profession;
            if (callLanguage)
                updateFields.callLanguage = callLanguage;
            if (callCategory)
                updateFields.callCategory = callCategory;
            User.findByIdAndUpdate(uid, updateFields, { new: true })
                .then((updated) => {
                if (updated && activeState) {
                    const cached = activeUsersCache.get(uid);
                    if (cached) {
                        cached.name = updated.name || cached.name;
                        cached.avatar = updated.avatar || cached.avatar;
                        cached.callRating = updated.callRating ?? cached.callRating;
                        cached.callRatingCount = updated.callRatingCount ?? cached.callRatingCount;
                    }
                }
            })
                .catch((e) => console.warn('[circle:toggle_active DB error]:', e));
        }
        catch (err) {
            console.error('[circle:toggle_active error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to toggle status' });
        }
    });
    // ── B. 1-on-1 Call Signaling: Start Call ─────────────────────
    socket.on('call:start', async (data, callback) => {
        if (!socket.data.userId) {
            return callback?.({ success: false, error: 'Unauthorized' });
        }
        try {
            const callerId = socket.data.userId;
            const { targetUserId, callType = 'audio' } = data;
            if (!targetUserId || targetUserId === callerId) {
                return callback?.({ success: false, error: 'మీకు మీరే కాల్ చేసుకోలేరు (Cannot call yourself)' });
            }
            // Check caller details & balance
            const [caller, targetUser] = await Promise.all([
                User.findById(callerId),
                User.findById(targetUserId),
            ]);
            if (!caller || !targetUser) {
                return callback?.({ success: false, error: 'User not found' });
            }
            const costCoins = targetUser.callRateCoins || 500;
            if ((caller.coins || 0) < costCoins) {
                return callback?.({
                    success: false,
                    error: `కాల్ చేయడానికి కనీసం ${costCoins} నాణేలు (coins) అవసరం. మీ బ్యాలెన్స్: ${caller.coins || 0}`,
                    insufficientCoins: true,
                });
            }
            // Check if target user is online
            if (!targetUser.isCallActive) {
                return callback?.({
                    success: false,
                    error: `${targetUser.name} ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు (User is offline)`,
                    isOffline: true,
                });
            }
            // Deduct coins from caller upfront (escrow)
            caller.coins = (caller.coins || 0) - costCoins;
            await caller.save();
            const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const roomName = `circle_call_${callId}`;
            const session = await CallSession.create({
                callId,
                roomName,
                callerId: caller._id.toString(),
                callerName: caller.name,
                callerTeluguName: caller.teluguName,
                callerHandle: caller.mitraId || caller.handle,
                callerAvatar: caller.avatar,
                targetUserId: targetUser._id.toString(),
                targetUserName: targetUser.name,
                targetUserTeluguName: targetUser.teluguName,
                targetUserAvatar: targetUser.avatar,
                callType,
                status: 'ringing',
            });
            // Send incoming call alert directly to target user's socket room
            const incomingPayload = {
                callId,
                roomName,
                callType,
                costCoins,
                caller: {
                    id: caller._id.toString(),
                    name: caller.name,
                    teluguName: caller.teluguName,
                    handle: caller.mitraId || caller.handle,
                    avatar: caller.avatar,
                    location: caller.location,
                },
            };
            io.to(`user_${targetUserId}`).emit('call:incoming', incomingPayload);
            // Auto-cancel if not answered within 60 seconds
            const timeout = setTimeout(async () => {
                try {
                    const current = await CallSession.findOne({ callId });
                    if (current && current.status === 'ringing') {
                        current.status = 'timeout';
                        await current.save();
                        // Refund coins to caller
                        await User.findByIdAndUpdate(callerId, { $inc: { coins: costCoins } });
                        io.to(`user_${callerId}`).emit('call:timeout', {
                            callId,
                            message: 'కాల్ స్వీకరించబడలేదు. నాణేలు రీఫండ్ చేయబడ్డాయి (Call timed out, coins refunded).',
                        });
                        io.to(`user_${targetUserId}`).emit('call:timeout', { callId });
                    }
                }
                catch (e) {
                    console.error('[call:timeout handler error]:', e);
                }
                finally {
                    callTimeoutsMap.delete(callId);
                }
            }, 60000);
            callTimeoutsMap.set(callId, timeout);
            callback?.({
                success: true,
                callId,
                roomName,
                callType,
                targetUser: {
                    id: targetUser._id.toString(),
                    name: targetUser.name,
                    teluguName: targetUser.teluguName,
                    handle: targetUser.mitraId || targetUser.handle,
                    avatar: targetUser.avatar,
                    callRating: targetUser.callRating ?? 5.0,
                },
            });
        }
        catch (err) {
            console.error('[call:start error]:', err);
            callback?.({ success: false, error: err.message || 'Call failed to initiate' });
        }
    });
    // ── C. 1-on-1 Call Signaling: Respond (Accept / Decline) ─────
    socket.on('call:respond', async (data, callback) => {
        if (!socket.data.userId) {
            return callback?.({ success: false, error: 'Unauthorized' });
        }
        try {
            const { callId, action } = data; // action: 'accept' | 'decline'
            const responderId = socket.data.userId;
            const session = await CallSession.findOne({ callId });
            if (!session) {
                return callback?.({ success: false, error: 'Call session not found' });
            }
            if (session.status !== 'ringing') {
                return callback?.({ success: false, error: `Call already ${session.status}` });
            }
            // Clear the auto-cancel timeout
            if (callTimeoutsMap.has(callId)) {
                clearTimeout(callTimeoutsMap.get(callId));
                callTimeoutsMap.delete(callId);
            }
            if (action === 'accept') {
                session.status = 'accepted';
                await session.save();
                // Mint LiveKit Tokens for caller and receiver
                const atCaller = new livekit_server_sdk_1.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
                    identity: session.callerId,
                    name: session.callerName,
                    ttl: '2h',
                });
                atCaller.addGrant({ roomJoin: true, room: session.roomName, canPublish: true, canSubscribe: true, canPublishData: true });
                const callerToken = await atCaller.toJwt();
                const atReceiver = new livekit_server_sdk_1.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
                    identity: session.targetUserId,
                    name: session.targetUserName || 'Receiver',
                    ttl: '2h',
                });
                atReceiver.addGrant({ roomJoin: true, room: session.roomName, canPublish: true, canSubscribe: true, canPublishData: true });
                const receiverToken = await atReceiver.toJwt();
                // Emit accepted to caller with their token
                io.to(`user_${session.callerId}`).emit('call:accepted', {
                    callId,
                    roomName: session.roomName,
                    token: callerToken,
                    serverUrl: LIVEKIT_URL,
                    callType: session.callType,
                });
                // Return receiver's token
                callback?.({
                    success: true,
                    callId,
                    roomName: session.roomName,
                    token: receiverToken,
                    serverUrl: LIVEKIT_URL,
                    callType: session.callType,
                });
            }
            else {
                // Declined: refund caller
                session.status = 'declined';
                await session.save();
                const targetUser = await User.findById(session.targetUserId).select('callRateCoins').lean();
                const costCoins = targetUser?.callRateCoins || 500;
                await User.findByIdAndUpdate(session.callerId, { $inc: { coins: costCoins } });
                io.to(`user_${session.callerId}`).emit('call:declined', {
                    callId,
                    message: 'సదరు మిత్రులు కాల్‌ను తిరస్కరించారు. మీ నాణెం రీఫండ్ చేయబడింది (Call declined, coins refunded).',
                });
                callback?.({ success: true, declined: true });
            }
        }
        catch (err) {
            console.error('[call:respond error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to respond to call' });
        }
    });
    // ── D. 1-on-1 Call Signaling: End Call ───────────────────────
    socket.on('call:end', async (data, callback) => {
        try {
            const { callId, roomName } = data;
            const session = await CallSession.findOne({
                $or: [{ callId }, { roomName }],
            });
            if (session && session.status !== 'ended') {
                session.status = 'ended';
                session.endedAt = new Date();
                await session.save();
                // Notify both parties
                io.to(`user_${session.callerId}`).emit('call:ended', { callId: session.callId });
                io.to(`user_${session.targetUserId}`).emit('call:ended', { callId: session.callId });
            }
            callback?.({ success: true });
        }
        catch (err) {
            console.error('[call:end error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to end call' });
        }
    });
    // ── E. Cleanup on Disconnect ────────────────────────────────
    socket.on('disconnect', () => {
        if (userId && userSocketsMap.has(userId)) {
            userSocketsMap.get(userId).delete(socket.id);
            if (userSocketsMap.get(userId).size === 0) {
                userSocketsMap.delete(userId);
            }
        }
    });
});
// ─────────────────────────────────────────────────────────────
// 5. REST API ROUTES (FOR HTTP CLIENTS & BACKWARD COMPATIBILITY)
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        activeSockets: io.sockets.sockets.size,
        onlineUsersCount: userSocketsMap.size,
    });
});
// GET /api/circle/users
app.get('/api/circle/users', async (req, res) => {
    try {
        const gender = req.query.gender || 'all';
        const category = req.query.category || 'all';
        let users = await fetchActiveCircleUsers();
        if (gender !== 'all') {
            users = users.filter((u) => u.gender === gender);
        }
        if (category !== 'all') {
            const target = category.toLowerCase();
            users = users.filter((u) => (u.profession || '').toLowerCase().includes(target) ||
                (u.callCategory || '').toLowerCase().includes(target));
        }
        res.json({ success: true, users, count: users.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch active users' });
    }
});
// GET /api/circle/community/rooms
app.get('/api/circle/community/rooms', async (_req, res) => {
    try {
        const rooms = await fetchCommunityRoomsWithCounts();
        res.json({ success: true, rooms, costCoins: 0 });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch community rooms' });
    }
});
// POST /api/internal/circle/sync-active (Instant sync from Next.js or React Native)
app.post('/api/internal/circle/sync-active', async (req, res) => {
    try {
        const { userId, user, isCallActive, gender, profession, callLanguage, callCategory } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        const activeState = Boolean(isCallActive);
        if (activeState) {
            const existing = activeUsersCache.get(userId);
            activeUsersCache.set(userId, {
                id: userId,
                _id: userId,
                name: user?.name || existing?.name || 'మిత్రులు',
                teluguName: user?.teluguName || existing?.teluguName || user?.name || 'మిత్రులు',
                handle: user?.mitraId || user?.handle || existing?.handle || 'user',
                mitraId: user?.mitraId || user?.handle || existing?.mitraId || 'user',
                avatar: user?.avatar || existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
                bio: user?.bio || existing?.bio || '',
                teluguBio: user?.teluguBio || existing?.teluguBio || '',
                location: user?.location || existing?.location || 'హైదరాబాద్',
                isVerified: Boolean(user?.isVerified ?? existing?.isVerified),
                gender: gender || user?.gender || existing?.gender || 'prefer_not_to_say',
                profession: profession || user?.profession || existing?.profession || 'కమ్యూనిటీ మిత్రులు',
                callCategory: callCategory || user?.callCategory || existing?.callCategory || 'casuals',
                isCallActive: true,
                callLanguage: callLanguage || user?.callLanguage || existing?.callLanguage || 'తెలుగు (Telugu)',
                callRating: user?.callRating ?? existing?.callRating ?? 5.0,
                callRatingCount: user?.callRatingCount ?? existing?.callRatingCount ?? 0,
                callRateCoins: user?.callRateCoins ?? existing?.callRateCoins ?? 500,
                isOnline: true,
                callActiveAt: Date.now(),
            });
        }
        else {
            activeUsersCache.delete(userId);
        }
        broadcastActiveUsersInstant();
        res.json({ success: true, count: activeUsersCache.size });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /api/internal/circle/notify-incoming-call (Next.js -> mitruluserver -> target user socket)
app.post('/api/internal/circle/notify-incoming-call', (req, res) => {
    const { targetUserId, call } = req.body;
    if (!targetUserId || !call) {
        return res.status(400).json({ error: 'Missing targetUserId or call' });
    }
    console.log(`[CircleSocket] Forwarding incoming call alert to user_${targetUserId}`);
    io.to(`user_${targetUserId}`).emit('call:incoming', call);
    res.json({ success: true });
});
// POST /api/internal/circle/notify-call-response (Next.js -> mitruluserver -> caller socket)
app.post('/api/internal/circle/notify-call-response', (req, res) => {
    const { callerId, action, callId, roomName, token, serverUrl, callType, message } = req.body;
    if (!callerId) {
        return res.status(400).json({ error: 'Missing callerId' });
    }
    if (action === 'accept') {
        io.to(`user_${callerId}`).emit('call:accepted', { callId, roomName, token, serverUrl, callType });
    }
    else {
        io.to(`user_${callerId}`).emit('call:declined', { callId, message });
    }
    res.json({ success: true });
});
// POST /api/internal/circle/notify-call-end (Next.js -> mitruluserver -> both sockets)
app.post('/api/internal/circle/notify-call-end', (req, res) => {
    const { callId, callerId, targetUserId } = req.body;
    if (callerId)
        io.to(`user_${callerId}`).emit('call:ended', { callId });
    if (targetUserId)
        io.to(`user_${targetUserId}`).emit('call:ended', { callId });
    res.json({ success: true });
});
// POST /api/circle/active-status
app.post('/api/circle/active-status', async (req, res) => {
    try {
        const token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : null;
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const { isCallActive, gender, profession, callLanguage, callCategory, user: clientUser } = req.body;
        const uid = decoded.userId;
        const activeState = Boolean(isCallActive);
        // Update in-memory cache instantly
        if (activeState) {
            const existing = activeUsersCache.get(uid);
            activeUsersCache.set(uid, {
                id: uid,
                _id: uid,
                name: clientUser?.name || existing?.name || decoded.name || 'మిత్రులు',
                teluguName: clientUser?.teluguName || existing?.teluguName || 'మిత్రులు',
                handle: clientUser?.mitraId || clientUser?.handle || existing?.handle || decoded.handle || 'user',
                mitraId: clientUser?.mitraId || clientUser?.handle || existing?.mitraId || decoded.handle || 'user',
                avatar: clientUser?.avatar || existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
                bio: clientUser?.bio || existing?.bio || '',
                teluguBio: clientUser?.teluguBio || existing?.teluguBio || '',
                location: clientUser?.location || existing?.location || 'హైదరాబాద్',
                isVerified: Boolean(clientUser?.isVerified ?? existing?.isVerified),
                gender: gender || clientUser?.gender || existing?.gender || 'prefer_not_to_say',
                profession: profession || clientUser?.profession || existing?.profession || 'కమ్యూనిటీ మిత్రులు',
                callCategory: callCategory || clientUser?.callCategory || existing?.callCategory || 'casuals',
                isCallActive: true,
                callLanguage: callLanguage || clientUser?.callLanguage || existing?.callLanguage || 'తెలుగు (Telugu)',
                callRating: clientUser?.callRating ?? existing?.callRating ?? 5.0,
                callRatingCount: clientUser?.callRatingCount ?? existing?.callRatingCount ?? 0,
                callRateCoins: clientUser?.callRateCoins ?? existing?.callRateCoins ?? 500,
                isOnline: true,
                callActiveAt: Date.now(),
            });
        }
        else {
            activeUsersCache.delete(uid);
        }
        // Broadcast instant update to all connected WebSockets (0ms)
        broadcastActiveUsersInstant();
        const updateFields = {
            isCallActive: activeState,
            callActiveAt: activeState ? new Date() : null,
        };
        if (gender)
            updateFields.gender = gender;
        if (profession)
            updateFields.profession = profession;
        if (callLanguage)
            updateFields.callLanguage = callLanguage;
        if (callCategory)
            updateFields.callCategory = callCategory;
        const user = await User.findByIdAndUpdate(uid, updateFields, { new: true }).lean();
        res.json({
            success: true,
            user: {
                id: user?._id.toString(),
                isCallActive: Boolean(user?.isCallActive),
                gender: user?.gender,
                profession: user?.profession,
                callLanguage: user?.callLanguage,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update active status' });
    }
});
// Periodic background sync for community rooms (every 20s broadcast to all sockets)
setInterval(async () => {
    if (io.sockets.sockets.size > 0) {
        await broadcastCommunityRooms();
    }
}, 20000);
// ─────────────────────────────────────────────────────────────
// 6. SERVER INITIALIZATION
// ─────────────────────────────────────────────────────────────
async function startServer() {
    try {
        console.log('[Mitrulu Server] Connecting to MongoDB...');
        await mongoose_1.default.connect(MONGO_URI);
        console.log('[Mitrulu Server] MongoDB Connected successfully.');
        // Pre-warm in-memory cache so connected clients get 0ms instantaneous data
        await syncActiveUsersFromDB();
        fetchCommunityRoomsWithCounts().then((rooms) => {
            cachedCommunityRooms = rooms;
        }).catch(() => { });
        server.listen(PORT, () => {
            console.log(`[Mitrulu Server] Real-Time Circle Server running on port ${PORT}`);
            console.log(`[Mitrulu Server] WebSocket URL: ws://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('[Mitrulu Server] Startup Error:', err);
        process.exit(1);
    }
}
startServer();
