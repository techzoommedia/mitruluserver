import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, MulticastMessage, SendResponse } from 'firebase-admin/messaging';
import mongoose from 'mongoose';
import UserModel from '../models/user.model';

let firebaseAdminApp: App | null = null;
let isUnconfigured = false;

const dispatchedPushMessageIds = new Set<string>();

export function markPushDispatchedForMessage(messageId?: string): boolean {
  if (!messageId) return false;
  if (dispatchedPushMessageIds.has(messageId)) {
    return true;
  }
  dispatchedPushMessageIds.add(messageId);
  if (dispatchedPushMessageIds.size > 5000) {
    const first = dispatchedPushMessageIds.values().next().value;
    if (first) dispatchedPushMessageIds.delete(first);
  }
  return false;
}

export function getFirebaseAdmin(): App | null {
  if (firebaseAdminApp) return firebaseAdminApp;
  if (isUnconfigured) return null;

  try {
    const apps = getApps();
    if (apps.length > 0) {
      firebaseAdminApp = apps[0];
      return firebaseAdminApp;
    }

    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (rawServiceAccount) {
      let parsedCreds: any = null;
      try {
        parsedCreds = JSON.parse(rawServiceAccount);
      } catch {
        try {
          const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
          parsedCreds = JSON.parse(decoded);
        } catch {
          console.warn('[PushService] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY');
        }
      }

      if (parsedCreds?.project_id && parsedCreds?.private_key) {
        firebaseAdminApp = initializeApp({
          credential: cert(parsedCreds),
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
      firebaseAdminApp = initializeApp({
        credential: cert({
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
  } catch (err) {
    console.error('[PushService] Firebase Admin init error:', err);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  image?: string;
  link?: string;
  tag?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
}

export async function resolveRecipientUser(targetUserId: string): Promise<any | null> {
  if (!targetUserId) return null;
  const clean = String(targetUserId).trim().replace(/^@/, '');
  if (!clean) return null;

  if (mongoose.Types.ObjectId.isValid(clean)) {
    const byId = await UserModel.findById(clean).select('_id name teluguName handle mitraId fcmTokens').lean();
    if (byId) return byId;
  }

  return UserModel.findOne({
    $or: [
      { mitraId: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { handle: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  })
    .select('_id name teluguName handle mitraId fcmTokens')
    .lean();
}

export async function sendPushToUser(
  targetUserId: string,
  payload: PushPayload
): Promise<{ success: boolean; deliveredCount: number; reason?: string }> {
  try {
    const user = await resolveRecipientUser(targetUserId);
    if (!user) {
      return { success: false, deliveredCount: 0, reason: 'user_not_found' };
    }

    const tokensList: string[] = (user.fcmTokens || [])
      .map((t: any) => (typeof t === 'string' ? t : t?.token))
      .filter((t: any): t is string => typeof t === 'string' && t.length > 10);

    if (tokensList.length === 0) {
      return { success: true, deliveredCount: 0, reason: 'no_registered_tokens' };
    }

    const app = getFirebaseAdmin();
    if (!app) {
      return { success: true, deliveredCount: 0, reason: 'firebase_unconfigured' };
    }

    const stringData: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        if (v !== undefined && v !== null) {
          stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
    }
    if (payload.link) {
      stringData.link = payload.link;
    }

    const messaging = getMessaging(app);
    const multicastMessage: MulticastMessage = {
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
          vibrate: [200, 100, 200],
          requireInteraction: payload.priority === 'high',
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

    const response = await messaging.sendEachForMulticast(multicastMessage);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp: SendResponse, idx: number) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(tokensList[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await UserModel.findByIdAndUpdate(user._id, {
          $pull: { fcmTokens: { token: { $in: invalidTokens } } },
        }).catch(() => {});
      }
    }

    return {
      success: response.successCount > 0,
      deliveredCount: response.successCount,
    };
  } catch (err: any) {
    console.error('[PushService] sendPushToUser error:', err?.message || err);
    return { success: false, deliveredCount: 0, reason: err?.message };
  }
}
