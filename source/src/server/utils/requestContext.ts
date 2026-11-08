import type { Request } from 'express';
import type { ActorContext, AuthAuditContext, RequestDbContext } from '../types/requestContext';

export const toRequestDbContext = (req: Request): RequestDbContext => ({
  headers: req.headers as Record<string, unknown>,
  query: req.query as Record<string, unknown>,
  body: req.body,
});

export const toAuthAuditContext = (req: Request): AuthAuditContext => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const toActorContext = (req: Request, isAdmin: boolean): ActorContext => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new Error('Missing authenticated actor.');
  }
  return {
    userId,
    email: req.auth?.email,
    role: req.auth?.role,
    isAdmin,
  };
};
