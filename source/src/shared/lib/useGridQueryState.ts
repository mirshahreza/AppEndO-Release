import { useCallback, useState } from 'react';
import {
  EMPTY_GRID_QUERY,
  footerSortToGridQuery,
  gridQueryToFooterSort,
  sanitizeGridQuery,
  type AppTableGridColumnDef,
  type GridColumnQueryMode,
  type GridQueryChangeMeta,
  type GridQueryState,
  type GridSortDirection,
} from './appTableGridQuery';
import {
  patchStoredListPreferences,
  resolveStoredGridQuery,
} from './listPreferencesStorage';

export type UseGridQueryStateOptions<TRow> = {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  gridQueryMode?: GridColumnQueryMode;
  initialQuery?: GridQueryState;
  /** When set, column sort/filter state is restored and saved in client localStorage for this list. */
  persistListKey?: string;
  onQueryChange?: (query: GridQueryState, meta: GridQueryChangeMeta) => void;
  onPageReset?: () => void;
};

export function useGridQueryState<TRow>({
  columns,
  gridQueryMode = 'client',
  initialQuery = EMPTY_GRID_QUERY,
  persistListKey,
  onQueryChange,
  onPageReset,
}: UseGridQueryStateOptions<TRow>) {
  const [query, setQueryState] = useState<GridQueryState>(() => {
    const stored = persistListKey ? resolveStoredGridQuery(persistListKey) : null;
    return sanitizeGridQuery(stored ?? initialQuery, columns, gridQueryMode);
  });

  const persistQuery = useCallback((next: GridQueryState) => {
    if (persistListKey) {
      patchStoredListPreferences(persistListKey, { gridQuery: next });
    }
  }, [persistListKey]);

  const setQuery = useCallback((next: GridQueryState) => {
    const sanitized = sanitizeGridQuery(next, columns, gridQueryMode);
    setQueryState(sanitized);
    persistQuery(sanitized);
  }, [columns, gridQueryMode, persistQuery]);

  const handleGridQueryChange = useCallback((
    nextQuery: GridQueryState,
    meta: GridQueryChangeMeta,
  ) => {
    const sanitized = sanitizeGridQuery(nextQuery, columns, gridQueryMode);
    setQueryState(sanitized);
    persistQuery(sanitized);
    onPageReset?.();
    onQueryChange?.(sanitized, meta);
  }, [columns, gridQueryMode, onPageReset, onQueryChange, persistQuery]);

  const setFooterSort = useCallback(<TSort extends string>(
    sortBy: TSort,
    sortDirection: GridSortDirection,
    allowedFields: ReadonlyArray<TSort>,
  ) => {
    if (!allowedFields.includes(sortBy)) {
      return;
    }
    handleGridQueryChange(
      footerSortToGridQuery(sortBy, sortDirection, query),
      { source: 'sort', columnId: sortBy },
    );
  }, [handleGridQueryChange, query]);

  const getFooterSort = useCallback(<TSort extends string>(
    allowedFields: ReadonlyArray<TSort>,
  ) => gridQueryToFooterSort(query, allowedFields), [query]);

  const getFooterSortBy = useCallback(<TSort extends string>(
    allowedFields: ReadonlyArray<TSort>,
    defaultField: TSort,
  ): TSort => getFooterSort(allowedFields).sortBy ?? defaultField, [getFooterSort]);

  return {
    query,
    setQuery,
    handleGridQueryChange,
    setFooterSort,
    getFooterSort,
    getFooterSortBy,
  };
}

export {
  footerSortToGridQuery,
  gridQueryToFooterSort,
} from './appTableGridQuery';
