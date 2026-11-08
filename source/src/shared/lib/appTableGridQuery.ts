import type React from 'react';
import type { AppTableGridColumnTextDirection } from './appTableGridColumnTextDirection';

export type GridColumnQueryMode = 'client' | 'server';
export type GridSortDirection = 'asc' | 'desc';

export type GridFilterValue =
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: 'all' | 'true' | 'false' }
  | { type: 'select'; value: string | string[] }
  | { type: 'dateRange'; from: string | null; to: string | null };

export type GridFilterType = GridFilterValue['type'];

export type GridQuerySort = {
  columnId: string;
  direction: GridSortDirection;
} | null;

export type GridQueryState = {
  sort: GridQuerySort;
  filters: Record<string, GridFilterValue>;
};

export type GridColumnCardRole =
  | 'title'
  | 'subtitle'
  | 'meta'
  | 'field'
  | 'media'
  | 'actions'
  | 'hidden';

export type GridColumnHideBelow = 'md' | 'lg';

export type AppTableGridColumnDef<TRow> = {
  id: string;
  label: React.ReactNode;
  /**
   * Column reading direction relative to the active culture (default `culture`).
   * Use `opposite`, or explicit `ltr` / `rtl`, only when content requires it.
   */
  textDirection?: AppTableGridColumnTextDirection;
  headerClassName?: string;
  cellClassName?: string;
  /** Merged with `cellClassName` per row. */
  getCellClassName?: (row: TRow) => string | undefined;
  /** Merged onto the cell `style` per row. CRUD Set conditional format maps here as a background. */
  getCellStyle?: (row: TRow) => React.CSSProperties | undefined;
  width?: number | string;
  /** Minimum column width (px or CSS length). Resize and persisted widths cannot go below this (floor: `GRID_COLUMN_MIN_WIDTH`). */
  minWidth?: number | string;
  /** Maximum column width — use with fixed `width` when the table is wider than the sum of column widths. */
  maxWidth?: number | string;
  renderCell: (row: TRow) => React.ReactNode;
  getSortValue?: (row: TRow) => string | number | boolean | null | undefined;
  getFilterValue?: (row: TRow) => string | number | boolean | null | undefined;
  sort?: false | { mode?: GridColumnQueryMode };
  filter?: false | {
    mode?: GridColumnQueryMode;
    type: GridFilterType;
    options?: ReadonlyArray<{ value: string; label: string }>;
    placeholder?: string;
    multiple?: boolean;
  };
  layout?: false | {
    hideable?: boolean;
    resizable?: boolean;
    reorderable?: boolean;
    /** Freeze column to left/right edge while the table scrolls horizontally. */
    pinned?: 'left' | 'right';
  };
  card?: {
    role: GridColumnCardRole;
    label?: React.ReactNode;
    priority?: number;
    /** Override `role` on phone. Use `hidden` to drop the column from cards. */
    phoneRole?: GridColumnCardRole;
    /** Override `role` on tablet. Use `hidden` to drop the column from cards. */
    tabletRole?: GridColumnCardRole;
  };
  /** Hide this column below the breakpoint in table, table-scroll, and card layouts. */
  hideBelow?: GridColumnHideBelow;
  /**
   * Wrap long cell text onto extra lines instead of a single-line ellipsis.
   * Default clips with `truncate`.
   */
  wrap?: boolean;
  /** Marks the accessibility row header cell (usually the primary label). */
  isRowHeader?: boolean;
};

export type GridQueryChangeMeta = {
  source: 'sort' | 'filter';
  columnId: string;
};

export const EMPTY_GRID_QUERY: GridQueryState = {
  sort: null,
  filters: {},
};

const warnedMissingAccessors = new Set<string>();

export function resolveColumnMode(
  column: Pick<AppTableGridColumnDef<unknown>, 'sort' | 'filter'>,
  capability: 'sort' | 'filter',
  gridDefaultMode: GridColumnQueryMode,
): GridColumnQueryMode | null {
  const config = capability === 'sort' ? column.sort : column.filter;
  if (config === false || config === undefined) {
    return null;
  }
  return config.mode ?? gridDefaultMode;
}

export function isSortableColumn(column: AppTableGridColumnDef<unknown>): boolean {
  return column.sort !== false && column.sort !== undefined;
}

export function isFilterableColumn(column: AppTableGridColumnDef<unknown>): boolean {
  return column.filter !== false && column.filter !== undefined;
}

export function isEmptyFilter(filter: GridFilterValue): boolean {
  switch (filter.type) {
    case 'text':
      return filter.value.trim() === '';
    case 'boolean':
      return filter.value === 'all';
    case 'select':
      return Array.isArray(filter.value) ? filter.value.length === 0 : filter.value === '';
    case 'dateRange':
      return !filter.from && !filter.to;
    default:
      return true;
  }
}

function isFilterTypeCompatible(columnFilterType: GridFilterType, filter: GridFilterValue): boolean {
  return columnFilterType === filter.type;
}

export function sanitizeGridQuery<TRow>(
  query: GridQueryState,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  gridDefaultMode: GridColumnQueryMode = 'client',
  additionalSortColumnIds?: readonly string[],
): GridQueryState {
  void gridDefaultMode;
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const extraSortColumnIds = additionalSortColumnIds?.length
    ? new Set(additionalSortColumnIds)
    : null;

  let sort: GridQuerySort = null;
  if (query.sort) {
    const column = columnById.get(query.sort.columnId);
    const footerOnlySort = extraSortColumnIds?.has(query.sort.columnId) === true;
    if ((column && isSortableColumn(column)) || footerOnlySort) {
      sort = {
        columnId: query.sort.columnId,
        direction: query.sort.direction === 'desc' ? 'desc' : 'asc',
      };
    }
  }

  const filters: Record<string, GridFilterValue> = {};
  for (const [columnId, filter] of Object.entries(query.filters)) {
    const column = columnById.get(columnId);
    if (!column || !isFilterableColumn(column)) {
      continue;
    }
    if (!column.filter) {
      continue;
    }
    if (!isFilterTypeCompatible(column.filter.type, filter)) {
      continue;
    }
    if (isEmptyFilter(filter)) {
      continue;
    }
    filters[columnId] = filter;
  }

  return { sort, filters };
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    if (left === right) {
      return 0;
    }
    return left ? 1 : -1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    if (left === right) {
      return 0;
    }
    return left > right ? 1 : -1;
  }
  const leftText = String(left).toLowerCase();
  const rightText = String(right).toLowerCase();
  if (leftText === rightText) {
    return 0;
  }
  return leftText > rightText ? 1 : -1;
}

function matchesTextFilter(value: unknown, filter: Extract<GridFilterValue, { type: 'text' }>): boolean {
  const haystack = String(value ?? '').toLowerCase();
  const needle = filter.value.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return haystack.includes(needle);
}

function matchesBooleanFilter(value: unknown, filter: Extract<GridFilterValue, { type: 'boolean' }>): boolean {
  if (filter.value === 'all') {
    return true;
  }
  const boolValue = Boolean(value);
  return filter.value === 'true' ? boolValue : !boolValue;
}

function matchesSelectFilter(value: unknown, filter: Extract<GridFilterValue, { type: 'select' }>): boolean {
  const raw = value == null ? '' : String(value);
  if (Array.isArray(filter.value)) {
    if (filter.value.length === 0) {
      return true;
    }
    return filter.value.includes(raw);
  }
  if (!filter.value) {
    return true;
  }
  return raw === filter.value;
}

function matchesDateRangeFilter(
  value: unknown,
  filter: Extract<GridFilterValue, { type: 'dateRange' }>,
): boolean {
  const raw = value == null ? '' : String(value).slice(0, 10);
  if (!raw) {
    return false;
  }
  if (filter.from && raw < filter.from) {
    return false;
  }
  if (filter.to && raw > filter.to) {
    return false;
  }
  return true;
}

function matchesFilter(value: unknown, filter: GridFilterValue): boolean {
  switch (filter.type) {
    case 'text':
      return matchesTextFilter(value, filter);
    case 'boolean':
      return matchesBooleanFilter(value, filter);
    case 'select':
      return matchesSelectFilter(value, filter);
    case 'dateRange':
      return matchesDateRangeFilter(value, filter);
    default:
      return true;
  }
}

function warnMissingAccessor(columnId: string, capability: 'sort' | 'filter') {
  if (import.meta.env?.PROD) {
    return;
  }
  const key = `${columnId}:${capability}`;
  if (warnedMissingAccessors.has(key)) {
    return;
  }
  warnedMissingAccessors.add(key);
  console.warn(
    `[AppTableGrid] client ${capability} ignored for column "${columnId}": missing get${capability === 'sort' ? 'Sort' : 'Filter'}Value accessor.`,
  );
}

export function applyClientGridQuery<TRow>(
  rows: ReadonlyArray<TRow>,
  query: GridQueryState,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  gridDefaultMode: GridColumnQueryMode = 'client',
): TRow[] {
  const sanitized = sanitizeGridQuery(query, columns, gridDefaultMode);
  const columnById = new Map(columns.map((column) => [column.id, column]));

  let result = [...rows];

  for (const [columnId, filter] of Object.entries(sanitized.filters)) {
    const column = columnById.get(columnId);
    if (!column) {
      continue;
    }
    const mode = resolveColumnMode(column, 'filter', gridDefaultMode);
    if (mode !== 'client') {
      continue;
    }
    if (!column.getFilterValue) {
      warnMissingAccessor(columnId, 'filter');
      continue;
    }
    const getFilterValue = column.getFilterValue;
    result = result.filter((row) => matchesFilter(getFilterValue(row), filter));
  }

  if (sanitized.sort) {
    const column = columnById.get(sanitized.sort.columnId);
    if (column) {
      const mode = resolveColumnMode(column, 'sort', gridDefaultMode);
      if (mode === 'client') {
        if (!column.getSortValue) {
          warnMissingAccessor(sanitized.sort.columnId, 'sort');
        } else {
          const direction = sanitized.sort.direction;
          const getSortValue = column.getSortValue;
          result = [...result].sort((left, right) => {
            const compare = compareValues(getSortValue(left), getSortValue(right));
            return direction === 'asc' ? compare : -compare;
          });
        }
      }
    }
  }

  return result;
}

export function toggleColumnSort(
  currentQuery: GridQueryState,
  columnId: string,
  column: AppTableGridColumnDef<unknown>,
): GridQueryState | null {
  if (!isSortableColumn(column)) {
    return null;
  }

  const current = currentQuery.sort;
  if (!current || current.columnId !== columnId) {
    return { ...currentQuery, sort: { columnId, direction: 'asc' } };
  }
  if (current.direction === 'asc') {
    return { ...currentQuery, sort: { columnId, direction: 'desc' } };
  }
  return { ...currentQuery, sort: null };
}

export function createEmptyFilterValue(type: GridFilterType, multiple = false): GridFilterValue {
  switch (type) {
    case 'text':
      return { type: 'text', value: '' };
    case 'boolean':
      return { type: 'boolean', value: 'all' };
    case 'select':
      return { type: 'select', value: multiple ? [] : '' };
    case 'dateRange':
      return { type: 'dateRange', from: null, to: null };
    default:
      return { type: 'text', value: '' };
  }
}

export function isFilterActive(filter: GridFilterValue | undefined): boolean {
  if (!filter) {
    return false;
  }
  return !isEmptyFilter(filter);
}

export function setColumnFilter(
  currentQuery: GridQueryState,
  columnId: string,
  filter: GridFilterValue,
): GridQueryState {
  const nextFilters = { ...currentQuery.filters };
  if (isEmptyFilter(filter)) {
    delete nextFilters[columnId];
  } else {
    nextFilters[columnId] = filter;
  }
  return { ...currentQuery, filters: nextFilters };
}

export function gridQueryToFooterSort<TSort extends string>(
  query: GridQueryState,
  allowedFields: ReadonlyArray<TSort>,
): { sortBy: TSort | null; sortDirection: GridSortDirection } {
  const sortBy = query.sort && allowedFields.includes(query.sort.columnId as TSort)
    ? (query.sort.columnId as TSort)
    : null;
  return {
    sortBy,
    sortDirection: query.sort?.direction ?? 'asc',
  };
}

export function footerSortToGridQuery<TSort extends string>(
  sortBy: TSort,
  sortDirection: GridSortDirection,
  currentQuery: GridQueryState,
): GridQueryState {
  return {
    ...currentQuery,
    sort: { columnId: sortBy, direction: sortDirection },
  };
}

export function areGridQueriesEqual(left: GridQueryState, right: GridQueryState): boolean {
  if (left.sort?.columnId !== right.sort?.columnId || left.sort?.direction !== right.sort?.direction) {
    return false;
  }

  const leftKeys = Object.keys(left.filters).sort();
  const rightKeys = Object.keys(right.filters).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) {
      return false;
    }
    if (JSON.stringify(left.filters[key]) !== JSON.stringify(right.filters[key])) {
      return false;
    }
  }

  return true;
}
