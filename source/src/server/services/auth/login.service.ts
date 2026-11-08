import { comparePassword, hashPassword } from '../../utils/bcryptAsync';

import { NON_SELF_DELETABLE_ROLES } from '../../../shared/api/contracts/roles/constants';

import {
  clearLoginFailCount,
  deleteUser,
  deleteUserProfile,
  findAuthUserById,
  findAuthUserRecordById,
  findUserIdBuiltin,
  findUserPasswordHash,
  incrementLoginFailCount,
  revokeUserRefreshTokens,
  updateUserPasswordHash,
} from '../../domain/users/userRepository';
import { getCurrentUserProfile } from '../../domain/users/userProfileRepository';
import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import { setCachedUserRoles } from '../../domain/users/userRolesCache';

import { HttpError } from '../../errors/HttpError';

import type { AuthAuditContext } from '../../types/requestContext';

import { readAuthLockoutSettings } from '../settings/appSettings.service';

import { sendEmail } from '../email/email.service';

import {
  resolveAndCacheSessionContext,
} from '../attributes/sessionContext.service';

import {

  checkLoginRateLimit,

  clearLoginFailures,

  getLoginRateLimitKey,

  registerLoginFailure,

} from './loginAttempt.service';

import { issueSessionTokens } from './refreshToken.service';

import { logAuthEvent } from './sessionAudit.service';

import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './token.service';

import type { AuthUser } from './types';

import { readAuthOtpSettings } from './authSettings.service';

import {

  assertLoginMethodAllowed,

  normalizeLoginIdentifier,

  resolveUserByIdentifier,

} from './loginIdentifier.service';

import { completeLoginSession } from './loginSession.service';

import { createOtpChallenge, verifyOtpChallenge } from './otp.service';

import { assertEmailVerifiedForLogin } from './verification.service';



const attachSessionContext = async (userId: number, roles: string[]) => {
  const [{ clientContext }] = await Promise.all([
    resolveAndCacheSessionContext(userId, roles),
    setCachedUserRoles(userId, roles),
  ]);
  return clientContext;
};



export const login = async (input: {

  identifier?: string;

  email?: string;

  password: string;

  otpCode?: string;

  challengeId?: number;

  ip: string;

  audit: AuthAuditContext;

}) => {

  assertLoginMethodAllowed();



  const rawIdentifier = String(input.identifier || input.email || '').trim();

  const password = String(input.password || '');



  if (input.challengeId && input.otpCode) {

    return verifyLoginOtp({

      challengeId: Number(input.challengeId),

      otpCode: String(input.otpCode),

      audit: input.audit,

    });

  }



  if (!rawIdentifier || !password) {

    throw new HttpError(400, 'Identifier and password are required.');

  }



  const rateLimitKey = getLoginRateLimitKey(input.ip, rawIdentifier.toLowerCase());

  const rateLimitState = checkLoginRateLimit(rateLimitKey);

  if (rateLimitState.blocked) {

    await logAuthEvent(input.audit, 'LOGIN_RATE_LIMITED', {

      email: rawIdentifier,

      success: false,

      reason: 'Too many failed attempts',

      metadata: { retryAfterSeconds: rateLimitState.retryAfterSeconds },

    });

    throw new HttpError(429, 'Too many failed login attempts. Please retry later.', {

      retryAfterSeconds: rateLimitState.retryAfterSeconds,

    });

  }



  const { kind, user } = await resolveUserByIdentifier(rawIdentifier);

  const auditEmail = user?.email || (kind === 'email' ? normalizeLoginIdentifier(rawIdentifier, kind) : rawIdentifier);



  if (user?.locked) {

    await logAuthEvent(input.audit, 'LOGIN_BLOCKED', {

      email: auditEmail,

      userId: user.id,

      success: false,

      reason: 'Account locked',

    });

    throw new HttpError(403, 'Account is locked. Contact an administrator.');

  }



  if (!user || !(await comparePassword(password, user.password_hash))) {

    registerLoginFailure(rateLimitKey);

    if (user && !user.is_builtin) {

      const { enabled, maxFailures } = readAuthLockoutSettings();

      if (enabled) {

        await incrementLoginFailCount(user.id, maxFailures);

      }

    }

    await logAuthEvent(input.audit, 'LOGIN_FAILED', {

      email: auditEmail,

      userId: user?.id,

      success: false,

      reason: 'Invalid credentials',

    });

    throw new HttpError(401, 'Invalid credentials.');

  }



  clearLoginFailures(rateLimitKey);

  await clearLoginFailCount(user.id);



  await assertEmailVerifiedForLogin({

    userId: user.id,

    email: user.email,

    emailVerifiedAt: user.email_verified_at,

    audit: input.audit,

  });



  const otpSettings = readAuthOtpSettings();

  if (otpSettings.enabled && otpSettings.channelEmail && user.email) {

    const { challengeId, secret } = await createOtpChallenge({

      userId: user.id,

      purpose: 'LOGIN',

      channel: 'EMAIL',

      target: user.email,

      expirySeconds: otpSettings.expirySeconds,

      mode: 'numeric',

    });



    await sendEmail({

      to: user.email,

      subject: 'Your login verification code',

      text: `Your AppEndO login code is ${secret}. It expires in ${Math.ceil(otpSettings.expirySeconds / 60)} minutes.`,

    });



    await logAuthEvent(input.audit, 'OTP_SENT', {

      userId: user.id,

      email: user.email,

      success: true,

      metadata: { purpose: 'LOGIN', challengeId },

    });



    return {

      body: {

        success: true as const,

        requiresOtp: true as const,

        challengeId,

        message: 'Enter the verification code sent to your email.',

        maskedTarget: maskEmail(user.email),

      },

    };

  }



  const result = await completeLoginSession({ user, audit: input.audit });

  return result;

};



const verifyLoginOtp = async (input: {

  challengeId: number;

  otpCode: string;

  audit: AuthAuditContext;

}) => {

  const verified = await verifyOtpChallenge({

    challengeId: input.challengeId,

    secret: input.otpCode,

  });



  if (verified.purpose !== 'LOGIN') {

    throw new HttpError(400, 'Invalid verification code.');

  }



  const userRecord = await findAuthUserRecordById(verified.userId);

  if (!userRecord) {

    throw new HttpError(404, 'User not found.');

  }



  const user = {

    id: userRecord.id,

    email: userRecord.email,

    username: userRecord.username,

    role: userRecord.role,

    roles: userRecord.roles,

    locked: userRecord.locked,

    password_hash: userRecord.password_hash,

    is_builtin: userRecord.is_builtin,

    email_verified_at: userRecord.email_verified_at,

    mobile: userRecord.mobile,

  };



  await logAuthEvent(input.audit, 'OTP_VERIFIED', {

    userId: user.id,

    email: user.email,

    success: true,

    metadata: { purpose: 'LOGIN', challengeId: input.challengeId },

  });



  return completeLoginSession({

    user,

    audit: input.audit,

    auditMetadata: { otpChallengeId: input.challengeId },

  });

};



const maskEmail = (email: string): string => {

  const [local, domain] = email.split('@');

  if (!local || !domain) {

    return email;

  }

  const visible = local.slice(0, Math.min(2, local.length));

  return `${visible}***@${domain}`;

};



export const loginAs = async (input: {

  targetUserId: number;

  actorUserId?: number;

  actorEmail?: string;

  actorRoles?: string[];

  audit: AuthAuditContext;

}) => {

  const { targetUserId, actorUserId, actorEmail, actorRoles, audit } = input;

  const normalizedActorRoles = (actorRoles ?? []).map((role) => String(role).toUpperCase());
  if (!normalizedActorRoles.includes('ADMIN')) {
    throw new HttpError(403, 'Forbidden.');
  }

  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {

    throw new HttpError(400, 'Invalid target user id.');

  }



  const targetUser = await findAuthUserById(targetUserId);

  if (!targetUser) {

    throw new HttpError(404, 'Target user not found.');

  }



  const sessionUser: AuthUser = {

    id: targetUser.id,

    email: targetUser.email,

    role: targetUser.role,

    roles: targetUser.roles,

  };



  const { assertRequiredAttributesOrThrow } = await import('./loginSession.service');

  await assertRequiredAttributesOrThrow({

    userId: sessionUser.id,

    roles: sessionUser.roles,

    email: sessionUser.email,

    audit,

    auditEvent: 'LOGIN_BLOCKED',

  });



  const cookies = await issueSessionTokens(audit, sessionUser, {

    loginAs: true,

    actorUserId,

    actorEmail,

  });

  await logAuthEvent(audit, 'LOGIN_AS', {

    userId: sessionUser.id,

    email: sessionUser.email,

    success: true,

    metadata: {

      actorUserId,

      actorEmail,

      targetUserId: sessionUser.id,

      refreshTtlSeconds: REFRESH_TOKEN_TTL_SECONDS,

    },

  });

  const clientContext = await attachSessionContext(sessionUser.id, sessionUser.roles);



  return {

    cookies,

    body: {

      success: true as const,

      tokenType: 'Bearer' as const,

      expiresIn: ACCESS_TOKEN_TTL_SECONDS,

      user: {

        id: sessionUser.id,

        email: sessionUser.email,

        role: sessionUser.role,

        roles: sessionUser.roles,

      },

      clientContext,

    },

  };

};



export const changePassword = async (input: {

  userId: number;

  email?: string;

  currentPassword: string;

  newPassword: string;

  audit: AuthAuditContext;

}) => {

  const { userId, email, currentPassword, newPassword, audit } = input;



  if (!currentPassword || !newPassword) {

    throw new HttpError(400, 'currentPassword and newPassword are required.');

  }

  if (String(newPassword).length < 8) {

    throw new HttpError(400, 'New password must be at least 8 characters.');

  }



  const user = await findUserPasswordHash(userId);

  if (!user) {

    throw new HttpError(404, 'User not found.');

  }

  if (!(await comparePassword(String(currentPassword), user.password_hash))) {

    await logAuthEvent(audit, 'CHANGE_PASSWORD', {

      userId,

      email,

      success: false,

      reason: 'Current password mismatch',

    });

    throw new HttpError(401, 'Current password is incorrect.');

  }



  const newHash = await hashPassword(String(newPassword));

  await updateUserPasswordHash(newHash, userId);

  await revokeUserRefreshTokens(userId);

  await logAuthEvent(audit, 'CHANGE_PASSWORD', {

    userId,

    email,

    success: true,

  });



  return {

    clearCookies: true,

    body: {

      success: true as const,

      message: 'Password changed successfully. Please login again.',

    },

  };

};



export const deleteMyAccount = async (input: {

  userId: number;

  email?: string;

  password: string;

  audit: AuthAuditContext;

}) => {

  const { userId, email, password, audit } = input;



  if (!password) {

    throw new HttpError(400, 'password is required.');

  }



  const builtinUser = await findUserIdBuiltin(userId);

  if (!builtinUser) {

    throw new HttpError(404, 'User not found.');

  }

  if (builtinUser.is_builtin) {

    throw new HttpError(400, 'Built-in accounts cannot be deleted.');

  }



  const roles = await getUserRolesForRequest(userId);

  if (roles.some((role) => (NON_SELF_DELETABLE_ROLES as readonly string[]).includes(role))) {

    throw new HttpError(400, 'Accounts with ADMIN or DEVELOPER roles cannot be deleted.');

  }



  const user = await findUserPasswordHash(userId);

  if (!user) {

    throw new HttpError(404, 'User not found.');

  }

  if (!(await comparePassword(String(password), user.password_hash))) {

    await logAuthEvent(audit, 'DELETE_ACCOUNT', {

      userId,

      email,

      success: false,

      reason: 'Password mismatch',

    });

    throw new HttpError(401, 'Password is incorrect.');

  }



  await revokeUserRefreshTokens(userId);

  await deleteUserProfile(userId);

  await deleteUser(userId);



  await logAuthEvent(audit, 'DELETE_ACCOUNT', {

    userId,

    email,

    success: true,

  });



  return {

    clearCookies: true,

    body: {

      success: true as const,

      message: 'Your account and all associated data have been permanently deleted.',

    },

  };

};



export const getCurrentUser = async (userId: number, fallbackRole?: string) => {
  // Profile is display-only; roles + session context use CacheManager (TTL / invalidation).
  // Required attributes are enforced at login / login-as — not on every /me restore.
  const [profile, roles] = await Promise.all([
    getCurrentUserProfile(userId),
    getUserRolesForRequest(userId, fallbackRole),
  ]);

  if (!profile) {
    throw new HttpError(404, 'User not found.');
  }

  const role = roles[0] || fallbackRole || '';
  // Always rebuild on /me so shell identity (name/avatar) cannot stick on a stale cache after profile edits.
  const { clientContext } = await resolveAndCacheSessionContext(userId, roles);

  return {
    body: {
      success: true as const,
      user: { ...profile, role, roles },
      clientContext,
    },
  };
};



export { readAuthPublicConfig } from './authSettings.service';


