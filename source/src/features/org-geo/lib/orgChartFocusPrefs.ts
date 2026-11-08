import { isBaseInfoIdInSubtree } from '../../../shared/lib/isBaseInfoIdInSubtree';

const STORAGE_KEY_PREFIX = 'appendo:org-chart:focused-root:';

export const getOrgChartFocusedRootStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

export const readOrgChartFocusedRootId = (chartRootId: string): string | null => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(getOrgChartFocusedRootStorageKey(chartRootId));
    const nodeId = String(raw || '').trim();
    if (!nodeId || nodeId === chartRootId.trim()) return null;
    if (!isBaseInfoIdInSubtree(chartRootId, nodeId)) return null;
    return nodeId;
  } catch {
    return null;
  }
};

export const writeOrgChartFocusedRootId = (
  chartRootId: string,
  nodeId: string | null | undefined,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    const key = getOrgChartFocusedRootStorageKey(chartRootId);
    const next = String(nodeId || '').trim();
    if (!next || next === chartRootId.trim() || !isBaseInfoIdInSubtree(chartRootId, next)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, next);
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};
