import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { useCollapsingListToolbar } from '../../../shared/lib/useCollapsingListToolbar';
import { useLocation } from 'react-router-dom';
import { APP_GRID_IDS } from '../../../shared/api/contracts/grids/gridIds';
import { formatQueryError } from '../../../shared/api/client';
import {
  RECORD_EVENT_FILTER_ALL,
  listRecordEventDataApiFilters,
  listRecordEventPlatformApiFilters,
  mergeRecordEventEntityOptions,
  parseDataApiFilterValue,
  resolveRecordEventSubjectKinds,
  toRecordEventListKindParams,
  type RecordEventPublicRow,
} from '../../../shared/api/contracts/record-events';
import { useEdgeApiDefinitionsQuery, useEdgeModelsQuery } from '../../../shared/api/queries/data-api';
import {
  fetchHttpLogLink,
  useRecordEventsListQuery,
} from '../../../shared/api/queries/recordEvents';
import { useLogViewerSettingsQuery } from '../../../shared/api/queries/logs';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { resolveStudioLogsHref } from '../../../shared/lib/studioLogsHref';
import { useGridColumnLayout } from '../../../shared/lib/useGridColumnLayout';
import { useGridQueryState } from '../../../shared/lib/useGridQueryState';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import {
  sanitizeListWhereTree,
  serializeListWhereTree,
  useListFilter,
  type WhereGroupNode,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { useShellNavigate } from '../../../shared/ui/shell/useShellNavigate';
import {
  DEFAULT_LIST_MODE,
  DEFAULT_PAGE_SIZE,
} from '../constants';
import {
  createRecordEventsWhereFields,
  RECORD_EVENTS_WHERE_OPERATORS,
  recordEventKindParamsFromWhere,
  sanitizeRecordEventsWhereTree,
} from '../recordEventsListFilter';
import { createRecordEventGridColumns } from '../recordEventGridColumns';

type RecordEventsFilters = {
  where: WhereGroupNode;
};

const DEFAULT_FILTERS: RecordEventsFilters = {
  where: sanitizeRecordEventsWhereTree(null, createRecordEventsWhereFields({
    entityOptions: [],
    apiOptions: [],
  })),
};

function sanitizeFilters(raw: unknown): RecordEventsFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const whereSource = record.where ?? (record.kind === 'group' ? record : null);
  return {
    where: sanitizeRecordEventsWhereTree(whereSource, createRecordEventsWhereFields({
      entityOptions: [],
      apiOptions: [],
    })),
  };
}

export function useRecordEventsPage() {
  const t = useCultureT();
  const navigateShell = useShellNavigate();
  const { pathname } = useLocation();
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.recordEvents,
    defaultFilters: DEFAULT_FILTERS,
    sanitize: sanitizeFilters,
  });
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.recordEvents,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    defaultListMode: DEFAULT_LIST_MODE,
  });
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [selectedEvent, setSelectedEvent] = useState<RecordEventPublicRow | null>(null);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showControlDialog, setShowControlDialog] = useState(false);
  const modelsQuery = useEdgeModelsQuery();
  const definitionsQuery = useEdgeApiDefinitionsQuery();
  const settingsQuery = useLogViewerSettingsQuery();
  const includeArchivedAllowed = Boolean(settingsQuery.data?.recordEventsIncludeArchivedAllowed);

  useEffect(() => {
    if (!includeArchivedAllowed && includeArchived) {
      setIncludeArchived(false);
    }
  }, [includeArchived, includeArchivedAllowed]);

  const dataApiFilters = useMemo(
    () => listRecordEventDataApiFilters(definitionsQuery.data ?? [], modelsQuery.data ?? []),
    [definitionsQuery.data, modelsQuery.data],
  );
  const apiOptions = useMemo(
    () => [...listRecordEventPlatformApiFilters(), ...dataApiFilters],
    [dataApiFilters],
  );
  const entityOptions = useMemo(
    () => mergeRecordEventEntityOptions({
      models: (modelsQuery.data ?? []).map((model) => ({
        objectName: model.objectName,
        title: model.labels.title,
      })),
    }),
    [modelsQuery.data],
  );
  const entityTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    for (const item of entityOptions) {
      if (item.value !== RECORD_EVENT_FILTER_ALL) titles[item.value] = item.label;
    }
    return titles;
  }, [entityOptions]);
  const whereFields = useMemo(
    () => createRecordEventsWhereFields({ entityOptions, apiOptions }),
    [apiOptions, entityOptions],
  );
  const setWhere = useCallback((next: WhereGroupNode) => {
    setFilters({ where: sanitizeListWhereTree(next, whereFields, RECORD_EVENTS_WHERE_OPERATORS) });
  }, [setFilters, whereFields]);

  const viewHttpLog = useCallback((requestId: string) => {
    void (async () => {
      const { data } = await fetchHttpLogLink(requestId);
      if (data.exists) {
        navigateShell(resolveStudioLogsHref(pathname, requestId));
        return;
      }
      setLogMessage(t(operationsKey('recordEvents.logExpired')));
    })();
  }, [navigateShell, pathname, t]);

  const openDetail = useCallback((item: RecordEventPublicRow) => {
    setSelectedEvent(item);
    setLogMessage(null);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const gridColumns = useMemo(
    () => createRecordEventGridColumns({
      onOpenDetail: openDetail,
      onViewHttpLog: viewHttpLog,
      entityTitles,
    }),
    [entityTitles, openDetail, viewHttpLog],
  );

  const { query, handleGridQueryChange } = useGridQueryState({
    columns: gridColumns,
    gridQueryMode: 'server',
    persistListKey: APP_LIST_PREFERENCE_KEYS.recordEvents,
  });

  const { layout: columnLayout, setLayout: handleColumnLayoutChange } = useGridColumnLayout({
    columns: gridColumns,
    gridId: APP_GRID_IDS.recordEvents,
  });

  const extracted = useMemo(
    () => recordEventKindParamsFromWhere(filters.where, dataApiFilters),
    [dataApiFilters, filters.where],
  );

  const kindParams = useMemo(() => {
    if (extracted.apiKinds.length > 1) {
      return {
        subjectKind: extracted.entity !== RECORD_EVENT_FILTER_ALL ? extracted.entity : undefined,
        subjectKinds: extracted.apiKinds.join(','),
      };
    }
    return toRecordEventListKindParams({
      entity: extracted.entity,
      api: extracted.api,
      dataApiFilters,
    });
  }, [dataApiFilters, extracted]);

  const includeAuth = useMemo(() => {
    if (!extracted.subjectId.trim()) return undefined;
    const kinds = resolveRecordEventSubjectKinds(kindParams);
    if (kinds === 'empty') return undefined;
    if (kinds?.includes('base_users') || kindParams.subjectKind === 'base_users') return '1';
    return undefined;
  }, [extracted.subjectId, kindParams]);

  const catalogsReady = !parseDataApiFilterValue(extracted.api) || definitionsQuery.isFetched;
  const listFilter = useListFilter({
    value: filters.where,
    fields: whereFields,
    operators: RECORD_EVENTS_WHERE_OPERATORS,
    onApply: setWhere,
  });
  const { filterActive } = listFilter;

  const kindParamsKey = `${kindParams.subjectKind ?? ''}|${kindParams.subjectKinds ?? ''}`;

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [
    extracted.subjectId,
    filterActive,
    filters.where,
    includeArchived,
    includeAuth,
    kindParamsKey,
    listMode,
    pageSize,
  ]);

  const listParams = useMemo(() => ({
    subjectKind: kindParams.subjectKind,
    subjectKinds: kindParams.subjectKinds,
    subjectId: extracted.subjectId.trim() || undefined,
    includeAuth,
    includeArchived: includeArchived ? '1' : undefined,
    where: filterActive ? serializeListWhereTree(filters.where) : undefined,
    limit: listMode === 'infinite' ? visibleCount : pageSize,
    offset: listMode === 'infinite' ? 0 : (page - 1) * pageSize,
  }), [
    extracted.subjectId,
    filterActive,
    filters.where,
    includeArchived,
    includeAuth,
    kindParams.subjectKind,
    kindParams.subjectKinds,
    listMode,
    page,
    pageSize,
    visibleCount,
  ]);

  const eventsQuery = useRecordEventsListQuery(listParams, { enabled: catalogsReady });
  const items = eventsQuery.data?.items ?? [];
  const totalCount = eventsQuery.data?.totalCount ?? items.length;
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
    displayItems: items,
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
  const isLoading = eventsQuery.isFetching
    || (Boolean(extracted.api !== RECORD_EVENT_FILTER_ALL) && !catalogsReady);
  const isError = eventsQuery.isError;
  const loadError = isError
    ? formatQueryError(eventsQuery.error, t(operationsKey('recordEvents.loadFailed')))
    : null;

  const loadEvents = useCallback(async () => {
    await eventsQuery.refetch();
  }, [eventsQuery]);

  useEffect(() => {
    if (!logMessage) return;
    const timer = window.setTimeout(() => setLogMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [logMessage]);

  useEffect(() => {
    if (eventsQuery.data?.archiveUnavailable) {
      setLogMessage(t(operationsKey('recordEvents.archiveUnavailable')));
    }
  }, [eventsQuery.data?.archiveUnavailable, t]);

  return {
    gridColumns,
    columnLayout,
    handleColumnLayoutChange,
    query,
    handleGridQueryChange,
    whereFields,
    filterOperators: RECORD_EVENTS_WHERE_OPERATORS,
    ...listFilter,
    isLoading,
    isError,
    loadError,
    retryLoadEvents: loadEvents,
    isRetryingEvents: eventsQuery.isFetching && isError,
    loadEvents,
    showControlDialog,
    setShowControlDialog,
    logMessage,
    clearLogMessage: () => setLogMessage(null),
    includeArchived,
    setIncludeArchived,
    includeArchivedAllowed,
    selectedEvent,
    openDetail,
    closeDetail,
    viewHttpLog,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    presentation,
    onGridScroll,
  };
}

export type RecordEventsPageModel = ReturnType<typeof useRecordEventsPage>;
