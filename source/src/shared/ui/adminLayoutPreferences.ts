const SIDEBAR_COLLAPSED_STORAGE_KEY = 'appendo.admin.sidebar-collapsed';
const NAV_EXPANDED_GROUPS_STORAGE_KEY = 'appendo.admin.nav-expanded-groups';

export const readStoredSidebarCollapsed = (): boolean | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

export const persistSidebarCollapsed = (collapsed: boolean): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
};

export const readStoredExpandedNavGroups = (): Set<string> | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(NAV_EXPANDED_GROUPS_STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return new Set(parsed.filter((heading): heading is string => typeof heading === 'string' && heading.length > 0));
  } catch {
    return null;
  }
};

export const persistExpandedNavGroups = (expandedGroups: Set<string>): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      NAV_EXPANDED_GROUPS_STORAGE_KEY,
      JSON.stringify([...expandedGroups]),
    );
  } catch {
    // ignore quota / privacy errors
  }
};
