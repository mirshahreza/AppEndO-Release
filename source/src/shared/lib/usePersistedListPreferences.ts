import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import {
  DEFAULT_GRID_LIST_MODE,
  DEFAULT_GRID_PAGE_SIZE,
  GRID_PAGE_SIZES,
  type GridListMode,
} from './gridPagingConstants';
import {
  patchStoredListPreferences,
  resolveStoredListFilters,
  resolveStoredListMode,
  resolveStoredPageSize,
} from './listPreferencesStorage';

export type UsePersistedListPagingOptions = {
  listKey: string;
  defaultPageSize?: number;
  defaultListMode?: GridListMode;
  allowedPageSizes?: ReadonlyArray<number>;
};

export function usePersistedListPaging({
  listKey,
  defaultPageSize = DEFAULT_GRID_PAGE_SIZE,
  defaultListMode = DEFAULT_GRID_LIST_MODE,
  allowedPageSizes = GRID_PAGE_SIZES,
}: UsePersistedListPagingOptions) {
  const [pageSize, setPageSizeState] = useState(() =>
    resolveStoredPageSize(listKey, defaultPageSize, allowedPageSizes),
  );
  const [listMode, setListModeState] = useState<GridListMode>(() =>
    resolveStoredListMode(listKey, defaultListMode),
  );

  const setPageSize = useCallback((next: number) => {
    setPageSizeState(next);
    patchStoredListPreferences(listKey, { pageSize: next });
  }, [listKey]);

  const setListMode = useCallback((next: GridListMode) => {
    setListModeState(next);
    patchStoredListPreferences(listKey, { listMode: next });
  }, [listKey]);

  return {
    pageSize,
    setPageSize,
    listMode,
    setListMode,
  };
}

export type UsePersistedListFiltersOptions<T> = {
  listKey: string;
  defaultFilters: T;
  sanitize: (raw: unknown) => T | null;
};

export function usePersistedListFilters<T>({
  listKey,
  defaultFilters,
  sanitize,
}: UsePersistedListFiltersOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  const [filters, setFiltersState] = useState<T>(() =>
    resolveStoredListFilters(listKey, defaultFilters, sanitize),
  );

  const setFilters = useCallback<Dispatch<SetStateAction<T>>>((updater) => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (value: T) => T)(prev)
        : updater;
      patchStoredListPreferences(listKey, { filters: next });
      return next;
    });
  }, [listKey]);

  return [filters, setFilters];
}
