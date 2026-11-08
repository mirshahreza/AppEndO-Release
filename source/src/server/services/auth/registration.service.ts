import { hashPassword } from '../../utils/bcryptAsync';
import {
  findAuthUserByEmail,
  findUserIdByUsername,
  insertUser,
} from '../../domain/users/userRepository';
import { assignUserRoles, validateRoles } from '../../domain/users/userRoleRepository';
import { HttpError } from '../../errors/HttpError';
import type { AuthAuditContext } from '../../types/requestContext';
import { normalizeProfilePayload, hasProfilePayloadValue } from '../../utils/profilePayload';
import { upsertUserProfile } from '../users/userProfile.service';
import {
  readAuthRegistrationSettings,
  readAuthVerificationSettings,
} from './authSettings.service';
import { logAuthEvent } from './sessionAudit.service';
import { sendVerificationEmail } from './verification.service';

export const registerUser = async (input: {
  email: string;
  username?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  termsAccepted?: boolean;
  audit: AuthAuditContext;
}) => {
  const registration = readAuthRegistrationSettings();
  if (!registration.enabled) {
    throw new HttpError(403, 'Public registration is disabled.');
  }

  if (registration.requireTerms && !input.termsAccepted) {
    throw new HttpError(400, 'You must accept the terms to register.');
  }

  const email = input.email.trim().toLowerCase();
  const password = String(input.password || '');

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    await logAuthEvent(input.audit, 'REGISTER_FAILED', {
      email,
      success: false,
      reason: 'Email already registered',
    });
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const validation = await validateRoles([registration.defaultRole]);
  if (validation.invalid.length > 0) {
    throw new HttpError(500, 'Registration default role is invalid.');
  }

  const resolvedUsername = (input.username?.trim().toLowerCase() || email.split('@')[0] || '').trim();
  if (!resolvedUsername) {
    throw new HttpError(400, 'Username could not be resolved.');
  }

  const hash = await hashPassword(password);
  await insertUser(resolvedUsername, email, hash, null);
  const insertedUser = await findUserIdByUsername(resolvedUsername);
  const userId = Number(insertedUser?.id || 0);
  if (!userId) {
    throw new HttpError(500, 'Failed to create account.');
  }

  await assignUserRoles(userId, [registration.defaultRole]);

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const profile = normalizeProfilePayload({ firstname: firstName || null, lastname: lastName || null });
  if (hasProfilePayloadValue(profile)) {
    await upsertUserProfile(userId, profile, null, { useNullFallbackForImages: true });
  }

  const verification = readAuthVerificationSettings();
  if (verification.emailVerifyEnabled) {
    await sendVerificationEmail({ userId, email, audit: input.audit });
  }

  await logAuthEvent(input.audit, 'REGISTER_SUCCESS', {
    userId,
    email,
    success: true,
    metadata: { defaultRole: registration.defaultRole },
  });

  return {
    body: {
      success: true as const,
      message: verification.emailVerifyEnabled
        ? 'Account created. Check your email to verify your address before signing in.'
        : 'Account created successfully. You can sign in now.',
      requiresEmailVerification: verification.emailVerifyEnabled,
    },
  };
};

export const resendVerificationEmail = async (input: {
  email: string;
  audit: AuthAuditContext;
}) => {
  const verification = readAuthVerificationSettings();
  if (!verification.emailVerifyEnabled) {
    throw new HttpError(400, 'Email verification is disabled.');
  }

  const email = input.email.trim().toLowerCase();
  const user = await findAuthUserByEmail(email);
  if (!user) {
    return {
      body: {
        success: true as const,
        message: 'If an account exists for this email, a verification message has been sent.',
      },
    };
  }

  if (user.email_verified_at) {
    return {
      body: {
        success: true as const,
        message: 'This email address is already verified.',
      },
    };
  }

  await sendVerificationEmail({ userId: user.id, email, audit: input.audit });

  return {
    body: {
      success: true as const,
      message: 'If an account exists for this email, a verification message has been sent.',
    },
  };
};
