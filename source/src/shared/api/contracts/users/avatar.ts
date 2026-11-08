export const buildUserAvatarXsPath = (
  userId: number,
  cacheBust?: string | number | null,
): string => {
  const base = `/api/users/${userId}/avatar-xs`;
  if (cacheBust == null || String(cacheBust).length === 0) return base;
  return `${base}?v=${encodeURIComponent(String(cacheBust))}`;
};

export type UserAvatarSource = {
  id: number;
  has_profile_image_xs?: boolean;
  profile_image_size?: number | null;
  profile_updated_at?: string | null;
  updated_at?: string | null;
};

export const resolveUserAvatarCacheBust = (
  source: Pick<UserAvatarSource, 'profile_updated_at' | 'updated_at' | 'profile_image_size'>,
): string | number | null => {
  const updatedAt = source.profile_updated_at ?? source.updated_at;
  if (updatedAt) {
    const timestamp = Date.parse(updatedAt);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return source.profile_image_size ?? null;
};

export const resolveUserAvatarXsSrc = (source: UserAvatarSource): string | null => {
  if (!source.has_profile_image_xs) return null;
  return buildUserAvatarXsPath(source.id, resolveUserAvatarCacheBust(source));
};

export type ListUserAvatarSource = UserAvatarSource & {
  list_avatar_preview?: string | null;
  avatar_url?: string | null;
};

export const resolveListUserAvatarSrc = (source: ListUserAvatarSource): string | null => {
  if (source.list_avatar_preview) return source.list_avatar_preview;
  if (source.avatar_url) return source.avatar_url;
  return resolveUserAvatarXsSrc(source);
};
