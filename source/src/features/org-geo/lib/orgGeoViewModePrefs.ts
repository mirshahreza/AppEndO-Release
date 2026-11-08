const STORAGE_KEY_PREFIX = 'appendo:org-geo:view-mode:';

export type OrgGeoWorkspaceViewMode = 'canvas' | 'datasheet';

export const getOrgGeoViewModeStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

export const readOrgGeoViewMode = (chartRootId: string): OrgGeoWorkspaceViewMode => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return 'canvas';
  try {
    const raw = window.localStorage.getItem(getOrgGeoViewModeStorageKey(chartRootId));
    if (raw === 'datasheet') return 'datasheet';
    return 'canvas';
  } catch {
    return 'canvas';
  }
};

export const writeOrgGeoViewMode = (
  chartRootId: string,
  mode: OrgGeoWorkspaceViewMode,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    const key = getOrgGeoViewModeStorageKey(chartRootId);
    if (mode === 'canvas') {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, mode);
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};
