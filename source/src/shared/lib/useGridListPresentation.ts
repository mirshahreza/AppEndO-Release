import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import type { GridListMode } from './gridPagingConstants';

type UseGridListPresentationOptions<T> = {
  items: ReadonlyArray<T>;
  pageSize: number;
  listMode: GridListMode;
  resetKeys?: ReadonlyArray<unknown>;
};

export function formatGridInfiniteRange(visibleCount: number, totalCount: number): string {
  if (totalCount === 0) {
    return 'Showing 0 of 0';
  }
  return `Showing ${Math.min(visibleCount, totalCount)} of ${totalCount}`;
}

export function useGridListPresentation<T>({
  items,
  pageSize,
  listMode,
  resetKeys = [],
}: UseGridListPresentationOptions<T>) {
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [pageSize, listMode, items.length, ...resetKeys]);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const displayItems = useMemo(() => {
    if (listMode === 'infinite') {
      return items.slice(0, visibleCount);
    }
    return items.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [items, listMode, pageSize, safePage, visibleCount]);

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

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + pageSize, totalCount));
  }, [pageSize, totalCount]);

  const handleScrollEnd = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (listMode !== 'infinite' || !hasMore) {
      return;
    }
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      loadMore();
    }
  }, [hasMore, listMode, loadMore]);

  return {
    displayItems,
    totalCount,
    page,
    setPage,
    safePage,
    totalPages,
    pageNumbers,
    visibleInfiniteCount,
    hasMore,
    loadMore,
    handleScrollEnd,
  };
}
