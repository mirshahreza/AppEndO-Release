import { isBaseInfoIdInSubtree } from '../../../shared/lib/isBaseInfoIdInSubtree';

const STORAGE_KEY_PREFIX = 'appendo:org-chart:selected-node:';

export const getOrgChartSelectedNodeStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

export const readOrgChartSelectedNodeId = (chartRootId: string): string | null => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(getOrgChartSelectedNodeStorageKey(chartRootId));
    const nodeId = String(raw || '').trim();
    if (!nodeId) return null;
    if (!isBaseInfoIdInSubtree(chartRootId, nodeId)) return null;
    return nodeId;
  } catch {
    return null;
  }
};

export const writeOrgChartSelectedNodeId = (
  chartRootId: string,
  nodeId: string | null | undefined,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    const key = getOrgChartSelectedNodeStorageKey(chartRootId);
    const next = String(nodeId || '').trim();
    if (!next || !isBaseInfoIdInSubtree(chartRootId, next)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, next);
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};
