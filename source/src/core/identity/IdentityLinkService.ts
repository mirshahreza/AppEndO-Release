import { findAuthUserByEmail } from '../../server/domain/users/userRepository';
import { HttpError } from '../../server/errors/HttpError';
import type { IdentityProviderConfig } from '../../shared/api/contracts/auth/identityProviders';
import type { NormalizedIdentityClaims } from '../../shared/api/contracts/systemExtensions/types';
import type { ResolvedLoginUser } from '../../server/services/auth/loginIdentifier.service';
import {
  createUserIdentity,
  findUserIdentityRowByProviderSubject,
  listUserIdentitiesForUser,
  touchUserIdentityLogin,
} from '../../server/domain/auth/userIdentityRepository';
import { findAuthUserRecordById } from '../../server/domain/users/userRepository';
import { provisionOAuthUser } from './AccountProvisioner';

export type OAuthLinkResult =
  | { kind: 'login'; userId: number }
  | { kind: 'denied'; code: 'oauth_no_account' | 'oauth_link_denied' };

export const resolveOAuthUserLink = async (input: {
  provider: IdentityProviderConfig;
  claims: NormalizedIdentityClaims;
  actorId?: number | null;
}): Promise<OAuthLinkResult> => {
  const existing = await findUserIdentityRowByProviderSubject(
    input.provider.id,
    input.claims.subject,
  );

  if (existing) {
    await touchUserIdentityLogin(existing.id);
    return { kind: 'login', userId: existing.user_id };
  }

  const email = input.claims.email?.trim().toLowerCase();
  if (email) {
    const user = await findAuthUserByEmail(email);
    if (user) {
      if (!input.claims.emailVerified) {
        return { kind: 'denied', code: 'oauth_link_denied' };
      }
      await createUserIdentity({
        userId: user.id,
        providerId: input.provider.id,
        providerKind: input.provider.kind,
        subject: input.claims.subject,
        email: input.claims.email ?? null,
        emailVerified: input.claims.emailVerified,
        profileJson: input.claims.rawClaims ? JSON.stringify(input.claims.rawClaims) : null,
        actorId: input.actorId,
      });
      return { kind: 'login', userId: user.id };
    }
  }

  if (!input.provider.autoProvision) {
    return { kind: 'denied', code: 'oauth_no_account' };
  }

  const userId = await provisionOAuthUser({
    provider: input.provider,
    claims: input.claims,
    actorId: input.actorId,
  });
  await createUserIdentity({
    userId,
    providerId: input.provider.id,
    providerKind: input.provider.kind,
    subject: input.claims.subject,
    email: input.claims.email ?? null,
    emailVerified: input.claims.emailVerified,
    profileJson: input.claims.rawClaims ? JSON.stringify(input.claims.rawClaims) : null,
    actorId: input.actorId,
  });
  return { kind: 'login', userId };
};

export const resolveLoginUserById = async (userId: number): Promise<ResolvedLoginUser> => {
  const user = await findAuthUserRecordById(userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    roles: user.roles,
    locked: user.locked,
    password_hash: user.password_hash,
    is_builtin: user.is_builtin,
    email_verified_at: user.email_verified_at,
    mobile: user.mobile,
  };
};

export type LinkedIdentitySummary = {
  providerId: string;
  providerKind: string;
  providerLabel: string;
  linkedAt: string;
};

export const listLinkedIdentitiesForUser = async (
  userId: number,
  providerLabels: Map<string, string>,
): Promise<LinkedIdentitySummary[]> => {
  const identities = await listUserIdentitiesForUser(userId);

  return identities.map((item) => ({
    providerId: item.provider_id,
    providerKind: item.provider_kind,
    providerLabel: providerLabels.get(item.provider_id) || item.provider_kind,
    linkedAt: item.linked_at?.toISOString?.() ?? String(item.linked_at ?? ''),
  }));
};
