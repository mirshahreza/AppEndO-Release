import type { Request, Response } from 'express';
import { logger } from '../../core/logging/Logger';
import { REFRESH_COOKIE_NAME } from '../constants/auth';
import { isHttpError } from '../errors/HttpError';
import { getCurrentRefreshJti, hasAdminRole, normalizeAuthRoles } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { applyAuthSideEffects } from '../utils/authCookies';
import { sendHttpError } from '../utils/controllerHttp';
import { toAuthAuditContext } from '../utils/requestContext';

const clearAuthCookiesOnError = (error: unknown, res: Response) => {
  if (isHttpError(error) && error.body.clearCookies) {
    applyAuthSideEffects(res, { clearCookies: true });
  }
};

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const { identifier, email, password, otpCode, challengeId } = req.body || {};
    const result = await this.authService.login({
      identifier: identifier !== undefined ? String(identifier) : undefined,
      email: email !== undefined ? String(email) : undefined,
      password: String(password || ''),
      otpCode: otpCode !== undefined ? String(otpCode) : undefined,
      challengeId: challengeId !== undefined ? Number(challengeId) : undefined,
      ip: req.ip || 'unknown-ip',
      audit: toAuthAuditContext(req),
    });
    if ('cookies' in result) {
      applyAuthSideEffects(res, result);
    }
    res.json(result.body);
  }, 'Internal server error.', {
    onError: (error, _req, res) => {
      clearAuthCookiesOnError(error, res);
      if (isHttpError(error)) {
        sendHttpError(res, error, 'Internal server error.');
        return true;
      }
      logger.error('AuthAPI', 'Unhandled login error', { error });
      res.status(500).json({ success: false, error: 'Internal server error.' });
      return true;
    },
  });

  getPublicConfig = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.authService.getPublicConfig();
    res.set('Cache-Control', 'no-store');
    res.json(result.body);
  }, 'Failed to read auth config.');

  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, username, password, firstName, lastName, termsAccepted } = req.body || {};
    const result = await this.authService.register({
      email: String(email || ''),
      username: username !== undefined ? String(username) : undefined,
      password: String(password || ''),
      firstName: firstName !== undefined ? String(firstName) : undefined,
      lastName: lastName !== undefined ? String(lastName) : undefined,
      termsAccepted: Boolean(termsAccepted),
      audit: toAuthAuditContext(req),
    });
    res.status(201).json(result.body);
  }, 'Registration failed.');

  resendVerification = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body || {};
    const result = await this.authService.resendVerification({
      email: String(email || ''),
      audit: toAuthAuditContext(req),
    });
    res.json(result.body);
  }, 'Failed to resend verification email.');

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body || {};
    const result = await this.authService.forgotPassword({
      email: String(email || ''),
      audit: toAuthAuditContext(req),
    });
    res.json(result.body);
  }, 'Failed to request password reset.');

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, challengeId, newPassword } = req.body || {};
    const result = await this.authService.resetPassword({
      token: String(token || ''),
      challengeId: challengeId !== undefined ? Number(challengeId) : undefined,
      newPassword: String(newPassword || ''),
      audit: toAuthAuditContext(req),
    });
    res.json(result.body);
  }, 'Failed to reset password.');

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.body?.token || req.query.token || '');
    const challengeIdRaw = req.body?.challengeId ?? req.query.challenge;
    const result = await this.authService.verifyEmail({
      token,
      challengeId: challengeIdRaw !== undefined ? Number(challengeIdRaw) : undefined,
      audit: toAuthAuditContext(req),
    });
    res.json(result.body);
  }, 'Failed to verify email.');

  loginAs = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.authService.loginAs({
      targetUserId: Number(req.params.id),
      actorUserId: req.auth?.userId,
      actorEmail: req.auth?.email,
      actorRoles: normalizeAuthRoles(req),
      audit: toAuthAuditContext(req),
    });
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Failed to login as target user.');

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.authService.refresh(refreshToken, toAuthAuditContext(req));
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Invalid refresh token.', {
    onError: (error, _req, res) => {
      clearAuthCookiesOnError(error, res);
      return false;
    },
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.authService.logout(refreshToken, toAuthAuditContext(req));
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Failed to logout.');

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    const result = await this.authService.changePassword({
      userId,
      email: req.auth?.email,
      currentPassword: String(currentPassword || ''),
      newPassword: String(newPassword || ''),
      audit: toAuthAuditContext(req),
    });
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Failed to change password.');

  deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const { password } = req.body || {};
    const result = await this.authService.deleteMyAccount({
      userId,
      email: req.auth?.email,
      password: String(password || ''),
      audit: toAuthAuditContext(req),
    });
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Failed to delete account.', {
    onError: (error, _req, res) => {
      clearAuthCookiesOnError(error, res);
      return false;
    },
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.json({
        success: false,
        canRestoreSession: Boolean(getCurrentRefreshJti(req)),
      });
      return;
    }

    const result = await this.authService.me(userId, req.auth?.role);
    res.json(result.body);
  }, 'Failed to read current user.');

  context = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const includeServer = String(req.query.include || '').toLowerCase() === 'server';
    const result = await this.authService.getContext(userId, req.auth?.role, includeServer);
    res.json(result.body);
  }, 'Failed to read session context.');

  listSessions = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = req.auth?.userId;
    if (!requesterId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.authService.listSessions({
      requesterId,
      requestedUserId: Number(req.query.userId || requesterId),
      hasAdmin: hasAdminRole(req),
      currentJti: getCurrentRefreshJti(req),
    });
    res.json(result.body);
  }, 'Failed to list sessions.');

  revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = req.auth?.userId;
    if (!requesterId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const result = await this.authService.revokeSession({
      requesterId,
      jti: String(req.params.jti || ''),
      hasAdmin: hasAdminRole(req),
      actorEmail: req.auth?.email,
      audit: toAuthAuditContext(req),
    });
    res.json(result.body);
  }, 'Failed to revoke session.');

  revokeAllSessions = asyncHandler(async (req: Request, res: Response) => {
    const requesterId = req.auth?.userId;
    if (!requesterId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const exceptCurrent = String(req.query.exceptCurrent || 'false') === 'true';
    const result = await this.authService.revokeAllSessions({
      requesterId,
      requestedUserId: Number(req.query.userId || requesterId),
      hasAdmin: hasAdminRole(req),
      exceptCurrent,
      currentJti: exceptCurrent ? getCurrentRefreshJti(req) : null,
      actorEmail: req.auth?.email,
      audit: toAuthAuditContext(req),
    });
    applyAuthSideEffects(res, result);
    res.json(result.body);
  }, 'Failed to revoke sessions.');

  myAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const result = await this.authService.myAuditLogs(userId, limit);
    res.json(result.body);
  }, 'Failed to list audit logs.');

  adminAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const result = await this.authService.adminAuditLogs(limit, userId);
    res.json(result.body);
  }, 'Failed to list audit logs.');
}
