import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchLogDetail,
  useLogViewerSettingsQuery,
  useLogsListQuery,
} from '../../../shared/api/queries/logs';
import { mapGridQueryToLogsListQuery } from '../../../shared/api/contracts/logs/listQuery';
import { APP_GRID_IDS } from '../../../shared/api/contracts/grids/gridIds';
import { formatQueryError } from '../../../shared/api/client';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridColumnLayout } from '../../../shared/lib/useGridColumnLayout';
import { useGridQueryState } from '../../../shared/lib/useGridQueryState';
import { GRID_PAGE_SIZES, type GridPageSize } from '../../../shared/lib/gridPagingConstants';
import { readStoredListPreferences } from '../../../shared/lib/listPreferencesStorage';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import {
  mergeWhereCondition,
  sanitizeListWhereTree,
  serializeListWhereTree,
  useListFilter,
  whereTreeHasField,
  type WhereGroupNode,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { createLogGridColumns } from '../logGridColumns';
import {
  DEFAULT_LIST_MODE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_VISIBLE_LEVELS,
  LOG_LEVELS,
} from '../constants';
import {
  createLogsWhereFields,
  LOGS_WHERE_OPERATORS,
  sanitizeLogsWhereTree,
} from '../logsListFilter';
import { buildDetailHeaderMessage, buildDetailJsonPreview } from '../utils/json';
import type { LogDetailItem, LogLevel } from '../types';

type LogsListFilters = {
  where: WhereGroupNode;
  visibleLevels: Record<LogLevel, boolean>;
};

const DEFAULT_LOGS_FILTERS: LogsListFilters = {
  where: sanitizeLogsWhereTree(null, createLogsWhereFields(DEFAULT_VISIBLE_LEVELS)),
  visibleLevels: { ...DEFAULT_VISIBLE_LEVELS },
};

function readVisibleLevels(raw: unknown): Record<LogLevel, boolean> {
  const visibleLevels: Record<LogLevel, boolean> = { ...DEFAULT_VISIBLE_LEVELS };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return visibleLevels;
  for (const level of LOG_LEVELS) {
    const value = (raw as Record<string, unknown>)[level];
    if (typeof value === 'boolean') visibleLevels[level] = value;
  }
  return visibleLevels;
}

function sanitizeLogsFilters(raw: unknown): LogsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const visibleLevels = readVisibleLevels(record.visibleLevels);
  const fields = createLogsWhereFields(visibleLevels);
  const whereSource = record.where ?? (record.kind === 'group' ? record : null);
  return {
    where: sanitizeLogsWhereTree(whereSource, fields),
    visibleLevels,
  };
}

export function useLogsPage() {
  const t = useCultureT();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestIdFilter = searchParams.get('requestId')?.trim() || undefined;
  const clearRequestIdFromUrl = useCallback(() => {
    if (!searchParams.has('requestId')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('requestId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.logs,
    defaultFilters: DEFAULT_LOGS_FILTERS,
    sanitize: sanitizeLogsFilters,
  });
  const { where, visibleLevels } = filters;
  const setWhere = useCallback((next: WhereGroupNode) => {
    setFilters((prev) => ({
      ...prev,
      where: sanitizeListWhereTree(next, createLogsWhereFields(prev.visibleLevels), LOGS_WHERE_OPERATORS),
    }));
  }, [setFilters]);
  const setVisibleLevels = useCallback((next: Record<LogLevel, boolean>) => {
    setFilters((prev) => ({
      ...prev,
      visibleLevels: next,
      where: sanitizeLogsWhereTree(prev.where, createLogsWhereFields(next)),
    }));
  }, [setFilters]);
  const whereFields = useMemo(() => createLogsWhereFields(visibleLevels), [visibleLevels]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.logs,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultListMode: DEFAULT_LIST_MODE,
  });

  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [selectedLog, setSelectedLog] = useState<LogDetailItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showControlDialog, setShowControlDialog] = useState(false);

  const settingsQuery = useLogViewerSettingsQuery();
  const includeArchivedAllowed = Boolean(settingsQuery.data?.includeArchivedAllowed);

  useEffect(() => {
    const limit = settingsQuery.data?.viewerLimit;
    if (typeof limit !== 'number' || !(GRID_PAGE_SIZES as readonly number[]).includes(limit)) {
      return;
    }
    const stored = readStoredListPreferences(APP_LIST_PREFERENCE_KEYS.logs);
    if (typeof stored?.pageSize === 'number' && (GRID_PAGE_SIZES as readonly number[]).includes(stored.pageSize)) {
      return;
    }
    setPageSize(limit as GridPageSize);
  }, [setPageSize, settingsQuery.data?.viewerLimit]);

  useEffect(() => {
    if (!includeArchivedAllowed && includeArchived) {
      setIncludeArchived(false);
    }
  }, [includeArchived, includeArchivedAllowed]);

  const openLogDetail = useCallback(async (id: number) => {
    setIsDetailLoading(true);
    setSelectedLog(null);
    try {
      const detail = await fetchLogDetail(id);
      setSelectedLog(detail);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const gridColumns = useMemo(
    () => createLogGridColumns({ onOpenDetail: (id) => { void openLogDetail(id); } }, t),
    [openLogDetail, t],
  );

  const {
    query,
    handleGridQueryChange,
  } = useGridQueryState({
    columns: gridColumns,
    gridQueryMode: 'server',
    persistListKey: APP_LIST_PREFERENCE_KEYS.logs,
  });

  const {
    layout: columnLayout,
    setLayout: handleColumnLayoutChange,
  } = useGridColumnLayout({
    columns: gridColumns,
    gridId: APP_GRID_IDS.logs,
  });

  const listFilter = useListFilter({
    value: where,
    fields: whereFields,
    operators: LOGS_WHERE_OPERATORS,
    onApply: setWhere,
    onClear: clearRequestIdFromUrl,
  });
  const { filterActive } = listFilter;

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [filterActive, includeArchived, listMode, pageSize, where, query.sort, query.filters]);

  const listParams = useMemo(() => {
    const params = mapGridQueryToLogsListQuery(
      query,
      listMode === 'infinite' ? visibleCount : pageSize,
    );
    params.offset = listMode === 'infinite' ? 0 : (page - 1) * pageSize;
    if (filterActive) {
      params.where = serializeListWhereTree(where);
    }
    if (includeArchived) {
      params.includeArchived = true;
    }
    return params;
  }, [filterActive, includeArchived, listMode, page, pageSize, query, visibleCount, where]);

  const logsQuery = useLogsListQuery(listParams);

  const logs = logsQuery.data?.items ?? [];
  const totalCount = logsQuery.data?.totalCount ?? logs.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    const pages: number[] = [];
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      pages.push(pageNumber);
    }
    return pages;
  }, [safePage, totalPages]);
  const visibleInfiniteCount = Math.min(visibleCount, totalCount);
  const hasMore = listMode === 'infinite' && visibleInfiniteCount < totalCount;
  const handleScrollEnd = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (listMode !== 'infinite' || !hasMore) return;
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      setVisibleCount((current) => current + pageSize);
    }
  }, [hasMore, listMode, pageSize]);

  const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    handleScrollEnd(event);
  }, [handleScrollEnd]);

  const presentation = {
    displayItems: logs,
    totalCount,
    page,
    setPage,
    safePage,
    totalPages,
    pageNumbers,
    visibleInfiniteCount,
    hasMore,
    handleScrollEnd,
  };
  const isLoading = logsQuery.isFetching;
  const isError = logsQuery.isError;
  const loadError = isError
    ? formatQueryError(logsQuery.error, t(operationsKey('logs.loadFailed')))
    : null;

  useEffect(() => {
    const partial = settingsQuery.data;
    if (!partial?.visibleLevels) return;
    setVisibleLevels(partial.visibleLevels);
  }, [settingsQuery.data, setVisibleLevels]);

  useEffect(() => {
    if (logsQuery.data?.archiveUnavailable) {
      setArchiveToast(t(operationsKey('logs.archiveUnavailable')));
    }
  }, [logsQuery.data?.archiveUnavailable, t]);

  useEffect(() => {
    if (!archiveToast) return;
    const timer = window.setTimeout(() => setArchiveToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [archiveToast]);

  useEffect(() => {
    if (!requestIdFilter || whereTreeHasField(where, 'requestId')) return;
    setWhere(mergeWhereCondition(where, 'requestId', 'eq', requestIdFilter));
  }, [requestIdFilter, setWhere, where]);

  const loadLogs = useCallback(async () => {
    await logsQuery.refetch();
  }, [logsQuery]);

  const closeLogDetail = useCallback(() => {
    setSelectedLog(null);
    setIsDetailLoading(false);
  }, []);

  const detailJsonPreview = useMemo(
    () => (selectedLog ? buildDetailJsonPreview(selectedLog.meta, selectedLog.message) : ''),
    [selectedLog],
  );

  const detailHeaderMessage = useMemo(
    () => (selectedLog
      ? buildDetailHeaderMessage(selectedLog.message, t(operationsKey('logs.noMessage')))
      : t(operationsKey('logs.detailFallback'))),
    [selectedLog, t],
  );

  return {
    gridColumns,
    columnLayout,
    handleColumnLayoutChange,
    query,
    handleGridQueryChange,
    whereFields,
    filterOperators: LOGS_WHERE_OPERATORS,
    ...listFilter,
    includeArchived,
    setIncludeArchived,
    includeArchivedAllowed,
    archiveToast,
    setArchiveToast,
    isLoading,
    isError,
    loadError,
    retryLoadLogs: loadLogs,
    isRetryingLogs: logsQuery.isFetching && isError,
    logs,
    loadLogs,
    showControlDialog,
    setShowControlDialog,
    isDetailLoading,
    selectedLog,
    openLogDetail,
    closeLogDetail,
    detailJsonPreview,
    detailHeaderMessage,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    presentation,
    onGridScroll,
  };
}

export type LogsPageModel = ReturnType<typeof useLogsPage>;
