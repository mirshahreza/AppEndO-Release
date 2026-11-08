const STORAGE_KEY_PREFIX = 'appendo:org-chart:collapsed:';

export const getOrgChartCollapsedStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

export const readOrgChartCollapsedIds = (chartRootId: string): string[] => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return [];
  try {
    const raw = window.localStorage.getItem(getOrgChartCollapsedStorageKey(chartRootId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const writeOrgChartCollapsedIds = (
  chartRootId: string,
  ids: Iterable<string>,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    const key = getOrgChartCollapsedStorageKey(chartRootId);
    const list = Array.from(new Set(
      Array.from(ids).map((id) => String(id || '').trim()).filter(Boolean),
    ));
    if (list.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};
