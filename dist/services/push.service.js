"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markPushDispatchedForMessage = markPushDispatchedForMessage;
exports.getFirebaseAdmin = getFirebaseAdmin;
exports.resolveRecipientUser = resolveRecipientUser;
exports.sendPushToUser = sendPushToUser;
exports.sendIncomingCallPush = sendIncomingCallPush;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importDefault(require("../models/user.model"));
let firebaseAdminApp = null;
let isUnconfigured = false;
const dispatchedPushMessageIds = new Set();
function markPushDispatchedForMessage(messageId) {
    if (!messageId)
        return false;
    if (dispatchedPushMessageIds.has(messageId)) {
        return true;
    }
    dispatchedPushMessageIds.add(messageId);
    if (dispatchedPushMessageIds.size > 5000) {
        const first = dispatchedPushMessageIds.values().next().value;
        if (first)
            dispatchedPushMessageIds.delete(first);
    }
    return false;
}
function getFirebaseAdmin() {
    if (firebaseAdminApp)
        return firebaseAdminApp;
    if (isUnconfigured)
        return null;
    try {
        const apps = (0, app_1.getApps)();
        if (apps.length > 0) {
            firebaseAdminApp = apps[0];
            return firebaseAdminApp;
        }
        const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (rawServiceAccount) {
            let parsedCreds = null;
            try {
                parsedCreds = JSON.parse(rawServiceAccount);
            }
            catch {
                try {
                    const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
                    parsedCreds = JSON.parse(decoded);
                }
                catch {
                    console.warn('[PushService] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY');
                }
            }
            if (parsedCreds?.project_id && parsedCreds?.private_key) {
                firebaseAdminApp = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(parsedCreds),
                });
                console.log('[PushService] Firebase Admin initialized with service account key');
                return firebaseAdminApp;
            }
        }
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (projectId && clientEmail && rawPrivateKey) {
            const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
            firebaseAdminApp = (0, app_1.initializeApp)({
                credential: (0, app_1.cert)({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log(`[PushService] Firebase Admin initialized for project: ${projectId}`);
            return firebaseAdminApp;
        }
        isUnconfigured = true;
        console.warn('[PushService] Firebase credentials not configured; push notifications disabled.');
        return null;
    }
    catch (err) {
        console.error('[PushService] Firebase Admin init error:', err);
        return null;
    }
}
async function resolveRecipientUser(targetUserId) {
    if (!targetUserId)
        return null;
    const clean = String(targetUserId).trim().replace(/^@/, '');
    if (!clean)
        return null;
    if (mongoose_1.default.Types.ObjectId.isValid(clean)) {
        const byId = await user_model_1.default.findById(clean).select('_id name teluguName handle mitraId fcmTokens').lean();
        if (byId)
            return byId;
    }
    return user_model_1.default.findOne({
        $or: [
            { mitraId: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { handle: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
    })
        .select('_id name teluguName handle mitraId fcmTokens')
        .lean();
}
async function sendPushToUser(targetUserId, payload) {
    try {
        const user = await resolveRecipientUser(targetUserId);
        if (!user) {
            return { success: false, deliveredCount: 0, reason: 'user_not_found' };
        }
        const tokensList = (user.fcmTokens || [])
            .map((t) => (typeof t === 'string' ? t : t?.token))
            .filter((t) => typeof t === 'string' && t.length > 10);
        if (tokensList.length === 0) {
            return { success: true, deliveredCount: 0, reason: 'no_registered_tokens' };
        }
        const app = getFirebaseAdmin();
        if (!app) {
            return { success: true, deliveredCount: 0, reason: 'firebase_unconfigured' };
        }
        const stringData = {};
        if (payload.data) {
            for (const [k, v] of Object.entries(payload.data)) {
                if (v !== undefined && v !== null) {
                    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
                }
            }
        }
        stringData.type = stringData.type || payload.type || 'system';
        stringData.title = stringData.title || payload.title;
        stringData.body = stringData.body || payload.body;
        stringData.tag = stringData.tag || payload.tag || 'mitrulu-notification';
        if (payload.image && !stringData.image) {
            stringData.image = payload.image;
        }
        if (payload.link) {
            stringData.link = payload.link;
        }
        const isCallPush = stringData.type === 'call' || stringData.action === 'incoming_call';
        const messaging = (0, messaging_1.getMessaging)(app);
        const multicastMessage = {
            tokens: tokensList,
            notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.image ? { imageUrl: payload.image } : {}),
            },
            data: stringData,
            webpush: {
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: '/pwa-icon-192.png',
                    badge: '/pwa-icon-192.png',
                    tag: payload.tag || 'mitrulu-notification',
                    vibrate: isCallPush ? [350, 150, 350, 150, 500] : [200, 100, 200],
                    requireInteraction: isCallPush,
                },
                fcmOptions: {
                    link: payload.link || 'https://mitrulu.in',
                },
            },
            android: {
                priority: payload.priority === 'high' ? 'high' : 'normal',
                notification: {
                    icon: 'ic_notification',
                    color: '#7c3aed',
                    sound: 'default',
                    clickAction: 'OPEN_ACTIVITY',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };
        console.log(`[PushService] Dispatching ${stringData.type || 'notification'} push (action=${stringData.action || 'none'}, isCall=${isCallPush}) to user ${user._id} (${tokensList.length} token(s)): "${payload.title}"`);
        const response = await messaging.sendEachForMulticast(multicastMessage);
        console.log(`[PushService] Multicast result for user ${user._id}: ${response.successCount} succeeded, ${response.failureCount} failed`);
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const code = resp.error.code;
                    if (code === 'messaging/registration-token-not-registered' ||
                        code === 'messaging/invalid-registration-token') {
                        invalidTokens.push(tokensList[idx]);
                    }
                }
            });
            if (invalidTokens.length > 0) {
                await user_model_1.default.findByIdAndUpdate(user._id, {
                    $pull: { fcmTokens: { token: { $in: invalidTokens } } },
                }).catch(() => { });
            }
        }
        return {
            success: response.successCount > 0,
            deliveredCount: response.successCount,
        };
    }
    catch (err) {
        console.error('[PushService] sendPushToUser error:', err?.message || err);
        return { success: false, deliveredCount: 0, reason: err?.message };
    }
}
async function sendIncomingCallPush(params) {
    const link = `/call/${encodeURIComponent(params.roomName)}?callId=${encodeURIComponent(params.callId)}&type=${params.callType}`;
    await sendPushToUser(params.targetUserId, {
        type: 'call',
        title: `📞 ${params.callerName} is calling you`,
        body: `Tap to answer ${params.callType} call on Mitrulu Circle`,
        image: params.callerAvatar || undefined,
        link,
        tag: `call-${params.callId}`,
        priority: 'high',
        data: {
            type: 'call',
            action: 'incoming_call',
            callId: params.callId,
            roomName: params.roomName,
            callType: params.callType,
            callerId: params.callerId,
            callerName: params.callerName,
        },
    }).catch(() => { });
}
