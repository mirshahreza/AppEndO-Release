import type { DesignerBindingDefinition, DesignerDocument } from './types';
import { DASHBOARD_FILTER_BAR_CONFIG_PROP, parseDashboardFilterBarConfig } from './designerDashboardFilterBarConfig';
import { getNodePaletteItemId } from './runtimeShared';

/** Derives an API query-param name from a designer store path (uses the last segment). */
export const storePathToFilterApiParam = (storePath: string): string => {
  const trimmed = storePath.trim();
  const segments = trimmed.split('.').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1]! : trimmed;
};

export const sanitizeFilterBindings = (raw: unknown): string[] | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const paths = raw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return paths.length > 0 ? paths : undefined;
};

/** Maps dashboard filter store paths to list-fetch query param bindings. */
export const buildFilterBindingQueryParams = (
  filterBindings: string[] | undefined,
): Record<string, string> => {
  const bindings: Record<string, string> = {};
  for (const storePath of filterBindings ?? []) {
    const trimmed = storePath.trim();
    if (!trimmed) {
      continue;
    }
    bindings[storePathToFilterApiParam(trimmed)] = trimmed;
  }
  return bindings;
};

export const mergeQueryParamsWithFilterBindings = (
  base: Record<string, string> | undefined,
  filterBindings: string[] | undefined,
): Record<string, string> => ({
  ...(base ?? {}),
  ...buildFilterBindingQueryParams(filterBindings),
});

export const resolveBindingQueryParamsWithFilterBindings = (
  binding: DesignerBindingDefinition | undefined,
  toolbarQueryParams: Record<string, string>,
): Record<string, string> => mergeQueryParamsWithFilterBindings(
  toolbarQueryParams,
  binding?.filterBindings,
);

const collectFilterBarStorePaths = (document: DesignerDocument): string[] => {
  const paths = new Set<string>();
  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== 'dashboard.filter-bar') {
      continue;
    }
    const config = parseDashboardFilterBarConfig(node.props[DASHBOARD_FILTER_BAR_CONFIG_PROP]);
    for (const filter of config.filters) {
      if (filter.type === 'dateRange') {
        if (filter.fromStorePath?.trim()) {
          paths.add(filter.fromStorePath.trim());
        }
        if (filter.toStorePath?.trim()) {
          paths.add(filter.toStorePath.trim());
        }
      } else if (filter.storePath?.trim()) {
        paths.add(filter.storePath.trim());
      }
    }
  }
  return Array.from(paths);
};

/** Lists store paths available for dashboard filter binding (filter bar + registry segments). */
export const listDocumentFilterBindingCandidates = (
  document: DesignerDocument,
  storeSegmentPaths: string[] = [],
): string[] => {
  const paths = new Set<string>([
    ...collectFilterBarStorePaths(document),
    ...storeSegmentPaths.map((entry) => entry.trim()).filter(Boolean),
  ]);
  return Array.from(paths).sort((left, right) => left.localeCompare(right));
};

export const documentHasDashboardFilterBar = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some((node) => getNodePaletteItemId(node) === 'dashboard.filter-bar');
