import React, { useMemo } from 'react';
import type { LogsPageModel } from '../hooks/useLogsPage';
import {
  GridPagingFooter, AppToast, ListFilterDialog, ListFilterSummaryBand, RetentionControlDialog,
  ListPageShell,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { LogDetailModal } from './LogDetailModal';
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
  <ListPageShell onGridScroll={page.onGridScroll}>
    {page.archiveToast ? (
      <AppToast type="warning" text={page.archiveToast} onDismiss={() => page.setArchiveToast(null)} />
    ) : null}
    <LogsToolbar page={page} />
    <ListFilterSummaryBand {...page.filterSummaryProps} />
    <div className="flex min-h-0 w-full flex-1 flex-col">
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
      onScroll={page.onGridScroll}
      handlers={{ onOpenDetail: (id) => { void page.openLogDetail(id); } }}
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
    </div>
    <ListFilterDialog {...page.filterDialogProps} />
    <LogDetailModal page={page} />
    <RetentionControlDialog
      open={page.showControlDialog}
      onClose={() => page.setShowControlDialog(false)}
      scope="logs"
      onCleared={page.closeLogDetail}
    />
  </ListPageShell>
  );
};
