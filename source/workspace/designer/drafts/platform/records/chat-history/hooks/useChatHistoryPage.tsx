import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAdminChatSessionQuery,
  useAdminChatSessionsQuery,
  useDeleteAdminChatSessionMutation,
} from '@/shared/api/queries/adminChatHistory';
import { formatApiErrorMessage, formatQueryError, isApiError } from '@/shared/api/client';
import { DEFAULT_GRID_LIST_MODE, type GridListMode } from '@/shared/lib/gridPagingConstants';
import type { AiChatSessionAdminSummary } from '@/shared/api/contracts/ai/chatHistoryTypes';
import {
  CHAT_HISTORY_SORT_FIELDS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  SORT_OPTIONS,
} from '../constants';
import { useCultureT } from '@/core/culture/CultureContext';
import { createChatHistoryGridColumns } from '../chatHistoryGridColumns';
import type { ToastState } from '../types';
import { getMutationError } from '../utils';

export function useChatHistoryPage() {
  const t = useCultureT();
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [viewSessionId, setViewSessionId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [listMode, setListMode] = useState<GridListMode>(DEFAULT_GRID_LIST_MODE);
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const listQuery = useMemo(() => ({
    search: searchText,
    page,
    pageSize,
    sortBy,
    sortDir: sortDirection,
  }), [searchText, page, pageSize, sortBy, sortDirection]);

  const sessionsQuery = useAdminChatSessionsQuery(listQuery);
  const viewSessionQuery = useAdminChatSessionQuery(viewSessionId, viewSessionId !== null);
  const deleteSessionMutation = useDeleteAdminChatSessionMutation();

  const sessions = sessionsQuery.data?.items ?? [];
  const totalCount = sessionsQuery.data?.totalCount ?? 0;
  const isLoading = sessionsQuery.isLoading;
  const isError = sessionsQuery.isError;
  const error = isError
    ? formatQueryError(sessionsQuery.error, 'Failed to load chat history.')
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchText(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (type: ToastState['type'], text: string) => setToast({ type, text });

  const retryLoadSessions = useCallback(() => {
    void sessionsQuery.refetch();
  }, [sessionsQuery]);

  const openView = (session: AiChatSessionAdminSummary) => {
    setViewSessionId(session.id);
  };

  const closeView = () => {
    setViewSessionId(null);
  };

  const requestDelete = (sessionId: number) => {
    setDeleteId(sessionId);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;

    setDeleteError(null);
    try {
      const { data } = await deleteSessionMutation.mutateAsync(deleteId);
      const mutationError = getMutationError(data, 'Could not delete chat session.');
      if (mutationError) {
        setDeleteError(mutationError);
        return;
      }
      if (viewSessionId === deleteId) {
        setViewSessionId(null);
      }
      setDeleteId(null);
      showToast('success', 'Chat session deleted successfully.');
    } catch (caught) {
      setDeleteError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Network error.');
    }
  };

  const gridColumns = useMemo(
    () => createChatHistoryGridColumns({
      onView: openView,
      onDelete: requestDelete,
    }, t),
    [t],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const setFooterSort = (
    nextSortBy: string,
    nextSortDirection: 'asc' | 'desc',
    allowedFields: readonly string[],
  ) => {
    if (!allowedFields.includes(nextSortBy)) return;
    setSortBy(nextSortBy);
    setSortDirection(nextSortDirection);
    setPage(1);
  };

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
    gridColumns,
    isLoading,
    isError,
    error,
    retryLoadSessions,
    isRetryingSessions: sessionsQuery.isFetching && isError,
    displaySessions: sessions,
    orderedSessionsCount: totalCount,
    pageSize,
    setPageSize: handlePageSizeChange,
    listMode,
    setListMode,
    safePage,
    totalPages,
    pageNumbers,
    setPage,
    visibleInfiniteCount: sessions.length,
    handleGridScroll: () => undefined,
    sortBy,
    sortDirection,
    setFooterSort,
    sortOptions: SORT_OPTIONS,
    pageSizes: PAGE_SIZES,
    viewSessionId,
    viewSession: viewSessionQuery.data ?? null,
    isViewLoading: viewSessionQuery.isLoading,
    viewError: viewSessionQuery.isError
      ? formatQueryError(viewSessionQuery.error, 'Failed to load chat session.')
      : null,
    closeView,
    deleteId,
    deleteError,
    cancelDelete,
    confirmDelete,
    isDeleting: deleteSessionMutation.isPending,
    toast,
    sortFields: CHAT_HISTORY_SORT_FIELDS,
  };
}

export type ChatHistoryPageState = ReturnType<typeof useChatHistoryPage>;
