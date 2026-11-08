export type { AuthUser, AuthAuditEvent, SessionCookies } from './auth/types';
export { logAuthEvent } from './auth/sessionAudit.service';

import type { AuthAuditContext } from '../types/requestContext';
import * as authLoginService from './auth/login.service';
import * as authPasswordRecoveryService from './auth/passwordRecovery.service';
import * as authRegistrationService from './auth/registration.service';
import * as authSessionAuditService from './auth/sessionAudit.service';
import * as authRefreshTokenService from './auth/refreshToken.service';
import * as authVerificationService from './auth/verification.service';
import { getAuthContext } from './attributes/sessionContext.service';
import { readAuthPublicConfig } from './auth/authSettings.service';

export class AuthService {
  getPublicConfig() {
    return {
      body: {
        success: true as const,
        config: readAuthPublicConfig(),
      },
    };
  }

  async login(input: {
    identifier?: string;
    email?: string;
    password: string;
    otpCode?: string;
    challengeId?: number;
    ip: string;
    audit: AuthAuditContext;
  }) {
    return authLoginService.login(input);
  }

  async register(input: {
    email: string;
    username?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    termsAccepted?: boolean;
    audit: AuthAuditContext;
  }) {
    return authRegistrationService.registerUser(input);
  }

  async resendVerification(input: { email: string; audit: AuthAuditContext }) {
    return authRegistrationService.resendVerificationEmail(input);
  }

  async forgotPassword(input: { email: string; audit: AuthAuditContext }) {
    return authPasswordRecoveryService.requestPasswordReset(input);
  }

  async resetPassword(input: {
    token: string;
    challengeId?: number;
    newPassword: string;
    audit: AuthAuditContext;
  }) {
    return authPasswordRecoveryService.resetPasswordWithToken(input);
  }

  async verifyEmail(input: {
    token: string;
    challengeId?: number;
    audit: AuthAuditContext;
  }) {
    return authVerificationService.verifyEmailToken(input);
  }

  async loginAs(input: {
    targetUserId: number;
    actorUserId?: number;
    actorEmail?: string;
    actorRoles?: string[];
    audit: AuthAuditContext;
  }) {
    return authLoginService.loginAs(input);
  }

  async refresh(refreshToken: string | undefined, audit: AuthAuditContext) {
    return authRefreshTokenService.refreshSession(refreshToken, audit);
  }

  async logout(refreshToken: string | undefined, audit: AuthAuditContext) {
    return authRefreshTokenService.logoutSession(refreshToken, audit);
  }

  async changePassword(input: {
    userId: number;
    email?: string;
    currentPassword: string;
    newPassword: string;
    audit: AuthAuditContext;
  }) {
    return authLoginService.changePassword(input);
  }

  async deleteMyAccount(input: {
    userId: number;
    email?: string;
    password: string;
    audit: AuthAuditContext;
  }) {
    return authLoginService.deleteMyAccount(input);
  }

  async me(userId: number, fallbackRole?: string) {
    return authLoginService.getCurrentUser(userId, fallbackRole);
  }

  async getContext(userId: number, fallbackRole?: string, includeServer = false) {
    return getAuthContext(userId, fallbackRole, includeServer);
  }

  async listSessions(input: {
    requesterId: number;
    requestedUserId: number;
    hasAdmin: boolean;
    currentJti: string | null;
  }) {
    return authRefreshTokenService.listUserSessions(input);
  }

  async revokeSession(input: {
    requesterId: number;
    jti: string;
    hasAdmin: boolean;
    actorEmail?: string;
    audit: AuthAuditContext;
  }) {
    return authRefreshTokenService.revokeUserSession(input);
  }

  async revokeAllSessions(input: {
    requesterId: number;
    requestedUserId: number;
    hasAdmin: boolean;
    exceptCurrent: boolean;
    currentJti: string | null;
    actorEmail?: string;
    audit: AuthAuditContext;
  }) {
    return authRefreshTokenService.revokeAllUserSessions(input);
  }

  async myAuditLogs(userId: number, limit: number) {
    const items = await authSessionAuditService.fetchMyAuditLogs(userId, limit);
    return {
      body: {
        success: true as const,
        items,
      },
    };
  }

  async adminAuditLogs(limit: number, userId: number | null) {
    const items = await authSessionAuditService.fetchAdminAuditLogs(limit, userId);
    return {
      body: {
        success: true as const,
        items,
      },
    };
  }
}
