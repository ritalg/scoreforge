import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import type { UserRole } from '../../../shared/src/types';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const user = db.select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
    }).from(schema.users).where(eq(schema.users.id, payload.userId)).get();

    if (!user || user.status === 'deleted' || user.status === 'suspended') {
      return res.status(401).json({ error: 'Account not accessible' });
    }

    req.user = user as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
