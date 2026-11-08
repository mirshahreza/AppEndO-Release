import React from 'react';
import { ListPageShell } from '../../../shared/ui';
import type { ChatHistoryPageState } from '../hooks/useChatHistoryPage';
import { ChatHistoryDeleteModal } from './ChatHistoryDeleteModal';
import { ChatHistoryTableGrid } from './ChatHistoryTableGrid';
import { ChatHistoryToast } from './ChatHistoryToast';
import { ChatHistoryToolbar } from './ChatHistoryToolbar';
import { ChatHistoryViewModal } from './ChatHistoryViewModal';

export type ChatHistoryPageViewProps = {
  page: ChatHistoryPageState;
};

export const ChatHistoryPageView: React.FC<ChatHistoryPageViewProps> = ({ page }) => (
  <ListPageShell>
    <ChatHistoryToolbar
      searchInput={page.searchInput}
      onSearchInputChange={page.setSearchInput}
      onRefresh={page.retryLoadSessions}
      isRefreshing={page.isLoading || page.isRetryingSessions}
    />

    <ChatHistoryTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      error={page.error}
      onRetry={page.retryLoadSessions}
      isRetrying={page.isRetryingSessions}
      columns={page.gridColumns}
      rows={page.displaySessions}
      orderedSessionsCount={page.orderedSessionsCount}
      pageSize={page.pageSize}
      onPageSizeChange={page.setPageSize}
      listMode={page.listMode}
      onListModeChange={page.setListMode}
      safePage={page.safePage}
      totalPages={page.totalPages}
      pageNumbers={page.pageNumbers}
      onPageChange={page.setPage}
      visibleInfiniteCount={page.visibleInfiniteCount}
      sortBy={page.sortBy}
      sortDirection={page.sortDirection}
      sortOptions={page.sortOptions}
      onSortByChange={(value) => page.setFooterSort(value, page.sortDirection, page.sortFields)}
      onSortDirectionChange={(value) => page.setFooterSort(page.sortBy, value, page.sortFields)}
    />

    <ChatHistoryViewModal
      sessionId={page.viewSessionId}
      session={page.viewSession}
      isLoading={page.isViewLoading}
      error={page.viewError}
      onClose={page.closeView}
    />

    <ChatHistoryDeleteModal
      deleteId={page.deleteId}
      deleteError={page.deleteError}
      isDeleting={page.isDeleting}
      onCancel={page.cancelDelete}
      onConfirm={() => void page.confirmDelete()}
    />

    <ChatHistoryToast toast={page.toast} />
  </ListPageShell>
);
