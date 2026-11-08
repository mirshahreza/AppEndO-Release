import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessTokenSecret,
  getRefreshTokenSecret,
} from '../constants/auth';

export type JwtAuthPayload = {
  sub: number;
  email: string;
  role: string;
  roles?: string[];
  type: 'access' | 'refresh';
  jti?: string;
};

export type AuthRequestContext = {
  userId: number;
  email: string;
  role: string;
  roles: string[];
};

export const toJwtAuthPayload = (decoded: string | jwt.JwtPayload): JwtAuthPayload | null => {
  if (!decoded || typeof decoded === 'string') return null;
  const { sub, email, role, roles, type, jti } = decoded as Record<string, unknown>;
  if ((type !== 'access' && type !== 'refresh') || typeof email !== 'string' || typeof role !== 'string') {
    return null;
  }
  const userId = typeof sub === 'number' ? sub : Number(sub);
  if (!Number.isFinite(userId)) {
    return null;
  }
  return {
    sub: userId,
    email,
    role,
    roles: Array.isArray(roles)
      ? roles.filter((item): item is string => typeof item === 'string').map((item) => item.toUpperCase())
      : undefined,
    type,
    jti: typeof jti === 'string' ? jti : undefined,
  };
};

export const getAccessTokenFromRequest = (req: Request) => {
  const authHeader = req.header('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
};

export const normalizeAuthRoles = (req: Request): string[] => (
  req.auth?.roles && req.auth.roles.length > 0
    ? req.auth.roles
    : req.auth?.role
      ? [req.auth.role]
      : []
).map((role) => role.toUpperCase());

export const hasAdminRole = (req: Request): boolean => normalizeAuthRoles(req).includes('ADMIN');

export const getCurrentRefreshJti = (req: Request) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) return null;
  try {
    const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
    const payload = toJwtAuthPayload(decoded);
    return payload?.type === 'refresh' ? payload.jti || null : null;
  } catch {
    return null;
  }
};

export const tryAttachAuth = (req: Request): boolean => {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, getAccessTokenSecret());
    const payload = toJwtAuthPayload(decoded);
    if (!payload || payload.type !== 'access') {
      return false;
    }
    const effectiveRoles = payload.roles && payload.roles.length > 0
      ? payload.roles.map((role) => role.toUpperCase())
      : [payload.role.toUpperCase()];
    req.auth = {
      userId: Number(payload.sub),
      email: payload.email,
      role: effectiveRoles[0] || payload.role,
      roles: effectiveRoles,
    };
    return true;
  } catch {
    return false;
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (tryAttachAuth(req)) {
    next();
    return;
  }

  const token = getAccessTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing access token.' });
    return;
  }

  res.status(401).json({ success: false, error: 'Access token expired or invalid.' });
};

/** Attach auth when valid; allow anonymous when no token; 401 only for stale credentials. */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  if (tryAttachAuth(req)) {
    next();
    return;
  }

  const token = getAccessTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Access token expired or invalid.' });
};

export const requireAdminOrDeveloper = (req: Request, res: Response, next: NextFunction) => {
  if (hasAdminRole(req)) {
    next();
    return;
  }
  const roles = normalizeAuthRoles(req).map((role) => role.toUpperCase());
  if (roles.includes('DEVELOPER')) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: 'Forbidden.' });
};

export const requireRole = (...roles: string[]) => {
  const normalized = roles.map((role) => role.toUpperCase());
  return (req: Request, res: Response, next: NextFunction) => {
    const authRoles = normalizeAuthRoles(req);
    if (authRoles.length === 0) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }
    if (!normalized.some((role) => authRoles.includes(role))) {
      res.status(403).json({ success: false, error: 'Forbidden.' });
      return;
    }
    next();
  };
};
