/**
 * ORBITAL server — JWT auth middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { extractBearerToken, verifyAccessToken } from '../utils/auth';

export interface AuthedRequest extends Request {
  user?: { sub: string; username: string };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Response | void {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}
