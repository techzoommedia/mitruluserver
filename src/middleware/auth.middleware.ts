import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)mitrulu_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        req.user = decoded;
        req.userId = String(decoded.userId || decoded.id || decoded._id || '');
      } catch {
        // invalid token, treat as guest
      }
    }

    if (!req.userId && req.headers['x-mitrulu-userid']) {
      req.userId = String(req.headers['x-mitrulu-userid']).trim();
    }

    next();
  } catch (err) {
    next();
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)mitrulu_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        req.user = decoded;
        req.userId = String(decoded.userId || decoded.id || decoded._id || '');
        return next();
      } catch {
        res.status(401).json({ error: 'సెషన్ ముగిసింది (Invalid or expired token)' });
        return;
      }
    }

    if (req.headers['x-mitrulu-userid']) {
      req.userId = String(req.headers['x-mitrulu-userid']).trim();
      return next();
    }

    res.status(401).json({ error: 'దయచేసి లాగిన్ అవ్వండి (Authentication required)' });
  } catch (err) {
    res.status(401).json({ error: 'ధృవీకరణ విఫలమైంది (Authentication failed)' });
  }
}

