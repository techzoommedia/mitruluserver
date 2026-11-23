import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import UserModel from '../models/user.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

      if (!token && req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)mitrulu_token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (!token) {
        res.status(401).json({ authenticated: false, error: 'No token provided' });
        return;
      }

      const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const userId = decoded.userId || decoded.id || decoded._id;

      if (!userId) {
        res.status(401).json({ authenticated: false, error: 'Invalid token payload' });
        return;
      }

      const user = await UserModel.findById(userId).lean();
      if (!user) {
        res.status(404).json({ authenticated: false, error: 'User not found' });
        return;
      }

      res.json({
        authenticated: true,
        user: {
          id: String(user._id),
          _id: String(user._id),
          name: user.name,
          teluguName: user.teluguName,
          email: user.email,
          handle: user.handle || user.mitraId,
          mitraId: user.mitraId,
          avatar: user.avatar || '',
          bio: user.bio || user.teluguBio || '',
          isVerified: Boolean(user.isVerified),
          followersCount: (user as any).followersCount || 0,
          followingCount: (user as any).followingCount || 0,
          postsCount: (user as any).postsCount || 0,
          coins: user.coins || 0,
          earnedCoins: user.earnedCoins || 0,
          isCallActive: Boolean(user.isCallActive),
          gender: user.gender,
          profession: user.profession,
          callLanguage: user.callLanguage,
          callRating: user.callRating || 5.0,
          callRatingCount: user.callRatingCount || 0,
          callRateCoins: user.callRateCoins || 0,
        },
      });
    } catch (error: any) {
      res.status(401).json({ authenticated: false, error: error.message || 'Token verification failed' });
    }
  }

  async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      const webBase = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      try {
        const nextRes = await fetch(`${webBase}/api/auth/send-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(req.headers['x-mitrulu-client'] ? { 'x-mitrulu-client': String(req.headers['x-mitrulu-client']) } : {}),
          },
          body: JSON.stringify(req.body),
        });
        const data = await nextRes.json();
        res.status(nextRes.status).json(data);
        return;
      } catch {
        const liveRes = await fetch('https://www.mitrulu.in/api/auth/send-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        const liveData = await liveRes.json();
        res.status(liveRes.status).json(liveData);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to send OTP' });
    }
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const webBase = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      try {
        const nextRes = await fetch(`${webBase}/api/auth/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(req.headers['x-mitrulu-client'] ? { 'x-mitrulu-client': String(req.headers['x-mitrulu-client']) } : {}),
          },
          body: JSON.stringify(req.body),
        });
        const data = await nextRes.json();
        res.status(nextRes.status).json(data);
        return;
      } catch {
        const liveRes = await fetch('https://www.mitrulu.in/api/auth/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        const liveData = await liveRes.json();
        res.status(liveRes.status).json(liveData);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to verify OTP' });
    }
  }
}

export const authController = new AuthController();
