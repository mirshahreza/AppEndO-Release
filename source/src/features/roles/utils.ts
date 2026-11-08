import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';

export const formatDateYmd = (value: string) => formatDisplayDateYmd(value);

export const getMutationError = (
  data: { success?: boolean; error?: string },
  fallback: string,
): string | null => {
  if (data.success) {
    return null;
  }
  return typeof data.error === 'string' ? data.error : fallback;
};
