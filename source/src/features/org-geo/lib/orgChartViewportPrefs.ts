const STORAGE_KEY_PREFIX = 'appendo:org-chart:viewport:';

export type OrgChartViewportPrefs = {
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
};

export const getOrgChartViewportStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const normalizeOrgChartViewportPrefs = (
  raw: unknown,
  clampZoom: (value: number) => number,
): OrgChartViewportPrefs | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (!isFiniteNumber(record.zoom)) return null;
  return {
    zoom: clampZoom(record.zoom),
    scrollLeft: isFiniteNumber(record.scrollLeft) ? Math.max(0, record.scrollLeft) : 0,
    scrollTop: isFiniteNumber(record.scrollTop) ? Math.max(0, record.scrollTop) : 0,
  };
};

export const readOrgChartViewportPrefs = (
  chartRootId: string,
  clampZoom: (value: number) => number,
): OrgChartViewportPrefs | null => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(getOrgChartViewportStorageKey(chartRootId));
    if (!raw) return null;
    return normalizeOrgChartViewportPrefs(JSON.parse(raw), clampZoom);
  } catch {
    return null;
  }
};

export const writeOrgChartViewportPrefs = (
  chartRootId: string,
  prefs: OrgChartViewportPrefs,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    window.localStorage.setItem(
      getOrgChartViewportStorageKey(chartRootId),
      JSON.stringify(prefs),
    );
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};
