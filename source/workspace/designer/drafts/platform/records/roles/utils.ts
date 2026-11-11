import { BASE_ROLES } from './constants';

export const formatDateYmd = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 10);
};

export const isBaseRole = (name: string) => (BASE_ROLES as readonly string[]).includes(name);

export const isAdminRoleName = (name: string): boolean => name.toUpperCase() === 'ADMIN';

export const getMutationError = (
  data: { success?: boolean; error?: string },
  fallback: string,
): string | null => {
  if (data.success) {
    return null;
  }
  return typeof data.error === 'string' ? data.error : fallback;
};
