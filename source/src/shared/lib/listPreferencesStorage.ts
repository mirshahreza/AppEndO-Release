import type { GridListMode } from './gridPagingConstants';
import { DEFAULT_GRID_LIST_MODE, GRID_PAGE_SIZES } from './gridPagingConstants';
import type { GridQueryState } from './appTableGridQuery';
import type { GridColumnLayoutState } from './appTableGridColumnLayout';
import { parseRawGridColumnLayout } from './userGridColumnLayouts';

export const LIST_PREFERENCES_STORAGE_PREFIX = 'appendo.list-prefs.';

export type StoredListPreferences = {
  v: 1;
  pageSize?: number;
  listMode?: GridListMode;
  filters?: unknown;
  gridQuery?: unknown;
  columnLayout?: GridColumnLayoutState;
};

function storageKey(listKey: string): string {
  return `${LIST_PREFERENCES_STORAGE_PREFIX}${listKey}`;
}

function isGridListMode(value: unknown): value is GridListMode {
  return value === 'paging' || value === 'infinite';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStoredGridQuery(value: unknown): value is GridQueryState {
  if (!isPlainObject(value)) return false;
  if (!('sort' in value) || !('filters' in value)) return false;
  const { sort, filters } = value;
  if (sort !== null && !isPlainObject(sort)) return false;
  if (sort !== null) {
    if (typeof sort.columnId !== 'string') return false;
    if (sort.direction !== 'asc' && sort.direction !== 'desc') return false;
  }
  return isPlainObject(filters);
}

export function readStoredListPreferences(listKey: string): StoredListPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(listKey));
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.v !== 1) return null;

    const next: StoredListPreferences = { v: 1 };

    if (typeof parsed.pageSize === 'number' && Number.isFinite(parsed.pageSize)) {
      next.pageSize = parsed.pageSize;
    }
    if (isGridListMode(parsed.listMode)) {
      next.listMode = parsed.listMode;
    }
    if ('filters' in parsed) {
      next.filters = parsed.filters;
    }
    if ('gridQuery' in parsed) {
      next.gridQuery = parsed.gridQuery;
    }
    if ('columnLayout' in parsed) {
      const layout = parseRawGridColumnLayout(parsed.columnLayout);
      if (layout) {
        next.columnLayout = layout;
      }
    }

    return next;
  } catch {
    return null;
  }
}

export function patchStoredListPreferences(
  listKey: string,
  patch: Partial<Omit<StoredListPreferences, 'v'>>,
): void {
  if (typeof window === 'undefined') return;

  try {
    const current = readStoredListPreferences(listKey) ?? { v: 1 as const };
    const next: StoredListPreferences = {
      v: 1,
      ...current,
      ...patch,
    };
    window.localStorage.setItem(storageKey(listKey), JSON.stringify(next));
  } catch {
    // ignore quota / privacy errors
  }
}

export function resolveStoredPageSize(
  listKey: string,
  defaultPageSize: number,
  allowedPageSizes: ReadonlyArray<number> = GRID_PAGE_SIZES,
): number {
  const stored = readStoredListPreferences(listKey)?.pageSize;
  if (typeof stored === 'number' && allowedPageSizes.includes(stored)) {
    return stored;
  }
  return defaultPageSize;
}

export function resolveStoredListMode(
  listKey: string,
  defaultListMode: GridListMode = DEFAULT_GRID_LIST_MODE,
): GridListMode {
  const stored = readStoredListPreferences(listKey)?.listMode;
  return isGridListMode(stored) ? stored : defaultListMode;
}

export function resolveStoredListFilters<T>(
  listKey: string,
  defaultFilters: T,
  sanitize: (raw: unknown) => T | null,
): T {
  const stored = readStoredListPreferences(listKey)?.filters;
  if (stored === undefined) return defaultFilters;
  return sanitize(stored) ?? defaultFilters;
}

export function resolveStoredGridQuery(
  listKey: string,
): GridQueryState | null {
  const stored = readStoredListPreferences(listKey)?.gridQuery;
  return isStoredGridQuery(stored) ? stored : null;
}

export function resolveStoredColumnLayout(
  listKey: string,
): GridColumnLayoutState | null {
  return readStoredListPreferences(listKey)?.columnLayout ?? null;
}

const COLUMN_LAYOUT_PERSIST_DEBOUNCE_MS = 450;
const pendingColumnLayouts = new Map<string, GridColumnLayoutState>();
const columnLayoutPersistTimers = new Map<string, number>();

export function persistStoredColumnLayout(
  listKey: string,
  layout: GridColumnLayoutState,
): void {
  if (typeof window === 'undefined' || !listKey.trim()) {
    return;
  }
  pendingColumnLayouts.set(listKey, layout);
  const existing = columnLayoutPersistTimers.get(listKey);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }
  const timerId = window.setTimeout(() => {
    columnLayoutPersistTimers.delete(listKey);
    const pending = pendingColumnLayouts.get(listKey);
    pendingColumnLayouts.delete(listKey);
    if (pending) {
      patchStoredListPreferences(listKey, { columnLayout: pending });
    }
  }, COLUMN_LAYOUT_PERSIST_DEBOUNCE_MS);
  columnLayoutPersistTimers.set(listKey, timerId);
}

export function flushStoredColumnLayout(listKey: string): void {
  if (typeof window === 'undefined' || !listKey.trim()) {
    return;
  }
  const existing = columnLayoutPersistTimers.get(listKey);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }
  columnLayoutPersistTimers.delete(listKey);
  const pending = pendingColumnLayouts.get(listKey);
  pendingColumnLayouts.delete(listKey);
  if (pending) {
    patchStoredListPreferences(listKey, { columnLayout: pending });
  }
}
