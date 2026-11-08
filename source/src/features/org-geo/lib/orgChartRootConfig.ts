/**
 * Chart settings stored on the tree root's `metadata` as JSON.
 * Nested under `chart` so other metadata keys can coexist later.
 */

import { normalizeHexColor } from '../../../shared/lib/uiColorUtils';

export const ORG_CHART_METADATA_KEY = 'chart' as const;
export const ORG_CHART_CONFIG_VERSION = 1 as const;

export type OrgChartLevelConfig = {
  /** Display title for this depth (0 = root). */
  title: string;
  /** Optional Lucide icon name used when a node has no icon/avatar. */
  icon?: string;
  /** Optional hex color for level chrome (icon tint / accent). */
  color?: string;
};

export type OrgChartRootConfig = {
  version: typeof ORG_CHART_CONFIG_VERSION;
  levels: Record<string, OrgChartLevelConfig>;
};

export type OrgChartRootMetadata = {
  [ORG_CHART_METADATA_KEY]?: OrgChartRootConfig;
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const createEmptyOrgChartRootConfig = (): OrgChartRootConfig => ({
  version: ORG_CHART_CONFIG_VERSION,
  levels: {},
});

export const normalizeOrgChartLevelConfig = (raw: unknown): OrgChartLevelConfig | null => {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const icon = typeof raw.icon === 'string' ? raw.icon.trim() : '';
  const color = normalizeHexColor(typeof raw.color === 'string' ? raw.color : '') ?? '';
  if (!title && !icon && !color) return null;
  return {
    title,
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
  };
};

export const normalizeOrgChartRootConfig = (raw: unknown): OrgChartRootConfig => {
  const empty = createEmptyOrgChartRootConfig();
  if (!isRecord(raw)) return empty;
  const levelsRaw = isRecord(raw.levels) ? raw.levels : {};
  const levels: Record<string, OrgChartLevelConfig> = {};
  for (const [key, value] of Object.entries(levelsRaw)) {
    const depthKey = String(key).trim();
    if (!/^\d+$/.test(depthKey)) continue;
    const level = normalizeOrgChartLevelConfig(value);
    if (level) levels[depthKey] = level;
  }
  return {
    version: ORG_CHART_CONFIG_VERSION,
    levels,
  };
};

export const parseRootMetadataObject = (raw: string | null | undefined): OrgChartRootMetadata => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const readOrgChartRootConfig = (metadata: string | null | undefined): OrgChartRootConfig => {
  const envelope = parseRootMetadataObject(metadata);
  return normalizeOrgChartRootConfig(envelope[ORG_CHART_METADATA_KEY]);
};

export const writeOrgChartRootConfigToMetadata = (
  existingMetadata: string | null | undefined,
  chart: OrgChartRootConfig,
): string => {
  const envelope = parseRootMetadataObject(existingMetadata);
  const next: OrgChartRootMetadata = {
    ...envelope,
    [ORG_CHART_METADATA_KEY]: normalizeOrgChartRootConfig(chart),
  };
  return JSON.stringify(next);
};

export const resolveOrgChartLevelTitle = (
  depth: number,
  chart: OrgChartRootConfig | null | undefined,
  fallback: (depth: number) => string,
): string => {
  const saved = readOrgChartLevelTitle(depth, chart);
  if (saved) return saved;
  return fallback(Math.max(0, Math.floor(depth)));
};

/** Saved level title only — empty when the level has no custom title. */
export const readOrgChartLevelTitle = (
  depth: number,
  chart: OrgChartRootConfig | null | undefined,
): string => {
  const safeDepth = Math.max(0, Math.floor(depth));
  return chart?.levels?.[String(safeDepth)]?.title?.trim() || '';
};

export const resolveOrgChartLevelIcon = (
  depth: number,
  chart: OrgChartRootConfig | null | undefined,
  fallbackIcon?: string,
): string => {
  const safeDepth = Math.max(0, Math.floor(depth));
  const saved = chart?.levels?.[String(safeDepth)]?.icon?.trim();
  if (saved) return saved;
  return String(fallbackIcon || '').trim();
};

export const resolveOrgChartLevelColor = (
  depth: number,
  chart: OrgChartRootConfig | null | undefined,
): string => {
  const safeDepth = Math.max(0, Math.floor(depth));
  return normalizeHexColor(chart?.levels?.[String(safeDepth)]?.color || '') ?? '';
};

export const resolveOrgChartLevelColorWithDefault = (
  depth: number,
  chart: OrgChartRootConfig | null | undefined,
  nodeColor?: string | null,
  defaultForDepth?: (depth: number) => string | undefined,
): string => {
  const own = normalizeHexColor(nodeColor || '');
  if (own) return own;
  const saved = resolveOrgChartLevelColor(depth, chart);
  if (saved) return saved;
  return normalizeHexColor(defaultForDepth?.(depth) || '') ?? '';
};

/** Soft fill + ink + border for node chrome from a hex (node or level). */
export const orgChartLevelColorStyles = (
  hex: string | null | undefined,
): { backgroundColor: string; borderColor: string; color: string } | undefined => {
  const normalized = normalizeHexColor(hex || '');
  if (!normalized) return undefined;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  if (![red, green, blue].every(Number.isFinite)) return undefined;
  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, 0.22)`,
    borderColor: `rgba(${red}, ${green}, ${blue}, 0.48)`,
    color: normalized,
  };
};

export const measureOrgChartMaxDepth = (
  node: { children?: Array<{ children?: unknown[] }> | null },
  depth = 0,
): number => {
  const children = node.children ?? [];
  if (children.length === 0) return depth;
  return Math.max(
    depth,
    ...children.map((child) => measureOrgChartMaxDepth(child as typeof node, depth + 1)),
  );
};

/** Depths to edit in settings: cover the tree, saved levels, and a spare slot. */
export const listOrgChartLevelDepths = (
  maxTreeDepth: number,
  options?: { minLevels?: number; spare?: number; savedMaxDepth?: number },
): number[] => {
  const minLevels = options?.minLevels ?? 4;
  const spare = options?.spare ?? 1;
  const savedMax = options?.savedMaxDepth ?? -1;
  const count = Math.max(minLevels, maxTreeDepth + 1 + spare, savedMax + 1 + spare);
  return Array.from({ length: count }, (_, index) => index);
};

export const maxSavedLevelDepth = (chart: OrgChartRootConfig | null | undefined): number => {
  const keys = Object.keys(chart?.levels || {})
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (keys.length === 0) return -1;
  return Math.max(...keys);
};
