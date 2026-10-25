import { ICallSessionRepository, callSessionRepository } from '../repositories/call-session.repository';
import { IUserRepository, userRepository } from '../repositories/user.repository';
import { liveKitService } from './livekit.service';
import { LIVEKIT_URL } from '../config/env';

export class CallService {
  private callRepo: ICallSessionRepository;
  private userRepo: IUserRepository;

  constructor(
    callRepo: ICallSessionRepository = callSessionRepository,
    userRepo: IUserRepository = userRepository
  ) {
    this.callRepo = callRepo;
    this.userRepo = userRepo;
  }

  async startCall(callerId: string, targetUserId: string, callType: 'audio' | 'video' = 'audio') {
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
      const err: any = new Error(
        `కాల్ చేయడానికి కనీసం ${costCoins} నాణేలు (coins) అవసరం. మీ బ్యాలెన్స్: ${caller.coins || 0}`
      );
      err.insufficientCoins = true;
      throw err;
    }

    if (!targetUser.isCallActive) {
      const err: any = new Error(`${targetUser.name} ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు (User is offline)`);
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

  async respondToCall(callId: string, action: 'accept' | 'decline') {
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
        liveKitService.generateToken(session.callerId, session.callerName, session.roomName),
        liveKitService.generateToken(session.targetUserId, session.targetUserName || 'Receiver', session.roomName),
      ]);

      return {
        action: 'accept',
        session,
        callerToken,
        receiverToken,
        serverUrl: LIVEKIT_URL,
      };
    } else {
      session.status = 'declined';
      await session.save();

      const targetUser = await this.userRepo.findByIdLean(session.targetUserId, 'callRateCoins');
      const costCoins = (targetUser as any)?.callRateCoins || 500;
      await this.userRepo.refundCoins(session.callerId, costCoins);

      return {
        action: 'decline',
        session,
        message: 'సదరు మిత్రులు కాల్‌ను తిరస్కరించారు. మీ నాణెం రీఫండ్ చేయబడింది (Call declined, coins refunded).',
      };
    }
  }

  async endCall(callId?: string, roomName?: string) {
    const session = await this.callRepo.findByCallOrRoom(callId, roomName);
    if (session && session.status !== 'ended') {
      session.status = 'ended';
      session.endedAt = new Date();
      await session.save();
    }
    return session;
  }

  async handleTimeout(callId: string, costCoins: number) {
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

export const callService = new CallService();
