import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  findRefreshTokenByJti,
  findRefreshTokenSession,
  listRefreshTokensForUser,
  persistRefreshToken as persistRefreshTokenRow,
  revokeAllUserRefreshTokensExcept,
  revokeRefreshToken as revokeRefreshTokenRow,
} from '../../domain/auth/authRefreshTokenRepository';
import { findAuthUserById } from '../../domain/users/userRepository';
import { setCachedUserRoles } from '../../domain/users/userRolesCache';
import { HttpError } from '../../errors/HttpError';
import { toJwtAuthPayload } from '../../middleware/auth.middleware';
import type { AuthAuditContext } from '../../types/requestContext';
import { logAuthEvent } from './sessionAudit.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  getRefreshTokenSecret,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../constants/auth';
import { hashToken, signAccessToken, signRefreshToken } from './token.service';
import type { AuthUser, SessionCookies } from './types';

export const persistRefreshToken = async (
  audit: AuthAuditContext,
  userId: number,
  jti: string,
  refreshToken: string,
): Promise<void> => {
  await persistRefreshTokenRow({
    userId,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: Date.now() + (REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: audit.userAgent || null,
    ipAddress: audit.ipAddress || null,
  });
};

export const revokeRefreshToken = async (jti: string, replacedByJti?: string): Promise<void> => {
  await revokeRefreshTokenRow(jti, replacedByJti);
};

export const issueSessionTokens = async (
  audit: AuthAuditContext,
  sessionUser: AuthUser,
  auditMetadata?: Record<string, unknown>,
): Promise<SessionCookies> => {
  const accessToken = signAccessToken(sessionUser);
  const refreshJti = crypto.randomUUID();
  const refreshToken = signRefreshToken(sessionUser, refreshJti);

  await persistRefreshToken(audit, sessionUser.id, refreshJti, refreshToken);
  await logAuthEvent(audit, 'LOGIN_SUCCESS', {
    userId: sessionUser.id,
    email: sessionUser.email,
    success: true,
    metadata: { refreshJti, ...auditMetadata },
  });

  return { accessToken, refreshToken };
};

export const refreshSession = async (refreshToken: string | undefined, audit: AuthAuditContext) => {
  if (!refreshToken) {
    throw new HttpError(401, 'Missing refresh token.', { clearCookies: true });
  }

  try {
    const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
    const payload = toJwtAuthPayload(decoded);
    if (!payload) {
      throw new Error('Invalid token payload');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new Error('Invalid token type');
    }

    const tokenRow = await findRefreshTokenByJti(payload.jti);

    const isValidRow = tokenRow
      && !tokenRow.revoked_at
      && Number(tokenRow.expires_at) > Date.now()
      && tokenRow.token_hash === hashToken(refreshToken);

    if (!isValidRow) {
      await logAuthEvent(audit, 'REFRESH_FAILED', {
        email: payload.email,
        userId: Number(payload.sub),
        success: false,
        reason: 'Refresh token expired or revoked',
      });
      throw new HttpError(401, 'Refresh token expired or revoked.', { clearCookies: true });
    }

    const user = await findAuthUserById(Number(payload.sub));
    if (!user) {
      throw new HttpError(401, 'User not found.', { clearCookies: true });
    }

    const sessionUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
    };

    const nextJti = crypto.randomUUID();
    const nextAccessToken = signAccessToken(sessionUser);
    const nextRefreshToken = signRefreshToken(sessionUser, nextJti);

    await revokeRefreshToken(payload.jti, nextJti);
    await persistRefreshToken(audit, user.id, nextJti, nextRefreshToken);
    await setCachedUserRoles(user.id, user.roles);
    await logAuthEvent(audit, 'REFRESH_SUCCESS', {
      userId: user.id,
      email: user.email,
      success: true,
      metadata: { previousJti: payload.jti, nextJti },
    });

    return {
      cookies: { accessToken: nextAccessToken, refreshToken: nextRefreshToken },
      body: {
        success: true as const,
        accessToken: nextAccessToken,
        tokenType: 'Bearer' as const,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    await logAuthEvent(audit, 'REFRESH_FAILED', {
      success: false,
      reason: 'Invalid refresh token payload/signature',
    });
    throw new HttpError(401, 'Invalid refresh token.', { clearCookies: true });
  }
};

export const logoutSession = async (refreshToken: string | undefined, audit: AuthAuditContext) => {
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
      const payload = toJwtAuthPayload(decoded);
      if (payload && payload.type === 'refresh' && payload.jti) {
        await revokeRefreshToken(payload.jti);
        await logAuthEvent(audit, 'LOGOUT', {
          userId: Number(payload.sub),
          email: payload.email,
          success: true,
          metadata: { jti: payload.jti },
        });
      }
    } catch {
      // Ignore invalid token on logout.
    }
  }

  return {
    clearCookies: true,
    body: { success: true as const },
  };
};

export const listUserSessions = async (input: {
  requesterId: number;
  requestedUserId: number;
  hasAdmin: boolean;
  currentJti: string | null;
}) => {
  const { requesterId, requestedUserId, hasAdmin, currentJti } = input;
  const targetUserId = hasAdmin ? requestedUserId : requesterId;

  const items = await listRefreshTokensForUser(targetUserId);

  return {
    body: {
      success: true as const,
      items: items.map((item) => ({
        jti: item.token_jti,
        userId: item.user_id,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
        revokedAt: item.revoked_at,
        replacedByJti: item.replaced_by_jti,
        userAgent: item.user_agent,
        ipAddress: item.ip_address,
        isCurrent: currentJti ? currentJti === item.token_jti : false,
      })),
    },
  };
};

export const revokeUserSession = async (input: {
  requesterId: number;
  jti: string;
  hasAdmin: boolean;
  actorEmail?: string;
  audit: AuthAuditContext;
}) => {
  const { requesterId, jti, hasAdmin, actorEmail, audit } = input;

  const sessionRow = await findRefreshTokenSession(jti);
  if (!sessionRow) {
    throw new HttpError(404, 'Session not found.');
  }

  if (!hasAdmin && Number(sessionRow.user_id) !== requesterId) {
    throw new HttpError(403, 'Forbidden.');
  }

  if (!sessionRow.revoked_at) {
    await revokeRefreshToken(jti);
  }

  await logAuthEvent(audit, 'SESSION_REVOKE', {
    userId: Number(sessionRow.user_id),
    email: actorEmail,
    success: true,
    metadata: { jti },
  });

  return { body: { success: true as const } };
};

export const revokeAllUserSessions = async (input: {
  requesterId: number;
  requestedUserId: number;
  hasAdmin: boolean;
  exceptCurrent: boolean;
  currentJti: string | null;
  actorEmail?: string;
  audit: AuthAuditContext;
}) => {
  const {
    requesterId,
    requestedUserId,
    hasAdmin,
    exceptCurrent,
    currentJti,
    actorEmail,
    audit,
  } = input;

  const targetUserId = hasAdmin ? requestedUserId : requesterId;

  const revokedCount = await revokeAllUserRefreshTokensExcept(
    targetUserId,
    exceptCurrent ? currentJti : null,
  );

  await logAuthEvent(audit, 'SESSION_REVOKE_ALL', {
    userId: targetUserId,
    email: actorEmail,
    success: true,
    metadata: { exceptCurrent, changed: revokedCount },
  });

  const clearCookies = !exceptCurrent || requesterId === targetUserId;

  return {
    clearCookies,
    body: { success: true as const, revokedCount },
  };
};
