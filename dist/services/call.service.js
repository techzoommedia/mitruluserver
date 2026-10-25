"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callService = exports.CallService = void 0;
const call_session_repository_1 = require("../repositories/call-session.repository");
const user_repository_1 = require("../repositories/user.repository");
const livekit_service_1 = require("./livekit.service");
const env_1 = require("../config/env");
class CallService {
    callRepo;
    userRepo;
    constructor(callRepo = call_session_repository_1.callSessionRepository, userRepo = user_repository_1.userRepository) {
        this.callRepo = callRepo;
        this.userRepo = userRepo;
    }
    async startCall(callerId, targetUserId, callType = 'audio') {
        if (!targetUserId || targetUserId === callerId) {
            throw new Error('మీకు మీరే కాల్ చేసుకోలేరు (Cannot call yourself)');
        }
        const [caller, targetUser] = await Promise.all([
            this.userRepo.findById(callerId),
            this.userRepo.findById(targetUserId),
        ]);
        if (!caller || !targetUser) {
            throw new Error('User not found');
        }
        const costCoins = targetUser.callRateCoins || 500;
        if ((caller.coins || 0) < costCoins) {
            const err = new Error(`కాల్ చేయడానికి కనీసం ${costCoins} నాణేలు (coins) అవసరం. మీ బ్యాలెన్స్: ${caller.coins || 0}`);
            err.insufficientCoins = true;
            throw err;
        }
        if (!targetUser.isCallActive) {
            const err = new Error(`${targetUser.name} ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు (User is offline)`);
            err.isOffline = true;
            throw err;
        }
        // Deduct coins from caller upfront (escrow)
        caller.coins = (caller.coins || 0) - costCoins;
        await caller.save();
        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const roomName = `circle_call_${callId}`;
        const session = await this.callRepo.create({
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
        const callerResponse = {
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
        };
        return { session, costCoins, incomingPayload, callerResponse };
    }
    async respondToCall(callId, action) {
        const session = await this.callRepo.findByCallId(callId);
        if (!session) {
            throw new Error('Call session not found');
        }
        if (session.status !== 'ringing') {
            throw new Error(`Call already ${session.status}`);
        }
        if (action === 'accept') {
            session.status = 'accepted';
            await session.save();
            const [callerToken, receiverToken] = await Promise.all([
                livekit_service_1.liveKitService.generateToken(session.callerId, session.callerName, session.roomName),
                livekit_service_1.liveKitService.generateToken(session.targetUserId, session.targetUserName || 'Receiver', session.roomName),
            ]);
            return {
                action: 'accept',
                session,
                callerToken,
                receiverToken,
                serverUrl: env_1.LIVEKIT_URL,
            };
        }
        else {
            session.status = 'declined';
            await session.save();
            const targetUser = await this.userRepo.findByIdLean(session.targetUserId, 'callRateCoins');
            const costCoins = targetUser?.callRateCoins || 500;
            await this.userRepo.refundCoins(session.callerId, costCoins);
            return {
                action: 'decline',
                session,
                message: 'సదరు మిత్రులు కాల్‌ను తిరస్కరించారు. మీ నాణెం రీఫండ్ చేయబడింది (Call declined, coins refunded).',
            };
        }
    }
    async endCall(callId, roomName) {
        const session = await this.callRepo.findByCallOrRoom(callId, roomName);
        if (session && session.status !== 'ended') {
            session.status = 'ended';
            session.endedAt = new Date();
            await session.save();
        }
        return session;
    }
    async handleTimeout(callId, costCoins) {
        const current = await this.callRepo.findByCallId(callId);
        if (current && current.status === 'ringing') {
            current.status = 'timeout';
            await current.save();
            // Refund coins to caller
            await this.userRepo.refundCoins(current.callerId, costCoins);
            return current;
        }
        return null;
    }
}
exports.CallService = CallService;
exports.callService = new CallService();
