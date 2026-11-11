import React, { useMemo } from 'react';
import type { LogsPageModel } from '../hooks/useLogsPage';
import { GridPagingFooter } from '@/src/shared/ui';
import { useCultureT } from '@/src/core/culture/CultureContext';
import { operationsKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import { LogDetailModal } from './LogDetailModal';
import { LogsClearConfirmModal } from './LogsClearConfirmModal';
import { LogsTableGrid } from './LogsTableGrid';
import { LogsToolbar } from './LogsToolbar';

type LogsPageViewProps = {
  page: LogsPageModel;
};

export const LogsPageView: React.FC<LogsPageViewProps> = ({ page }) => {
  const t = useCultureT();
  const sortOptions = useMemo(
    () => [{ value: 'timestamp', label: t(operationsKey('common.timestamp')) }],
    [t],
  );

  return (
  <div className="w-full h-full flex flex-col bg-white">
    <LogsToolbar page={page} />
    <LogsTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      loadError={page.loadError}
      onRetry={page.retryLoadLogs}
      isRetrying={page.isRetryingLogs}
      columns={page.gridColumns}
      columnLayout={page.columnLayout}
      handleColumnLayoutChange={page.handleColumnLayoutChange}
      rows={page.presentation.displayItems}
      query={page.query}
      onQueryChange={page.handleGridQueryChange}
      onScroll={page.presentation.handleScrollEnd}
      footer={(
        <GridPagingFooter
          totalCount={page.presentation.totalCount}
          safePage={page.presentation.safePage}
          pageSize={page.pageSize}
          onPageSizeChange={page.setPageSize}
          sortBy="timestamp"
          sortOptions={sortOptions}
          onSortByChange={() => undefined}
          sortDirection="desc"
          onToggleSortDirection={() => undefined}
          showSortControls={false}
          totalPages={page.presentation.totalPages}
          pageNumbers={page.presentation.pageNumbers}
          onPageChange={page.presentation.setPage}
          listMode={page.listMode}
          onListModeChange={page.setListMode}
          visibleInfiniteCount={page.presentation.visibleInfiniteCount}
        />
      )}
    />
    <LogDetailModal page={page} />
    <LogsClearConfirmModal page={page} />
  </div>
  );
};
