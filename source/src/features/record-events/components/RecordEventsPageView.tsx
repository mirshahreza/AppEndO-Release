import React, { useMemo } from 'react';
import {
  AppToast, GridPagingFooter, ListFilterDialog, ListFilterSummaryBand, RetentionControlDialog,
  ListPageShell,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { RecordEventsPageModel } from '../hooks/useRecordEventsPage';
import { RecordEventDetailModal } from './RecordEventDetailModal';
import { RecordEventsTableGrid } from './RecordEventsTableGrid';
import { RecordEventsToolbar } from './RecordEventsToolbar';

type RecordEventsPageViewProps = {
  page: RecordEventsPageModel;
};

export const RecordEventsPageView: React.FC<RecordEventsPageViewProps> = ({ page }) => {
  const t = useCultureT();
  const archiveUnavailable = t(operationsKey('recordEvents.archiveUnavailable'));
  const sortOptions = useMemo(
    () => [{ value: 'occurredAt', label: 'Time' }],
    [],
  );

  return (
    <ListPageShell onGridScroll={page.onGridScroll}>
      {page.logMessage ? (
        <AppToast
          type={page.logMessage === archiveUnavailable ? 'warning' : 'info'}
          text={page.logMessage}
          onDismiss={() => page.clearLogMessage()}
        />
      ) : null}
      <RecordEventsToolbar page={page} />
      <ListFilterSummaryBand {...page.filterSummaryProps} />
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <RecordEventsTableGrid
          isLoading={page.isLoading}
          isError={page.isError}
          loadError={page.loadError}
          onRetry={page.retryLoadEvents}
          isRetrying={page.isRetryingEvents}
          columns={page.gridColumns}
          columnLayout={page.columnLayout}
          handleColumnLayoutChange={page.handleColumnLayoutChange}
          rows={page.presentation.displayItems}
          query={page.query}
          onQueryChange={page.handleGridQueryChange}
          handlers={{
            onOpenDetail: page.openDetail,
            onViewHttpLog: page.viewHttpLog,
          }}
          footer={(
            <GridPagingFooter
              totalCount={page.presentation.totalCount}
              safePage={page.presentation.safePage}
              pageSize={page.pageSize}
              onPageSizeChange={page.setPageSize}
              sortBy="occurredAt"
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
      <RecordEventDetailModal page={page} />
      <RetentionControlDialog
        open={page.showControlDialog}
        onClose={() => page.setShowControlDialog(false)}
        scope="recordEvents"
        onCleared={page.closeDetail}
      />
    </ListPageShell>
  );
};
