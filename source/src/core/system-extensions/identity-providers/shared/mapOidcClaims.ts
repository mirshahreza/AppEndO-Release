import type { NormalizedIdentityClaims } from '../../../../shared/api/contracts/systemExtensions/types';

const pickEmail = (raw: Record<string, unknown>): string | undefined => {
  if (typeof raw.email === 'string' && raw.email.includes('@')) {
    return raw.email.trim().toLowerCase();
  }
  if (typeof raw.preferred_username === 'string' && raw.preferred_username.includes('@')) {
    return raw.preferred_username.trim().toLowerCase();
  }
  if (typeof raw.upn === 'string' && raw.upn.includes('@')) {
    return raw.upn.trim().toLowerCase();
  }
  return undefined;
};

export const mapOidcClaims = (raw: Record<string, unknown>): NormalizedIdentityClaims => {
  const subject = String(raw.sub ?? '').trim();
  if (!subject) {
    throw new Error('OIDC profile is missing subject.');
  }

  return {
    subject,
    email: pickEmail(raw),
    emailVerified: raw.email_verified === true,
    givenName: typeof raw.given_name === 'string' ? raw.given_name : undefined,
    familyName: typeof raw.family_name === 'string' ? raw.family_name : undefined,
    displayName: typeof raw.name === 'string' ? raw.name : undefined,
    rawClaims: raw,
  };
};

export const mapMicrosoftClaims = (raw: Record<string, unknown>): NormalizedIdentityClaims => {
  const subject = String(raw.oid ?? raw.sub ?? '').trim();
  if (!subject) {
    throw new Error('Microsoft profile is missing subject.');
  }

  const email = pickEmail(raw);

  return {
    subject,
    email,
    emailVerified: raw.email_verified === true || Boolean(email),
    givenName: typeof raw.given_name === 'string' ? raw.given_name : undefined,
    familyName: typeof raw.family_name === 'string' ? raw.family_name : undefined,
    displayName: typeof raw.name === 'string' ? raw.name : undefined,
    rawClaims: raw,
  };
};
