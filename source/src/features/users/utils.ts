import type { HwyMemberFaceCaptionKind } from '../../domain/hwy/hwyMemberFaceCaptionDisplay';
import { resolveHwyAllocatedMembershipUsername } from '../../domain/hwy/hwyMembershipUsername';
import { resolveUserAvatarXsSrc } from '../../shared/api/contracts/users/avatar';
import { formatProfileDisplayName as formatSharedProfileDisplayName } from '../../shared/profile/profileDisplayName';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';

export const formatDateYmd = (value?: string | null) => formatDisplayDateYmd(value);

/** Uppercase + dedupe; empty selection is allowed (no implicit DEVELOPER). */
export const normalizeRoleSelection = (roles: string[]) => (
  Array.from(new Set(roles.map((role) => String(role).toUpperCase()).filter(Boolean)))
);

export const roleSelectionIncludes = (roles: readonly string[], role: string): boolean => {
  const normalizedRole = String(role).toUpperCase();
  return roles.some((entry) => String(entry).toUpperCase() === normalizedRole);
};

export const setRoleInSelection = (
  roles: readonly string[],
  role: string,
  checked: boolean,
): string[] => {
  const normalizedRole = String(role).toUpperCase();
  const hasRole = roleSelectionIncludes(roles, normalizedRole);
  if (checked && !hasRole) {
    return normalizeRoleSelection([...roles, normalizedRole]);
  }
  if (!checked && hasRole) {
    return normalizeRoleSelection(roles.filter((entry) => String(entry).toUpperCase() !== normalizedRole));
  }
  return normalizeRoleSelection([...roles]);
};

export const ADMIN_ROLE = 'ADMIN';

export const userHasAdminRole = (user: { roles: string[] }): boolean => (
  user.roles.some((role) => role.toUpperCase() === ADMIN_ROLE)
);

export const sortRolesForDisplay = (roles: ReadonlyArray<string>): string[] => {
  const unique = Array.from(new Set(
    roles.map((role) => String(role).toUpperCase()).filter(Boolean),
  ));
  const adminRoles = unique.filter((role) => role === ADMIN_ROLE);
  const otherRoles = unique
    .filter((role) => role !== ADMIN_ROLE)
    .sort((left, right) => left.localeCompare(right));
  return [...adminRoles, ...otherRoles];
};

export {
  abbreviateRoleLabel,
  getHashChipClass,
  getRoleChipClass,
  truncateChipLabel,
} from '../../shared/lib/hashChipPalette';

export const canManageUserRow = (): boolean => true;

export const canDeleteUserRecord = (user: { roles: string[] }): boolean => (
  !userHasAdminRole(user)
);

export const formatProfileDisplayName = (user: {
  person_type_code?: string | null;
  personTypeCode?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  company_name?: string | null;
  companyName?: string | null;
}) => formatSharedProfileDisplayName(user);

export type UserGridAvatarCaption = {
  text: string;
  kind: HwyMemberFaceCaptionKind;
};

/** Under-avatar label on Users grid: HWY membership UserName when linked, else platform login. */
export const resolveUserGridAvatarCaption = (user: {
  id: number;
  username: string;
  avatar_username?: string | null;
  legacy_hwy_username?: string | null;
  membership_username?: string | null;
}): UserGridAvatarCaption => {
  const membership = user.avatar_username?.trim()
    || user.legacy_hwy_username?.trim()
    || user.membership_username?.trim();
  if (membership) {
    return { text: membership, kind: 'username' };
  }
  const platform = resolveHwyAllocatedMembershipUsername(user.username, user.id);
  if (platform) {
    return { text: platform, kind: 'username' };
  }
  const fallback = user.username?.trim() || String(user.id);
  if (fallback) {
    return { text: fallback, kind: 'tracking' };
  }
  return { text: '—', kind: 'none' };
};

/** @deprecated Prefer {@link resolveUserGridAvatarCaption}. */
export const resolveUserGridAvatarUsername = (user: {
  id: number;
  username: string;
  avatar_username?: string | null;
  legacy_hwy_username?: string | null;
  membership_username?: string | null;
}): string => resolveUserGridAvatarCaption(user).text;

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

export { imageToJpegBase64, loadImageFile } from '../../shared/lib/fileFieldUtils';
