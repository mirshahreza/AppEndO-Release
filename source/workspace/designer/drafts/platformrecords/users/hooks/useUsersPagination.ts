import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import type { UsersListQuery } from '@/src/shared/api/queries/users';
import type { GridListMode } from '@/src/shared/lib/gridPagingConstants';

export function buildSelectedRoleNames(roleFilters: Record<string, boolean>): string | undefined {
  const selected = Object.entries(roleFilters)
    .filter(([, checked]) => checked)
    .map(([role]) => role);
  return selected.length > 0 ? selected.join(',') : undefined;
}

export function useUsersToolbarFilters(availableRoles: ReadonlyArray<string>) {
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setRoleFilters((prev) => {
      const next: Record<string, boolean> = {};
      for (const role of availableRoles) {
        next[role] = prev[role] ?? true;
      }
      return next;
    });
  }, [availableRoles]);

  const hasRoleSelection = useMemo(
    () => Object.values(roleFilters).some(Boolean),
    [roleFilters],
  );

  const selectedRoleNames = useMemo(
    () => buildSelectedRoleNames(roleFilters),
    [roleFilters],
  );

  return {
    searchInput,
    setSearchInput,
    searchText,
    roleFilters,
    setRoleFilters,
    hasRoleSelection,
    selectedRoleNames,
  };
}

export function useUsersPagingState({
  pageSize,
  listMode,
  resetKeys,
}: {
  pageSize: number;
  listMode: GridListMode;
  resetKeys: ReadonlyArray<unknown>;
}) {
  const [page, setPage] = useState(1);
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState(pageSize);

  useEffect(() => {
    setPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [pageSize, listMode, ...resetKeys]);

  const listQueryPaging = useMemo((): Pick<UsersListQuery, 'page' | 'pageSize'> => ({
    page: listMode === 'infinite' ? 1 : page,
    pageSize: listMode === 'infinite' ? infiniteVisibleCount : pageSize,
  }), [infiniteVisibleCount, listMode, page, pageSize]);

  const loadMore = useCallback(() => {
    setInfiniteVisibleCount((current) => current + pageSize);
  }, [pageSize]);

  const handleScrollEnd = useCallback((event: UIEvent<HTMLDivElement>, totalCount: number, hasMore: boolean) => {
    if (listMode !== 'infinite' || !hasMore) {
      return;
    }
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      setInfiniteVisibleCount((current) => Math.min(current + pageSize, totalCount));
    }
  }, [listMode, pageSize]);

  return {
    page,
    setPage,
    infiniteVisibleCount,
    listQueryPaging,
    loadMore,
    handleScrollEnd,
  };
}

export function buildUsersPagingFooter({
  totalCount,
  pageSize,
  listMode,
  page,
  infiniteVisibleCount,
}: {
  totalCount: number;
  pageSize: number;
  listMode: GridListMode;
  page: number;
  infiniteVisibleCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageNumbers: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, safePage + 2);
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }

  const visibleInfiniteCount = Math.min(infiniteVisibleCount, totalCount);
  const hasMore = listMode === 'infinite' && visibleInfiniteCount < totalCount;

  return {
    safePage,
    totalPages,
    pageNumbers,
    visibleInfiniteCount,
    hasMore,
  };
}
