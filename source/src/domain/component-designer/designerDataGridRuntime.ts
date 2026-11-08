import type * as React from 'react';
import { readNumber, readString } from './runtimeShared';
import type { DesignerNode } from './types';

export type DataGridQueryMode = 'client' | 'server';

export type DataGridPagingConfig = {
  page: number;
  pageSize: number;
  total: number;
  gridQueryMode: DataGridQueryMode;
};

export const normalizeDataGridPageSize = (value: unknown, fallback = 15): number => {
  const parsed = readNumber(value, fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(500, Math.floor(parsed)));
};

const normalizeDataGridPage = (value: unknown, fallback = 1): number => {
  const parsed = readNumber(value, fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
};

export const resolveDataGridPagingConfig = (node: DesignerNode): DataGridPagingConfig => {
  const pageSize = normalizeDataGridPageSize(node.props.pageSize, 15);
  const page = normalizeDataGridPage(node.props.page, 1);
  const gridQueryMode = readString(node.props.gridQueryMode, 'client') === 'server' ? 'server' : 'client';
  const totalProp = readNumber(node.props.total, Number.NaN);

  return {
    page,
    pageSize,
    total: Number.isFinite(totalProp) && totalProp >= 0 ? totalProp : 0,
    gridQueryMode,
  };
};

/**
 * Resolve the total-record count used for footer paging.
 *
 * Server mode with an explicit `total` (design-time prop or API `totalPath`) uses that value.
 * When total is unset/0 in server mode, a full page of rows implies at least one more record so
 * Next is not prematurely disabled (parity audit item 78).
 */
export const resolveDataGridTotalCount = (
  config: DataGridPagingConfig,
  rowCount: number,
): number => {
  if (config.gridQueryMode === 'server') {
    if (config.total > 0) {
      return config.total;
    }

    const safePage = Math.max(1, config.page);
    const pageSize = Math.max(1, config.pageSize);
    const base = (safePage - 1) * pageSize + Math.max(0, rowCount);
    if (rowCount >= pageSize) {
      return base + 1;
    }
    return base;
  }

  return rowCount;
};

/**
 * When Query Mode is `server` but "Sync filters to API" is off, column sort/filter would otherwise
 * be dead (applyClientGridQuery skips server-mode columns). Fall back to client application on the
 * currently loaded page so toolbar/header controls always have an effect (parity items 73/74).
 */
export const resolveEffectiveAppTableGridQueryMode = (
  gridQueryMode: DataGridQueryMode,
  serverQueryEnabled: boolean,
): DataGridQueryMode => (
  gridQueryMode === 'server' && serverQueryEnabled ? 'server' : 'client'
);

/**
 * Read a numeric total from an API payload via `responseMapping.totalPath` (e.g. `meta.total`).
 */
export const readResponseTotalCount = (
  payload: unknown,
  totalPath: string | undefined,
): number | undefined => {
  const path = totalPath?.trim();
  if (!path || !payload || typeof payload !== 'object') {
    return undefined;
  }

  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = payload;
  for (const segment of segments) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  const parsed = typeof cursor === 'number' ? cursor : Number(cursor);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return Math.floor(parsed);
};

export const buildDataGridPageNumbers = (safePage: number, totalPages: number): number[] => {
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, safePage + 2);
  const pages: number[] = [];

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }

  return pages;
};

export const appendServerInfiniteGridRows = <TRow extends Record<string, unknown>>(
  previous: readonly TRow[],
  nextPageRows: readonly TRow[],
  rowKeyField: string,
): TRow[] => {
  if (nextPageRows.length === 0) {
    return [...previous];
  }

  const seen = new Set(
    previous.map((row) => String(row[rowKeyField] ?? row.id ?? '')),
  );
  const appended: TRow[] = [];
  for (const row of nextPageRows) {
    const key = String(row[rowKeyField] ?? row.id ?? '');
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    appended.push(row);
  }

  return appended.length === 0 ? [...previous] : [...previous, ...appended];
};

export const sliceDataGridRowsForDisplay = <TRow,>(
  rows: readonly TRow[],
  page: number,
  pageSize: number,
  totalCount: number,
  gridQueryMode: DataGridQueryMode,
): {
  displayRows: TRow[];
  safePage: number;
  totalPages: number;
} => {
  const effectiveTotal = Math.max(totalCount, rows.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Server already returned the current page only — never re-slice by an absolute dataset offset
  // (parity audit item 30). Client mode owns local paging over the full in-memory row set.
  if (gridQueryMode === 'server') {
    return {
      displayRows: [...rows],
      safePage,
      totalPages,
    };
  }

  const start = (safePage - 1) * pageSize;
  return {
    displayRows: rows.slice(start, start + pageSize),
    safePage,
    totalPages,
  };
};

export const resolveDataGridScrollContainerStyle = (
  isHeaderSticky: boolean,
  style?: React.CSSProperties,
): React.CSSProperties | undefined => {
  if (!isHeaderSticky) {
    return undefined;
  }

  if (typeof style?.height === 'number' && Number.isFinite(style.height) && style.height > 0) {
    return { maxHeight: style.height };
  }

  return { maxHeight: '20rem' };
};

/** Never use CSS sticky in designer grids — dnd-kit transforms break sticky and cover designer chrome. */
export const shouldUseDesignerDataGridContainedScroll = (isHeaderSticky: boolean): boolean => isHeaderSticky;

export const resolveGridColumnWidth = (width?: number | string): string | undefined => {
  if (width == null) {
    return undefined;
  }

  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    return `${width}px`;
  }

  const normalized = String(width).trim();
  if (!normalized) {
    return undefined;
  }

  if (/^\d+(\.\d+)?(px|%|rem|em)$/.test(normalized)) {
    return normalized;
  }

  if (/^\d+$/.test(normalized)) {
    return `${normalized}px`;
  }

  return undefined;
};

export const buildDesignerGridColumnStyles = (
  columns: ReadonlyArray<{ id: string; width?: number | string }>,
): React.CSSProperties[] => {
  const resolvedWidths = columns.map((column) => resolveGridColumnWidth(column.width));
  const autoColumnCount = resolvedWidths.filter((width) => !width).length;
  const autoSharePercent = autoColumnCount > 0
    ? `${Math.max(8, Math.floor(100 / columns.length))}%`
    : undefined;

  return columns.map((column, index) => {
    const width = resolvedWidths[index];
    if (width) {
      return { width, minWidth: width };
    }

    return {
      width: autoSharePercent,
      minWidth: column.id === 'name' ? '8rem' : '4rem',
    };
  });
};

export {
  applyGridAggregation,
  applyGridPivot,
  aggregateFieldValues,
  buildGridAggregationQueryParams,
  formatAggregationValue,
  isGridAggregationEnabled,
  parseGridAggregationConfig,
  parseServerAggregationResponse,
  serializeGridAggregationConfig,
  type GridAggregationConfig,
  type GridAggregationEntry,
  type GridAggregationFn,
  type GridAggregationFormat,
  type GridDisplayRow,
  type GridDisplayRowKind,
  type GridPivotMode,
  GRID_GROUP_LEVEL_KEY,
  GRID_GROUP_PATH_KEY,
  GRID_ROW_KIND_KEY,
} from './designerGridAggregation';

export const resolveDesignerDataGridShellStyle = (
  style?: React.CSSProperties,
): React.CSSProperties | undefined => {
  if (!style) {
    return undefined;
  }

  const shellStyle: React.CSSProperties = {};
  if (style.width !== undefined) {
    shellStyle.width = style.width;
  }
  if (style.minWidth !== undefined) {
    shellStyle.minWidth = style.minWidth;
  }
  if (style.maxWidth !== undefined) {
    shellStyle.maxWidth = style.maxWidth;
  }
  if (style.marginInline !== undefined) {
    shellStyle.marginInline = style.marginInline;
  }
  if (style.marginInlineStart !== undefined) {
    shellStyle.marginInlineStart = style.marginInlineStart;
  }

  return Object.keys(shellStyle).length > 0 ? shellStyle : undefined;
};

