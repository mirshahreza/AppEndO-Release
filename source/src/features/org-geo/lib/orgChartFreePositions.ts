import type { OrgChartTreeNode } from '../types';
import { layoutOrgChartRadial } from './orgChartLayout';

const STORAGE_KEY_PREFIX = 'appendo:org-chart:free-positions:';

export type OrgChartFreePoint = {
  x: number;
  y: number;
};

export type OrgChartFreePositions = Record<string, OrgChartFreePoint>;

export const getOrgChartFreePositionsStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const normalizeOrgChartFreePositions = (raw: unknown): OrgChartFreePositions => {
  if (!raw || typeof raw !== 'object') return {};
  const next: OrgChartFreePositions = {};
  for (const [id, point] of Object.entries(raw as Record<string, unknown>)) {
    const nodeId = String(id || '').trim();
    if (!nodeId || !point || typeof point !== 'object') continue;
    const record = point as Record<string, unknown>;
    if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y)) continue;
    next[nodeId] = { x: record.x, y: record.y };
  }
  return next;
};

export const readOrgChartFreePositions = (chartRootId: string): OrgChartFreePositions => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return {};
  try {
    const raw = window.localStorage.getItem(getOrgChartFreePositionsStorageKey(chartRootId));
    if (!raw) return {};
    return normalizeOrgChartFreePositions(JSON.parse(raw));
  } catch {
    return {};
  }
};

export const writeOrgChartFreePositions = (
  chartRootId: string,
  positions: OrgChartFreePositions,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    window.localStorage.setItem(
      getOrgChartFreePositionsStorageKey(chartRootId),
      JSON.stringify(positions),
    );
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};

/** Keep saved spots; fill missing nodes from a radial seed so free mode always has coordinates. */
export const mergeFreePositionsWithTree = (
  root: OrgChartTreeNode,
  saved: OrgChartFreePositions,
): OrgChartFreePositions => {
  const seeded = layoutOrgChartRadial(root);
  const next: OrgChartFreePositions = {};
  for (const node of seeded.nodes) {
    const existing = saved[node.id];
    next[node.id] = existing
      ? { x: existing.x, y: existing.y }
      : { x: node.x, y: node.y };
  }
  return next;
};

export const measureFreeLayoutBounds = (
  positions: OrgChartFreePositions,
  options?: { pad?: number; halfWidth?: number; halfHeight?: number },
): { width: number; height: number; originX: number; originY: number } => {
  const pad = options?.pad ?? 96;
  const halfWidth = options?.halfWidth ?? 120;
  const halfHeight = options?.halfHeight ?? 48;
  const entries = Object.values(positions);
  if (entries.length === 0) {
    return {
      width: pad * 2 + halfWidth * 2,
      height: pad * 2 + halfHeight * 2,
      originX: -pad,
      originY: -pad,
    };
  }

  const xs = entries.map((point) => point.x);
  const ys = entries.map((point) => point.y);
  const minX = Math.min(...xs) - halfWidth;
  const maxX = Math.max(...xs) + halfWidth;
  const minY = Math.min(...ys) - halfHeight;
  const maxY = Math.max(...ys) + halfHeight;
  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    originX: minX - pad,
    originY: minY - pad,
  };
};

export type OrgChartFreeEdge = {
  parentId: string;
  childId: string;
};

export const collectFreeLayoutEdges = (root: OrgChartTreeNode): OrgChartFreeEdge[] => {
  const edges: OrgChartFreeEdge[] = [];
  const walk = (node: OrgChartTreeNode) => {
    for (const child of node.children ?? []) {
      edges.push({ parentId: node.id, childId: child.id });
      walk(child);
    }
  };
  walk(root);
  return edges;
};

export const collectFreeLayoutDepths = (root: OrgChartTreeNode): Record<string, number> => {
  const depths: Record<string, number> = {};
  const walk = (node: OrgChartTreeNode, depth: number) => {
    depths[node.id] = depth;
    for (const child of node.children ?? []) {
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return depths;
};
