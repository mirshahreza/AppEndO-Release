import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useAdminInAppNotificationQuery, useAdminInAppNotificationsQuery } from '../../../shared/api/queries/adminInAppNotifications';
import type { InAppNotificationAdminRow } from '../../../shared/api/contracts/notifications/inAppNotificationsAdmin';
import { formatQueryError } from '../../../shared/api/client';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters, usePersistedListPaging } from '../../../shared/lib/usePersistedListPreferences';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { gridActionsColumnWidth } from '../../../shared/lib/gridRowActions';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey, operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { AppGridRowActions } from '../../../shared/ui';
import type { GridRowActionItem } from '../../../shared/ui/AppGridRowActions';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '../constants';

type InAppNotificationsListFilters = {
  searchInput: string;
  unreadOnly: boolean;
};

const DEFAULT_FILTERS: InAppNotificationsListFilters = {
  searchInput: '',
  unreadOnly: false,
};

function sanitizeFilters(raw: unknown): InAppNotificationsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    unreadOnly: record.unreadOnly === true,
  };
}

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const readStateLabel = (row: InAppNotificationAdminRow): string => {
  if (row.readAt) return 'Read';
  if (row.seenAt) return 'Seen';
  return 'Unread';
};

export function useInAppNotificationsAdminPage() {
  const t = useCultureT();
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.inAppNotifications,
    defaultFilters: DEFAULT_FILTERS,
    sanitize: sanitizeFilters,
  });
  const { searchInput, unreadOnly } = filters;
  const [searchText, setSearchText] = useState(searchInput);
  const [viewId, setViewId] = useState<number | null>(null);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.inAppNotifications,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    allowedPageSizes: PAGE_SIZES,
  });
  const [page, setPage] = useState(1);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);

  const setUnreadOnly = useCallback((next: boolean) => {
    setFilters((prev) => ({ ...prev, unreadOnly: next }));
    setPage(1);
  }, [setFilters]);

  const listQuery = useMemo(() => ({
    search: searchText,
    unreadOnly,
    page,
    pageSize,
  }), [searchText, unreadOnly, page, pageSize]);

  const notificationsQuery = useAdminInAppNotificationsQuery(listQuery);
  const detailQuery = useAdminInAppNotificationQuery(viewId, viewId !== null);

  const items = notificationsQuery.data?.items ?? [];
  const totalCount = notificationsQuery.data?.totalCount ?? 0;
  const isLoading = notificationsQuery.isLoading;
  const isError = notificationsQuery.isError;
  const error = isError
    ? formatQueryError(notificationsQuery.error, t(operationsKey('inAppNotifications.loadFailed')))
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchText(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const retryLoad = useCallback(() => {
    void notificationsQuery.refetch();
  }, [notificationsQuery]);

  const openView = useCallback((row: InAppNotificationAdminRow) => {
    setViewId(row.id);
  }, []);

  const closeView = useCallback(() => {
    setViewId(null);
  }, []);

    const getCardRowActions = useCallback((row: InAppNotificationAdminRow): readonly GridRowActionItem[] => [
    {
      id: 'view',
      label: t(operationsKey('inAppNotifications.viewDetail')),
      icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'view',
      cardLabeled: true,
      onClick: () => openView(row),
    },
  ], [openView, t]);

  const gridColumns = useMemo((): AppTableGridColumnDef<InAppNotificationAdminRow>[] => [
    {
      id: 'createdAt',
      label: t(columnCommonKey('created')),
      width: 168,
      card: { role: 'meta' },
      renderCell: (row) => (
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatWhen(row.createdAt)}</span>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'username',
      label: t(columnCommonKey('user')),
      width: 120,
      card: { role: 'subtitle' },
      renderCell: (row) => <span className="text-slate-700">{row.username}</span>,
      sort: false,
      filter: false,
    },
    {
      id: 'title',
      label: t(columnCommonKey('title')),
      card: { role: 'title' },
      renderCell: (row) => (
        <span className="block max-w-[280px] truncate font-medium text-slate-800" title={row.title}>
          {row.title}
        </span>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'source',
      label: t(columnCommonKey('source')),
      width: 112,
      card: { role: 'field', label: t(columnCommonKey('source')) },
      renderCell: (row) => <span className="font-mono text-[11px] text-slate-500">{row.source}</span>,
      sort: false,
      filter: false,
    },
    {
      id: 'readState',
      label: t(operationsKey('inAppNotifications.readState')),
      width: 88,
      card: { role: 'meta' },
      renderCell: (row) => <span className="text-xs text-slate-600">{readStateLabel(row)}</span>,
      sort: false,
      filter: false,
    },
    {
      id: 'actions',
      label: '',
      layout: { hideable: false, resizable: false },
      width: gridActionsColumnWidth(1),
      card: { role: 'actions' },
      renderCell: (row) => (
        <AppGridRowActions
          actions={[
            {
              id: 'view',
              label: t(operationsKey('inAppNotifications.viewDetail')),
              icon: <Eye className="h-3.5 w-3.5" />,
              intent: 'view',
              onClick: () => openView(row),
            },
          ]}
          align="start"
        />
      ),
      sort: false,
      filter: false,
    },
  ], [openView, t]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    for (let index = start; index <= end; index += 1) {
      numbers.push(index);
    }
    return numbers;
  }, [safePage, totalPages]);

  return {
    searchInput,
    setSearchInput,
    unreadOnly,
    setUnreadOnly,
    gridColumns,
    isLoading,
    isError,
    error,
    retryLoad,
    isRetrying: notificationsQuery.isFetching && !notificationsQuery.isLoading,
    rows: items,
    totalCount,
    pageSize,
    setPageSize: handlePageSizeChange,
    listMode,
    setListMode,
    safePage,
    totalPages,
    pageNumbers,
    setPage,
    viewId,
    viewItem: detailQuery.data ?? null,
    isViewLoading: detailQuery.isLoading,
    viewError: detailQuery.isError
      ? formatQueryError(detailQuery.error, t(operationsKey('inAppNotifications.detailFailed')))
      : null,
    closeView,
    emptyMessage: t(operationsKey('inAppNotifications.empty')),
    loadingMessage: t(operationsKey('inAppNotifications.loading')),
    searchPlaceholder: t(operationsKey('inAppNotifications.searchPlaceholder')),
    searchAria: t(operationsKey('inAppNotifications.searchAria')),
    unreadOnlyLabel: t(operationsKey('inAppNotifications.unreadOnly')),
    getCardRowActions,
  };
}

export type InAppNotificationsAdminPageState = ReturnType<typeof useInAppNotificationsAdminPage>;
