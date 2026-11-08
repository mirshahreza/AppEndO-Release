import { apiFetch, apiGet, apiPut, reportApiError } from '../api/client';
import {
  parseDashboardLayout,
  type DashboardLayoutPreference,
} from './userDashboardLayout';

const DASHBOARD_LAYOUT_PATH = '/api/profile/me/dashboard-layout';
const DASHBOARD_LAYOUT_CACHE_PREFIX = 'appendo:dashboard-layout:';

type DashboardLayoutCache = {
  layout: DashboardLayoutPreference;
  dirty: boolean;
};

const cacheKey = (userId: number): string => `${DASHBOARD_LAYOUT_CACHE_PREFIX}${userId}`;

const readCache = (userId: number): DashboardLayoutCache | null => {
  if (typeof window === 'undefined' || !Number.isInteger(userId) || userId <= 0) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { layout?: unknown; dirty?: unknown };
    const layout = parseDashboardLayout(parsed.layout);
    if (!layout) {
      return null;
    }
    return { layout, dirty: parsed.dirty === true };
  } catch {
    return null;
  }
};

const writeCache = (userId: number, layout: DashboardLayoutPreference, dirty: boolean): void => {
  if (typeof window === 'undefined' || !Number.isInteger(userId) || userId <= 0) {
    return;
  }
  try {
    window.sessionStorage.setItem(cacheKey(userId), JSON.stringify({ layout, dirty }));
  } catch {
    // Ignore quota or serialization errors.
  }
};

export const rememberUserDashboardLayout = (
  userId: number,
  layout: DashboardLayoutPreference,
  dirty = true,
): void => {
  writeCache(userId, layout, dirty);
};

export const recallUserDashboardLayout = (userId: number): DashboardLayoutPreference | null =>
  readCache(userId)?.layout ?? null;

export const isUserDashboardLayoutDirty = (userId: number): boolean =>
  readCache(userId)?.dirty === true;

const persistSucceeded = (data: { success?: boolean; saved?: boolean } | null | undefined): boolean => {
  if (!data || data.success === false) {
    return false;
  }
  if (data.saved === false) {
    return false;
  }
  return true;
};

export const persistUserDashboardLayout = async (
  layout: DashboardLayoutPreference,
  options?: { keepalive?: boolean; userId?: number },
): Promise<boolean> => {
  try {
    if (options?.keepalive) {
      const response = await apiFetch(DASHBOARD_LAYOUT_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
        keepalive: true,
      });
      if (!response.ok) {
        return false;
      }
      try {
        const data = await response.json() as { success?: boolean; saved?: boolean };
        const saved = persistSucceeded(data);
        if (saved && options.userId) {
          rememberUserDashboardLayout(options.userId, layout, false);
        }
        return saved;
      } catch {
        if (options.userId) {
          rememberUserDashboardLayout(options.userId, layout, false);
        }
        return true;
      }
    }

    const { data, response } = await apiPut<{ success?: boolean; saved?: boolean; error?: string }>(
      DASHBOARD_LAYOUT_PATH,
      layout,
    );
    const saved = response.ok && persistSucceeded(data);
    if (saved && options?.userId) {
      rememberUserDashboardLayout(options.userId, layout, false);
    }
    if (!saved && data?.error) {
      reportApiError(new Error(data.error));
    }
    return saved;
  } catch (error) {
    reportApiError(error);
    return false;
  }
};

export const fetchUserDashboardLayout = async (): Promise<DashboardLayoutPreference | null> => {
  try {
    const { data, response } = await apiGet<{ success?: boolean; layout?: unknown }>(
      DASHBOARD_LAYOUT_PATH,
    );
    if (!response.ok || !data.success) {
      return null;
    }
    return parseDashboardLayout(data.layout);
  } catch {
    return null;
  }
};
