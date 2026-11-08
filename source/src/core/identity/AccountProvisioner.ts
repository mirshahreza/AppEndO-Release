import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assignUserRoles, validateRoles } from '../../server/domain/users/userRoleRepository';
import {
  findAuthUserByEmail,
  findUserIdByUsername,
  insertUser,
  updateUserEmailVerifiedAt,
} from '../../server/domain/users/userRepository';
import { HttpError } from '../../server/errors/HttpError';
import { normalizeProfilePayload } from '../../server/utils/profilePayload';
import { upsertUserProfile } from '../../server/services/users/userProfile.service';
import { readAuthRegistrationSettings } from '../../server/services/auth/authSettings.service';
import type { IdentityProviderConfig } from '../../shared/api/contracts/auth/identityProviders';
import type { NormalizedIdentityClaims } from '../../shared/api/contracts/systemExtensions/types';

const buildRandomPasswordHash = (): string => {
  const secret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hashSync(secret, 10);
};

const resolveUsernameBase = (email: string | undefined, subject: string): string => {
  const fromEmail = email?.split('@')[0]?.trim().toLowerCase();
  const base = (fromEmail || `user-${subject}`).replace(/[^a-z0-9_-]/g, '').slice(0, 48);
  return base || `user-${subject}`.slice(0, 48);
};

const resolveUniqueUsername = async (base: string): Promise<string> => {
  let candidate = base;
  let suffix = 1;
  while (await findUserIdByUsername(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
};

export const provisionOAuthUser = async (input: {
  provider: IdentityProviderConfig;
  claims: NormalizedIdentityClaims;
  actorId?: number | null;
}): Promise<number> => {
  const roleId = (
    input.provider.defaultRoleId?.trim()
    || readAuthRegistrationSettings().defaultRole
  ).toUpperCase();

  const validation = await validateRoles([roleId]);
  if (validation.invalid.length > 0) {
    throw new HttpError(500, 'Identity provider default role is invalid.');
  }

  const email = input.claims.email?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, 'External account does not include an email address.');
  }

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const username = await resolveUniqueUsername(resolveUsernameBase(email, input.claims.subject));
  const passwordHash = buildRandomPasswordHash();
  await insertUser(username, email, passwordHash, input.actorId ?? null);
  const inserted = await findUserIdByUsername(username);
  const userId = Number(inserted?.id || 0);
  if (!userId) {
    throw new HttpError(500, 'Failed to provision account.');
  }

  await assignUserRoles(userId, [roleId]);

  if (input.claims.emailVerified) {
    await updateUserEmailVerifiedAt(userId);
  }

  if (input.claims.givenName || input.claims.familyName) {
    const profile = normalizeProfilePayload({
      firstname: input.claims.givenName ?? null,
      lastname: input.claims.familyName ?? null,
    });
    await upsertUserProfile(userId, profile, input.actorId ?? null, { useNullFallbackForImages: true });
  }

  return userId;
};
