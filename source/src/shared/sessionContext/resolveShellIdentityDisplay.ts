import { formatProfileDisplayName } from '../profile/profileDisplayName';
import { resolveUserAvatarXsSrc } from '../api/contracts/users/avatar';
import { SESSION_CONTEXT_IDENTITY_META_KEYS } from '../api/contracts/settings/sessionContext';

export type ShellIdentityDisplay = {
  id: number | null;
  username: string | null;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  company_name: string | null;
  person_type_code: string | null;
  has_profile_image: boolean;
  has_profile_image_xs: boolean;
  profile_updated_at: string | null;
  displayName: string;
  avatarInitial: string;
  avatarXs: string | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asBoolean = (value: unknown): boolean => (
  value === true
  || value === 1
  || value === '1'
  || value === 'true'
);

const readContextValue = (
  context: Record<string, unknown>,
  ...keys: string[]
): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return context[key];
    }
  }
  return undefined;
};

/**
 * Shell chrome identity from clientContext only.
 * Prefers first name + last name (or company) for the label; avatar from profile image flags.
 */
export const resolveShellIdentityDisplay = (
  clientContext: Record<string, unknown>,
  options?: { fallbackUserId?: number | null },
): ShellIdentityDisplay => {
  const firstname = asString(readContextValue(clientContext, 'user.firstname', 'firstname'));
  const lastname = asString(readContextValue(clientContext, 'user.lastname', 'lastname'));
  const company_name = asString(readContextValue(clientContext, 'user.company_name', 'company_name'));
  const person_type_code = asString(readContextValue(clientContext, 'user.person_type_code', 'person_type_code'));
  const username = asString(readContextValue(clientContext, 'user.username', 'username'));
  const email = asString(readContextValue(clientContext, 'user.email', 'email'));
  const hasImage = asBoolean(readContextValue(clientContext, 'user.profile_image', 'profile_image'))
    || asBoolean(readContextValue(
      clientContext,
      SESSION_CONTEXT_IDENTITY_META_KEYS.hasProfileImageXs,
      'user.has_profile_image_xs',
    ));
  const profile_updated_at = asString(readContextValue(
    clientContext,
    SESSION_CONTEXT_IDENTITY_META_KEYS.profileUpdatedAt,
    'user.profile_updated_at',
  ));
  const id = asNumber(readContextValue(clientContext, 'user.id', 'id'))
    ?? (options?.fallbackUserId && options.fallbackUserId > 0 ? options.fallbackUserId : null);

  const personName = [firstname, lastname].filter(Boolean).join(' ').trim();
  const fromProfile = formatProfileDisplayName({
    firstname,
    lastname,
    company_name,
    person_type_code,
  });
  const displayName = fromProfile || personName || username || email || 'User';
  const avatarInitial = (
    firstname
    || displayName
    || username
    || email
    || '?'
  ).slice(0, 1).toUpperCase();

  const avatarXs = id == null
    ? null
    : resolveUserAvatarXsSrc({
      id,
      has_profile_image_xs: hasImage,
      profile_updated_at,
    });

  return {
    id,
    username,
    email,
    firstname,
    lastname,
    company_name,
    person_type_code,
    has_profile_image: hasImage,
    has_profile_image_xs: hasImage,
    profile_updated_at,
    displayName,
    avatarInitial,
    avatarXs,
  };
};
