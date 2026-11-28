import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

/** Extract JWT from Authorization Bearer header or mitrulu_token cookie. */
export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (bearerToken) return bearerToken;

  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)mitrulu_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/** Verify HS256 JWT and return decoded payload, or null when invalid/expired. */
export function verifyAuthToken(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const token = extractAuthToken(req);

    if (token) {
      const decoded = verifyAuthToken(token);
      if (decoded) {
        req.user = decoded;
        req.userId = String(decoded.userId || decoded.id || decoded._id || '');
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
    const token = extractAuthToken(req);

    if (token) {
      const decoded = verifyAuthToken(token);
      if (decoded) {
        req.user = decoded;
        req.userId = String(decoded.userId || decoded.id || decoded._id || '');
        return next();
      }
      res.status(401).json({ error: 'సెషన్ ముగిసింది (Invalid or expired token)' });
      return;
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

