import {
  findAuthUserByEmail,
  findAuthUserByMobile,
  findAuthUserByUsername,
} from '../../domain/users/userRepository';
import { HttpError } from '../../errors/HttpError';
import { readAuthLoginSettings, type AuthLoginSettings } from './authSettings.service';

export type LoginIdentifierKind = 'email' | 'username' | 'mobile';

export type ResolvedLoginUser = {
  id: number;
  email: string;
  username: string;
  role: string;
  roles: string[];
  locked: boolean;
  password_hash: string;
  is_builtin: boolean;
  email_verified_at: string | null;
  mobile: string | null;
};

const MOBILE_PATTERN = /^\+?\d[\d\s-]{6,}$/;

export const detectIdentifierKind = (
  identifier: string,
  settings: AuthLoginSettings = readAuthLoginSettings(),
): LoginIdentifierKind | null => {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('@')) {
    return settings.allowEmail ? 'email' : null;
  }

  if (MOBILE_PATTERN.test(trimmed)) {
    return settings.allowMobile ? 'mobile' : null;
  }

  return settings.allowUsername ? 'username' : null;
};

export const normalizeLoginIdentifier = (
  identifier: string,
  kind: LoginIdentifierKind,
): string => {
  const trimmed = identifier.trim();
  if (kind === 'email') {
    return trimmed.toLowerCase();
  }
  if (kind === 'username') {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/\s+/g, '');
};

export const resolveUserByIdentifier = async (
  identifier: string,
): Promise<{ kind: LoginIdentifierKind; user: ResolvedLoginUser | undefined }> => {
  const settings = readAuthLoginSettings();
  const kind = detectIdentifierKind(identifier, settings);

  if (!kind) {
    throw new HttpError(400, 'This login method is not allowed.');
  }

  const normalized = normalizeLoginIdentifier(identifier, kind);
  let user: ResolvedLoginUser | undefined;

  if (kind === 'email') {
    user = await findAuthUserByEmail(normalized) as ResolvedLoginUser | undefined;
  } else if (kind === 'username') {
    user = await findAuthUserByUsername(normalized) as ResolvedLoginUser | undefined;
  } else {
    user = await findAuthUserByMobile(normalized) as ResolvedLoginUser | undefined;
  }

  return { kind, user };
};

export const assertLoginMethodAllowed = (settings: AuthLoginSettings = readAuthLoginSettings()) => {
  if (!settings.allowUsername && !settings.allowEmail && !settings.allowMobile) {
    throw new HttpError(503, 'No login methods are enabled in settings.');
  }
};
