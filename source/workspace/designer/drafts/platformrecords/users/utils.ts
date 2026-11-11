import { resolveUserAvatarXsSrc } from '@/src/shared/api/contracts/users/avatar';
import { BASE_ROLES } from '@/src/shared/api/contracts/roles/constants';

const ABBREVIATED_USER_GRID_ROLES = new Set<string>(BASE_ROLES);

export const formatDateYmd = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ensureRoles = (roles: string[]) => {
  const unique = Array.from(new Set(roles.map((role) => String(role).toUpperCase()).filter(Boolean)));
  return unique.length > 0 ? unique : ['USER'];
};

export const sortUserGridRoles = (roles: string[]): string[] => {
  const unique = Array.from(new Set(roles.map((role) => String(role).trim()).filter(Boolean)));
  const adminRoles = unique.filter((role) => role.toUpperCase() === 'ADMIN');
  const otherRoles = unique
    .filter((role) => role.toUpperCase() !== 'ADMIN')
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

  return [...adminRoles, ...otherRoles];
};

export const isAbbreviatedUserGridRole = (role: string): boolean => (
  ABBREVIATED_USER_GRID_ROLES.has(role.trim().toUpperCase())
);

export const formatUserGridRoleLabel = (role: string): string => (
  isAbbreviatedUserGridRole(role) ? role.trim().charAt(0).toUpperCase() : role
);

export const USER_GRID_EXTRA_ROLE_MAX_LABEL_LENGTH = 6;

export const partitionUserGridRoles = (roles: string[]): {
  baseRoles: string[];
  extraRoles: string[];
} => {
  const unique = Array.from(new Set(roles.map((role) => String(role).trim()).filter(Boolean)));
  const roleByUpper = new Map(unique.map((role) => [role.toUpperCase(), role] as const));

  const baseRoles = BASE_ROLES
    .filter((role) => roleByUpper.has(role))
    .map((role) => roleByUpper.get(role) ?? role);

  const extraRoles = unique
    .filter((role) => !isAbbreviatedUserGridRole(role))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

  return { baseRoles, extraRoles };
};

export const formatUserGridExtraRoleLabel = (role: string): string | null => {
  const trimmed = role.trim();
  if (trimmed.length > USER_GRID_EXTRA_ROLE_MAX_LABEL_LENGTH) {
    return null;
  }
  return trimmed;
};

export const getUserGridRoleChipClass = (role: string): string => {
  switch (role.trim().toUpperCase()) {
    case 'ADMIN':
      return 'bg-indigo-100 text-indigo-700';
    case 'USER':
      return 'bg-slate-100 text-slate-600';
    case 'DEVELOPER':
      return 'bg-cyan-100 text-cyan-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export const isSelfBuiltinAdminUser = (
  user: { id?: number; is_builtin?: boolean },
  currentUserId?: number,
): boolean => (
  Boolean(user.is_builtin)
    && currentUserId != null
    && user.id != null
    && currentUserId === user.id
);

export const userHasRestrictedActions = (
  user: { id?: number; is_builtin?: boolean },
  currentUserId?: number,
): boolean => (
  Boolean(user.is_builtin) && !isSelfBuiltinAdminUser(user, currentUserId)
);

export const userHasDeleteRestricted = (user: { is_builtin?: boolean }): boolean => (
  Boolean(user.is_builtin)
);

export const formatProfileDisplayName = (user: {
  firstname?: string | null;
  lastname?: string | null;
}) => {
  const parts = [user.firstname, user.lastname]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

export const getProfileImageSrc = (
  profile: {
    avatar_url?: string | null;
    has_profile_image_xs?: boolean;
    id?: number;
    profile_image_size?: number | null;
    profile_updated_at?: string | null;
    updated_at?: string | null;
    profile_image_xs_base64?: string | null;
    profile_image_base64?: string | null;
    profile_image_mime?: string | null;
  } | null | undefined,
  variant: 'xs' | 'full' = 'xs',
) => {
  if (variant === 'xs') {
    if (profile?.id == null) return null;
    return resolveUserAvatarXsSrc({
      id: profile.id,
      has_profile_image_xs: profile.has_profile_image_xs,
      profile_image_size: profile.profile_image_size,
      profile_updated_at: profile.profile_updated_at,
      updated_at: profile.updated_at,
    });
  }
  const base64 = variant === 'full'
    ? profile?.profile_image_base64
    : profile?.profile_image_xs_base64;
  if (!base64) return null;
  const mime = profile?.profile_image_mime || 'image/jpeg';
  return `data:${mime};base64,${base64}`;
};

export const formatBirthDate = (profile: {
  birth_year?: string | null;
  birth_month?: string | null;
  birth_day?: string | null;
}) => {
  const parts = [profile.birth_year, profile.birth_month, profile.birth_day]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join('/') : null;
};

export const formatMonthYear = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export { imageToJpegBase64, loadImageFile } from '@/src/shared/lib/fileFieldUtils';
