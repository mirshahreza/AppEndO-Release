import React from 'react';
import type { GridListMode } from '@/shared/lib/gridPagingConstants';
import type { AppTableGridColumnDef } from '@/shared/lib/appTableGridQuery';
import type { AiChatSessionAdminSummary } from '@/shared/api/contracts/ai/chatHistoryTypes';
import { AppTableGrid } from '@/shared/ui/AppTableGrid';
import { GridPagingFooter } from '@/shared/ui/GridPagingFooter';
import { QueryErrorPanel } from '@/shared/ui/QueryErrorPanel';

export type ChatHistoryTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  columns: ReadonlyArray<AppTableGridColumnDef<AiChatSessionAdminSummary>>;
  rows: AiChatSessionAdminSummary[];
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  orderedSessionsCount: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  listMode: GridListMode;
  onListModeChange: (mode: GridListMode) => void;
  safePage: number;
  totalPages: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
  visibleInfiniteCount?: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  sortOptions: ReadonlyArray<{ value: string; label: string }>;
  onSortByChange: (value: string) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
};

export const ChatHistoryTableGrid: React.FC<ChatHistoryTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  columns,
  rows,
  onScroll,
  orderedSessionsCount,
  pageSize,
  onPageSizeChange,
  listMode,
  onListModeChange,
  safePage,
  totalPages,
  pageNumbers,
  onPageChange,
  visibleInfiniteCount,
  sortBy,
  sortDirection,
  sortOptions,
  onSortByChange,
  onSortDirectionChange,
}) => (
  <AppTableGrid
    presentation="auto"
    columns={columns}
    rows={rows}
    getRowKey={(session) => session.id}
    onScroll={onScroll}
    isLoading={isLoading}
    loadingMessage="Loading chat history..."
    errorContent={
      isError && error ? (
        <QueryErrorPanel
          message="Failed to load chat history."
          detail={error}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : undefined
    }
    isEmpty={!isLoading && !(isError && error) && rows.length === 0}
    emptyMessage="No chat sessions found."
    footer={(
      <GridPagingFooter
        totalCount={orderedSessionsCount}
        safePage={safePage}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        sortBy={sortBy}
        sortOptions={sortOptions}
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
