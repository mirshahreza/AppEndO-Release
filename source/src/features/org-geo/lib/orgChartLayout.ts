import type { OrgChartTreeNode } from '../types';

export type OrgChartLayoutMode = 'vertical' | 'horizontal' | 'pyramid' | 'radial' | 'free';

export const ORG_CHART_LAYOUT_MODES: readonly OrgChartLayoutMode[] = [
  'vertical',
  'horizontal',
  'pyramid',
  'radial',
  'free',
] as const;

export const ORG_CHART_LAYOUT_LABELS: Record<OrgChartLayoutMode, string> = {
  vertical: 'Vertical',
  horizontal: 'Horizontal',
  pyramid: 'Pyramid',
  radial: 'Radial overview',
  free: 'Free layout',
};

/** v1 stored `vertical` for every first visit; v2 uses {@link ORG_CHART_DEFAULT_LAYOUT_MODE} when unset. */
const STORAGE_KEY_PREFIX = 'appendo:org-chart:layout:v2:';
const LEGACY_STORAGE_KEY_PREFIX = 'appendo:org-chart:layout:';

/** Default diagram layout when the user has not chosen one (Organization Chart + Geographic Divisions). */
export const ORG_CHART_DEFAULT_LAYOUT_MODE: OrgChartLayoutMode = 'radial';

const LEGACY_IMPLICIT_LAYOUT: OrgChartLayoutMode = 'vertical';

export const getOrgChartLayoutStorageKey = (chartRootId: string): string =>
  `${STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

const getLegacyOrgChartLayoutStorageKey = (chartRootId: string): string =>
  `${LEGACY_STORAGE_KEY_PREFIX}${chartRootId.trim()}`;

export const normalizeOrgChartLayoutMode = (raw: unknown): OrgChartLayoutMode | null => {
  const value = String(raw || '').trim().toLowerCase();
  if (
    value === 'vertical'
    || value === 'horizontal'
    || value === 'pyramid'
    || value === 'radial'
    || value === 'free'
  ) {
    return value;
  }
  return null;
};

export const readOrgChartLayoutMode = (chartRootId: string): OrgChartLayoutMode => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return ORG_CHART_DEFAULT_LAYOUT_MODE;
  try {
    const id = chartRootId.trim();
    const currentRaw = window.localStorage.getItem(getOrgChartLayoutStorageKey(id));
    const current = normalizeOrgChartLayoutMode(currentRaw);
    if (current) return current;

    const legacyRaw = window.localStorage.getItem(getLegacyOrgChartLayoutStorageKey(id));
    const legacy = normalizeOrgChartLayoutMode(legacyRaw);
    if (legacy && legacy !== LEGACY_IMPLICIT_LAYOUT) {
      writeOrgChartLayoutMode(id, legacy);
      return legacy;
    }

    return ORG_CHART_DEFAULT_LAYOUT_MODE;
  } catch {
    return ORG_CHART_DEFAULT_LAYOUT_MODE;
  }
};

export const writeOrgChartLayoutMode = (
  chartRootId: string,
  mode: OrgChartLayoutMode,
): void => {
  if (typeof window === 'undefined' || !chartRootId.trim()) return;
  try {
    window.localStorage.setItem(getOrgChartLayoutStorageKey(chartRootId), mode);
  } catch {
    // Ignore quota / private-mode storage failures.
  }
};

export type OrgChartPackedNodeLayout = {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  depth: number;
};

export type OrgChartPackedLayout = {
  nodes: OrgChartPackedNodeLayout[];
  width: number;
  height: number;
};

const countLeaves = (node: OrgChartTreeNode): number => {
  const children = node.children ?? [];
  if (children.length === 0) return 1;
  return children.reduce((sum, child) => sum + countLeaves(child), 0);
};

const normalizePackedLayout = (
  nodes: OrgChartPackedNodeLayout[],
  pad = 96,
): OrgChartPackedLayout => {
  if (nodes.length === 0) {
    return { nodes: [], width: pad * 2, height: pad * 2 };
  }
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;
  return {
    nodes: nodes.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    })),
    width,
    height,
  };
};

/** Polar tree packing: root at origin, generations on rings sized by leaf weight. */
export const layoutOrgChartRadial = (
  root: OrgChartTreeNode,
  options?: { ringGap?: number; startAngle?: number; sweep?: number },
): OrgChartPackedLayout => {
  const ringGap = options?.ringGap ?? 220;
  const startAngle = options?.startAngle ?? -Math.PI / 2;
  const sweep = options?.sweep ?? Math.PI * 2;
  const nodes: OrgChartPackedNodeLayout[] = [];

  const walk = (
    node: OrgChartTreeNode,
    parentId: string | null,
    depth: number,
    angleStart: number,
    angleEnd: number,
  ) => {
    const mid = (angleStart + angleEnd) / 2;
    const radius = depth * ringGap;
    nodes.push({
      id: node.id,
      parentId,
      x: Math.cos(mid) * radius,
      y: Math.sin(mid) * radius,
      depth,
    });

    const children = node.children ?? [];
    if (children.length === 0) return;

    const weights = children.map((child) => countLeaves(child));
    const total = weights.reduce((sum, weight) => sum + weight, 0) || children.length;
    let cursor = angleStart;
    children.forEach((child, index) => {
      const share = (weights[index] / total) * (angleEnd - angleStart);
      const next = cursor + share;
      walk(child, node.id, depth + 1, cursor, next);
      cursor = next;
    });
  };

  walk(root, null, 0, startAngle, startAngle + sweep);
  return normalizePackedLayout(nodes);
};

/**
 * Top-down tidy pyramid: leaves spaced on a baseline, parents centered over
 * their children so the silhouette reads as a triangle / hierarchy pyramid.
 */
export const layoutOrgChartPyramid = (
  root: OrgChartTreeNode,
  options?: { rowGap?: number; colGap?: number },
): OrgChartPackedLayout => {
  const rowGap = options?.rowGap ?? 120;
  const colGap = options?.colGap ?? 200;
  const nodes: OrgChartPackedNodeLayout[] = [];
  let leafCursor = 0;

  const walk = (
    node: OrgChartTreeNode,
    parentId: string | null,
    depth: number,
  ): number => {
    const children = node.children ?? [];
    let x: number;
    if (children.length === 0) {
      x = leafCursor * colGap;
      leafCursor += 1;
    } else {
      const childXs = children.map((child) => walk(child, node.id, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }
    nodes.push({
      id: node.id,
      parentId,
      x,
      y: depth * rowGap,
      depth,
    });
    return x;
  };

  walk(root, null, 0);
  return normalizePackedLayout(nodes);
};
