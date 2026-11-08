import { useCallback, useMemo, useState } from 'react';
import { formatQueryError } from '../../../shared/api/client';
import { mapGridQueryToCacheEntriesListQuery } from '../../../shared/api/contracts/cache/listQuery';
import {
  fetchCacheEntryValue,
  useCacheEntriesQuery,
  useCacheStatusQuery,
  useEvictKeyMutation,
  useFlushCacheMutation,
} from '../../../shared/api/queries/cache';
import type { CacheEntryRecord } from '../../../shared/api/contracts/cache/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridListPresentation } from '../../../shared/lib/useGridListPresentation';
import { useListPagePresentationScroll } from '../../../shared/lib/useListPagePresentationScroll';
import { useGridQueryState } from '../../../shared/lib/useGridQueryState';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { createCacheGridColumns } from '../cacheGridColumns';
import { CACHE_SORT_FIELDS, DEFAULT_PAGE_SIZE } from '../constants';

export type CachePageModel = ReturnType<typeof useCachePage>;

type CacheListFilters = {
  filterQuery: string;
};

const DEFAULT_CACHE_FILTERS: CacheListFilters = {
  filterQuery: '',
};

function sanitizeCacheFilters(raw: unknown): CacheListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    filterQuery: typeof record.filterQuery === 'string' ? record.filterQuery : '',
  };
}

export function useCachePage() {
  const t = useCultureT();
  const statusQuery = useCacheStatusQuery();
  const flushMutation = useFlushCacheMutation();
  const evictMutation = useEvictKeyMutation();

  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.cache,
    defaultFilters: DEFAULT_CACHE_FILTERS,
    sanitize: sanitizeCacheFilters,
  });
  const filterQuery = filters.filterQuery;
  const setFilterQuery = useCallback((next: string) => {
    setFilters({ filterQuery: next });
  }, [setFilters]);
  const [actionError, setActionError] = useState<string | null>(null);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.cache,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const [viewItem, setViewItem] = useState<CacheEntryRecord | null>(null);
  const [viewValue, setViewValue] = useState<string | null>(null);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [showFlushConfirm, setShowFlushConfirm] = useState(false);

  const handleViewItem = useCallback(async (item: CacheEntryRecord) => {
    setViewItem(item);
    setViewValue(null);
    setIsViewLoading(true);

    const result = await fetchCacheEntryValue(item.cacheKey);
    setViewValue(result.error ?? result.value);
    setIsViewLoading(false);
  }, []);

  const handleEvictItem = useCallback(async (key: string) => {
    setActionError(null);
    try {
      const { data, response } = await evictMutation.mutateAsync(key);
      if (!response.ok || !data.success) {
        setActionError(t(operationsKey('cache.evictFailed')));
      }
    } catch {
      setActionError(t(operationsKey('cache.evictNetworkError')));
    }
  }, [evictMutation, t]);

  const gridColumns = useMemo(
    () => createCacheGridColumns({
      onView: (item) => { void handleViewItem(item); },
      onEvict: (key) => { void handleEvictItem(key); },
    }, t),
    [handleEvictItem, handleViewItem, t],
  );

  const {
    query,
    handleGridQueryChange,
    setFooterSort,
    getFooterSort,
    getFooterSortBy,
  } = useGridQueryState({
    columns: gridColumns,
    gridQueryMode: 'server',
    persistListKey: APP_LIST_PREFERENCE_KEYS.cache,
    initialQuery: {
      sort: { columnId: 'cacheKey', direction: 'asc' },
      filters: {},
    },
  });

  const listParams = useMemo(
    () => mapGridQueryToCacheEntriesListQuery(query),
    [query],
  );

  const entriesQuery = useCacheEntriesQuery(listParams);
  const cacheItems = entriesQuery.data ?? [];
  const isLoading = entriesQuery.isLoading;
  const isError = entriesQuery.isError;
  const listError = isError
    ? formatQueryError(entriesQuery.error, t(operationsKey('cache.loadFailed')))
    : null;

  const filteredItems = useMemo(() => cacheItems.filter((item) => (
    String(item.cacheKey || '').toLowerCase().includes(filterQuery.toLowerCase())
  )), [cacheItems, filterQuery]);

  const presentation = useGridListPresentation({
    items: filteredItems,
    pageSize,
    listMode,
    resetKeys: [filterQuery, listParams],
  });
  const onGridScroll = useListPagePresentationScroll(presentation);

    const footerSort = getFooterSort(CACHE_SORT_FIELDS);
  const sortBy = getFooterSortBy(CACHE_SORT_FIELDS, 'cacheKey');
  const sortDirection = footerSort.sortDirection;

  const retryLoadEntries = useCallback(() => {
    setActionError(null);
    void entriesQuery.refetch();
  }, [entriesQuery]);

  const refresh = useCallback(async () => {
    setActionError(null);
    await Promise.all([
      entriesQuery.refetch(),
      statusQuery.refetch(),
    ]);
  }, [entriesQuery, statusQuery]);

  const handleEvictAll = useCallback(async () => {
    setActionError(null);
    try {
      const { data, response } = await flushMutation.mutateAsync();
      if (!response.ok || !data.success) {
        setActionError(t(operationsKey('cache.flushFailed')));
        return;
      }
      setShowFlushConfirm(false);
    } catch {
      setActionError(t(operationsKey('cache.flushNetworkError')));
    }
  }, [flushMutation, t]);

  const closeViewModal = useCallback(() => {
    setViewItem(null);
    setViewValue(null);
    setIsViewLoading(false);
  }, []);

  const openFlushConfirm = useCallback(() => {
    setShowFlushConfirm(true);
  }, []);

  const closeFlushConfirm = useCallback(() => {
    setShowFlushConfirm(false);
  }, []);

  return {
    gridColumns,
    query,
    handleGridQueryChange,
    filteredItems,
    visibleItems: presentation.displayItems,
    presentation,
    onGridScroll,
    filterQuery,
    setFilterQuery,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    sortBy,
    sortDirection,
    setFooterSort,
    isLoading,
    isError,
    listError,
    actionError,
    retryLoadEntries,
    isRetryingEntries: entriesQuery.isFetching && isError,
    refresh,
    cacheStatus: statusQuery.data ?? null,
    showFlushConfirm,
    openFlushConfirm,
    closeFlushConfirm,
    handleEvictAll,
    handleEvictItem,
    viewItem,
    viewValue,
    isViewLoading,
    handleViewItem,
    closeViewModal,
  };
}
