import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchLogDetail,
  useClearLogsMutation,
  useLogViewerSettingsQuery,
  useLogsListQuery,
} from '@/src/shared/api/queries/logs';
import { mapGridQueryToLogsListQuery } from '@/src/shared/api/contracts/logs/listQuery';
import { APP_GRID_IDS } from '@/src/shared/api/contracts/grids/gridIds';
import { formatQueryError } from '@/src/shared/api/client';
import type { GridListMode } from '@/src/shared/lib/gridPagingConstants';
import { useGridColumnLayout } from '@/src/shared/lib/useGridColumnLayout';
import { useGridListPresentation } from '@/src/shared/lib/useGridListPresentation';
import { useGridQueryState } from '@/src/shared/lib/useGridQueryState';
import { useCultureT } from '@/src/core/culture/CultureContext';
import { operationsKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import { createLogGridColumns } from '../logGridColumns';
import {
  DEFAULT_LEVEL_FILTERS,
  DEFAULT_LIST_MODE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_VISIBLE_LEVELS,
  LOG_LEVELS,
} from '../constants';
import { buildDetailHeaderMessage, buildDetailJsonPreview } from '../utils/json';
import type { LogDetailItem, LogLevel } from '../types';

export function useLogsPage() {
  const t = useCultureT();
  const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>({ ...DEFAULT_LEVEL_FILTERS });
  const [visibleLevels, setVisibleLevels] = useState<Record<LogLevel, boolean>>({ ...DEFAULT_VISIBLE_LEVELS });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [viewerLimit, setViewerLimit] = useState(200);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(10);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listMode, setListMode] = useState<GridListMode>(DEFAULT_LIST_MODE);

  const [selectedLog, setSelectedLog] = useState<LogDetailItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const settingsQuery = useLogViewerSettingsQuery();

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
  });

  const {
    layout: columnLayout,
    setLayout: handleColumnLayoutChange,
  } = useGridColumnLayout({
    columns: gridColumns,
    gridId: APP_GRID_IDS.logs,
  });

  const listParams = useMemo(() => {
    const params = mapGridQueryToLogsListQuery(query, viewerLimit);

    const selectedLevels = LOG_LEVELS.filter((level) => visibleLevels[level] && levelFilters[level]);
    if (selectedLevels.length === 0) {
      params.level = [];
    } else if (selectedLevels.length < LOG_LEVELS.length) {
      params.level = selectedLevels.length === 1 ? selectedLevels[0] : selectedLevels;
    }

    return params;
  }, [
    query,
    viewerLimit,
    levelFilters,
    visibleLevels,
  ]);

  const logsQuery = useLogsListQuery(listParams);
  const clearLogsMutation = useClearLogsMutation();

  const logs = logsQuery.data ?? [];
  const presentation = useGridListPresentation({
    items: logs,
    pageSize,
    listMode,
    resetKeys: [listParams],
  });
  const isLoading = logsQuery.isFetching;
  const isError = logsQuery.isError;
  const loadError = isError
    ? formatQueryError(logsQuery.error, t(operationsKey('logs.loadFailed')))
    : null;

  useEffect(() => {
    const partial = settingsQuery.data;
    if (!partial) return;

    if (partial.viewerLimit) {
      setViewerLimit(partial.viewerLimit);
    }
    if (partial.autoRefreshSeconds) {
      setAutoRefreshSeconds(partial.autoRefreshSeconds);
    }
    if (partial.visibleLevels) {
      setVisibleLevels(partial.visibleLevels);
    }
  }, [settingsQuery.data]);

  const loadLogs = useCallback(async () => {
    await logsQuery.refetch();
  }, [logsQuery]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = window.setInterval(() => {
      void loadLogs();
    }, Math.max(1, autoRefreshSeconds) * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, autoRefreshSeconds, loadLogs]);

  const clearLogs = useCallback(async () => {
    await clearLogsMutation.mutateAsync();
    setSelectedLog(null);
    setShowClearConfirm(false);
  }, [clearLogsMutation]);

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
    levelFilters,
    setLevelFilters,
    visibleLevels,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshSeconds,
    isLoading,
    isError,
    loadError,
    retryLoadLogs: loadLogs,
    isRetryingLogs: logsQuery.isFetching && isError,
    logs,
    loadLogs,
    showClearConfirm,
    setShowClearConfirm,
    clearLogs,
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
  };
}

export type LogsPageModel = ReturnType<typeof useLogsPage>;
