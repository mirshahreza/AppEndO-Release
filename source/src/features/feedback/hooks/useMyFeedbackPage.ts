import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { FeedbackStatus, FeedbackTicketDetailDto, FeedbackTicketDto } from '../../../shared/api/contracts/feedback/types';
import { FEEDBACK_STATUSES } from '../../../shared/api/contracts/feedback/constants';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import { feedbackApi, FeedbackApiError } from '../api/feedbackApi';
import { DEFAULT_PAGE_SIZE, MY_FEEDBACK_SORT_FIELD, PAGE_SIZES } from '../constants';
import { createMyFeedbackGridColumns } from '../myFeedbackGridColumns';
import {
  FEEDBACK_TICKET_SEARCH_PARAM,
  readFeedbackTicketId,
} from '../feedbackTicketDeepLink';
import { useFeedbackPolicy } from './useFeedbackPolicy';

export type MyFeedbackStatusFilter = 'ALL' | FeedbackStatus;
export type MyFeedbackSubjectFilter = 'ALL' | string;

export type MyFeedbackPageModel = ReturnType<typeof useMyFeedbackPage>;

type MyFeedbackListFilters = {
  searchInput: string;
  statusFilter: MyFeedbackStatusFilter;
  subjectFilter: MyFeedbackSubjectFilter;
};

const DEFAULT_MY_FEEDBACK_FILTERS: MyFeedbackListFilters = {
  searchInput: '',
  statusFilter: 'ALL',
  subjectFilter: 'ALL',
};

function sanitizeMyFeedbackFilters(raw: unknown): MyFeedbackListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const statusFilter = record.statusFilter === 'ALL'
    || (typeof record.statusFilter === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(record.statusFilter))
    ? record.statusFilter as MyFeedbackStatusFilter
    : 'ALL';
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    statusFilter,
    subjectFilter: typeof record.subjectFilter === 'string' ? record.subjectFilter : 'ALL',
  };
}

export function useMyFeedbackPage() {
  const t = useCultureT();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkTicketId = readFeedbackTicketId(searchParams);
  const { policy } = useFeedbackPolicy();
  const [items, setItems] = useState<FeedbackTicketDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<FeedbackTicketDetailDto | null>(null);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.myFeedback,
    defaultFilters: DEFAULT_MY_FEEDBACK_FILTERS,
    sanitize: sanitizeMyFeedbackFilters,
  });
  const { searchInput, statusFilter, subjectFilter } = filters;
  const [searchText, setSearchText] = useState(searchInput);
  const [page, setPage] = useState(1);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.myFeedback,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    allowedPageSizes: PAGE_SIZES,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);

  const setStatusFilter = useCallback((next: MyFeedbackStatusFilter) => {
    setFilters((prev) => ({ ...prev, statusFilter: next }));
  }, [setFilters]);

  const setSubjectFilter = useCallback((next: MyFeedbackSubjectFilter) => {
    setFilters((prev) => ({ ...prev, subjectFilter: next }));
  }, [setFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchText(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (refreshMode: 'initial' | 'refresh' = 'initial') => {
    if (refreshMode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const result = await feedbackApi.listMine({
        page,
        pageSize,
        search: searchText || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        subjectId: subjectFilter === 'ALL' ? undefined : subjectFilter,
      });
      setItems(result.items);
      setTotalCount(result.total);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.loadError'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, pageSize, searchText, statusFilter, subjectFilter, t]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const setTicketInUrl = useCallback((ticketId: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (ticketId) {
        next.set(FEEDBACK_TICKET_SEARCH_PARAM, ticketId);
      } else {
        next.delete(FEEDBACK_TICKET_SEARCH_PARAM);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (deepLinkTicketId) {
      return;
    }
    setSelected(null);
  }, [deepLinkTicketId, page, pageSize, searchText, statusFilter, subjectFilter]);

  const subjectOptions = useMemo(
    () => [...policy.subjects]
      .map((subject) => ({ id: subject.id, label: subject.label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [policy.subjects],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    for (let index = start; index <= end; index += 1) {
      numbers.push(index);
    }
    return numbers;
  }, [safePage, totalPages]);

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: MyFeedbackStatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleSubjectFilterChange = useCallback((value: MyFeedbackSubjectFilter) => {
    setSubjectFilter(value);
    setPage(1);
  }, []);

  const openTicketById = useCallback(async (ticketId: string) => {
    setDetailError(null);
    try {
      const result = await feedbackApi.getMine(ticketId);
      setSelected(result.ticket);
      setItems((current) => (
        current.some((entry) => entry.id === ticketId)
          ? current
          : [result.ticket, ...current]
      ));
      await feedbackApi.markMineRead(ticketId);
      setItems((current) =>
        current.map((entry) => (entry.id === ticketId ? { ...entry, unreadCount: 0 } : entry)),
      );
    } catch (err) {
      setSelected(null);
      setDetailError(err instanceof FeedbackApiError ? err.message : t('feedback.inbox.detailError'));
    }
  }, [t]);

  useEffect(() => {
    if (!deepLinkTicketId) {
      return;
    }
    if (selected?.id === deepLinkTicketId) {
      return;
    }
    void openTicketById(deepLinkTicketId);
  }, [deepLinkTicketId, openTicketById, selected?.id]);

  const openTicket = useCallback((item: FeedbackTicketDto) => {
    setTicketInUrl(item.id);
  }, [setTicketInUrl]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const gridColumns = useMemo(
    () => createMyFeedbackGridColumns(t),
    [t],
  );

    return {
    items,
    totalCount,
    gridColumns,
    selected,
    setSelected,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter: handleStatusFilterChange,
    subjectFilter,
    setSubjectFilter: handleSubjectFilterChange,
    subjectOptions,
    statusOptions: FEEDBACK_STATUSES,
    pageSize,
    setPageSize: handlePageSizeChange,
    pageSizes: PAGE_SIZES,
    listMode,
    setListMode,
    safePage,
    totalPages,
    pageNumbers,
    setPage,
    sortBy: MY_FEEDBACK_SORT_FIELD,
    sortDirection: 'desc' as const,
    isLoading,
    isRefreshing,
    error,
    detailError,
    openTicket,
    refresh,
    t,
  };
}
