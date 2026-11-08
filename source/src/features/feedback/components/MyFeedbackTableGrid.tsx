import React from 'react';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import type { FeedbackTicketDto } from '../../../shared/api/contracts/feedback/types';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { GridPagingFooter, QueryErrorPanel } from '../../../shared/ui';
import type { MyFeedbackPageModel } from '../hooks/useMyFeedbackPage';

type MyFeedbackTableGridProps = {
  page: MyFeedbackPageModel;
  columns: ReadonlyArray<AppTableGridColumnDef<FeedbackTicketDto>>;
};

export const MyFeedbackTableGrid: React.FC<MyFeedbackTableGridProps> = ({ page, columns }) => (
  <AppTableGrid
    presentation="auto"
    persistListKey={APP_LIST_PREFERENCE_KEYS.myFeedback}
    columns={columns}
    rows={page.items}
    getRowKey={(item) => item.id}
    onScroll={page.handleGridScroll}
    compact={{ tablet: { cardsPerRow: 2 } }}
    onRowClick={(item) => { void page.openTicket(item); }}
    getRowClassName={(item) => (
      page.selected?.id === item.id ? 'bg-slate-50' : undefined
    )}
    isLoading={page.isLoading}
    loadingMessage={page.t('feedback.inbox.loading')}
    errorContent={
      page.error ? (
        <QueryErrorPanel
          message={page.t('feedback.inbox.loadError')}
          detail={page.error}
          onRetry={page.refresh}
          isRetrying={page.isRefreshing}
        />
      ) : undefined
    }
    isEmpty={!page.isLoading && !page.error && page.items.length === 0}
    emptyMessage={page.t('feedback.inbox.empty')}
    footer={(
      <GridPagingFooter
        totalCount={page.totalCount}
        safePage={page.safePage}
        pageSize={page.pageSize}
        pageSizes={page.pageSizes}
        onPageSizeChange={page.setPageSize}
        sortBy={page.sortBy}
        sortOptions={[{ value: page.sortBy, label: 'Submitted' }]}
        onSortByChange={() => undefined}
        sortDirection={page.sortDirection}
        onToggleSortDirection={() => undefined}
        totalPages={page.totalPages}
        pageNumbers={page.pageNumbers}
        onPageChange={page.setPage}
        showSortControls={false}
      />
    )}
  />
);
