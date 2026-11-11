import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { GridColumnLayoutChangeMeta, GridColumnLayoutState } from '@/src/shared/lib/appTableGridColumnLayout';
import type { GridQueryState } from '@/src/shared/lib/appTableGridQuery';
import type { GridListMode } from '@/src/shared/lib/gridPagingConstants';
import type { AppTableGridColumnDef } from '@/src/shared/lib/appTableGridQuery';
import type { UserRecord } from '@/src/shared/api/queries/users';
import { cn } from '@/src/lib/utils';
import { AppButton, AppTableGrid, GridPagingFooter } from '@/src/shared/ui';
import { SORT_OPTIONS } from '../constants';
import type { UserSortField } from '../types';

export type UserTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<UserRecord>>;
  columnLayout: GridColumnLayoutState;
  handleColumnLayoutChange: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
  rows: UserRecord[];
  query: GridQueryState;
  onQueryChange: (query: GridQueryState) => void;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  orderedUsersCount: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  listMode: GridListMode;
  onListModeChange: (mode: GridListMode) => void;
  sortBy: UserSortField;
  sortDirection: 'asc' | 'desc';
  onSortByChange: (value: UserSortField) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
  safePage: number;
  totalPages: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
  visibleInfiniteCount?: number;
};

export const UserTableGrid: React.FC<UserTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  columns,
  columnLayout,
  handleColumnLayoutChange,
  rows,
  query,
  onQueryChange,
  onScroll,
  orderedUsersCount,
  pageSize,
  onPageSizeChange,
  listMode,
  onListModeChange,
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
  safePage,
  totalPages,
  pageNumbers,
  onPageChange,
  visibleInfiniteCount,
}) => (
  <AppTableGrid
    presentation="auto"
    columns={columns}
    rows={rows}
    getRowKey={(user) => user.id}
    enableColumnLayout
    columnLayout={columnLayout}
    onColumnLayoutChange={handleColumnLayoutChange}
    gridQueryMode="server"
    query={query}
    onQueryChange={onQueryChange}
    onScroll={onScroll}
    isLoading={isLoading}
    loadingMessage="Loading users..."
    errorContent={
      isError && error ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
          <p className="max-w-lg text-sm text-rose-600">{error}</p>
          {onRetry ? (
            <AppButton type="button" intent="utility" onClick={onRetry} disabled={isRetrying}>
              <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} aria-hidden="true" />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </AppButton>
          ) : null}
        </div>
      ) : undefined
    }
    isEmpty={!isLoading && !(isError && error) && rows.length === 0}
    emptyMessage="No users found."
    footer={(
      <GridPagingFooter
        totalCount={orderedUsersCount}
        safePage={safePage}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={onSortByChange}
        sortDirection={sortDirection}
        onToggleSortDirection={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
        totalPages={totalPages}
        pageNumbers={pageNumbers}
        onPageChange={onPageChange}
        listMode={listMode}
        onListModeChange={onListModeChange}
        visibleInfiniteCount={visibleInfiniteCount}
      />
    )}
  />
);
