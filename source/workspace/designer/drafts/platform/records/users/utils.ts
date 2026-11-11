import { resolveUserAvatarXsSrc } from '@/shared/api/contracts/users/avatar';

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

export const userHasAdminRole = (user: { roles: string[] }): boolean => (
  user.roles.some((role) => role.toUpperCase() === 'ADMIN')
);

export const userHasRestrictedActions = (user: { is_builtin?: boolean; roles: string[] }): boolean => (
  Boolean(user.is_builtin) || userHasAdminRole(user)
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

export { imageToJpegBase64, loadImageFile } from '@/shared/lib/fileFieldUtils';
