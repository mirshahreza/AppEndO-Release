import { APP_TABLE_GRID_PALETTE_ITEM_ID } from './designerDataGridColumns';
import {
  isDesignerGridToolbarEnabled,
  parseDesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import { getNodePaletteItemId } from './runtimeShared';
import type { DesignerBindingDefinitions, DesignerDocument } from './types';

const readStringProp = (value: unknown, fallback: string): string => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
);

const readPositiveIntProp = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

/**
 * Seed `gridQuery.*` store paths before the first hydration fetch so published
 * server-side grids do not fire a param-less list request and then refetch.
 */
export const buildInitialGridQueryStoreSegment = (
  document: DesignerDocument,
  _bindingDefinitions: DesignerBindingDefinitions,
): Record<string, unknown> | undefined => {
  let sortBy = '';
  let sortDir: 'asc' | 'desc' = 'asc';
  let page = 1;
  let pageSize = 20;
  let found = false;

  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }
    const toolbarConfig = parseDesignerGridToolbarConfig(node.props.toolbarConfig);
    if (!isDesignerGridToolbarEnabled(toolbarConfig) || toolbarConfig.serverQuery?.enabled !== true) {
      continue;
    }

    found = true;
    sortBy = readStringProp(node.props.defaultSortBy, sortBy || 'id');
    const dir = readStringProp(node.props.defaultSortDirection, sortDir);
    sortDir = dir === 'desc' ? 'desc' : 'asc';
    page = readPositiveIntProp(node.props.page, page);
    pageSize = readPositiveIntProp(node.props.pageSize, pageSize);
    break;
  }

  if (!found) {
    return undefined;
  }

  return {
    sortBy,
    sortDir,
    page,
    pageSize,
  };
};

export const mergeInitialGridQueryIntoStore = (
  store: Record<string, unknown>,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): Record<string, unknown> => {
  const gridQuery = buildInitialGridQueryStoreSegment(document, bindingDefinitions);
  if (!gridQuery) {
    return store;
  }

  const existing = store.gridQuery;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const record = existing as Record<string, unknown>;
    const hasSort = typeof record.sortBy === 'string' && record.sortBy.trim().length > 0;
    const hasPage = Number(record.page) > 0;
    const hasPageSize = Number(record.pageSize) > 0;
    if (hasSort && hasPage && hasPageSize) {
      return store;
    }
  }

  return {
    ...store,
    gridQuery: {
      ...(typeof existing === 'object' && existing !== null && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {}),
      ...gridQuery,
    },
  };
};
