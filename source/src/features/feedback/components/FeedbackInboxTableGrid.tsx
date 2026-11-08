import React from 'react';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import type { FeedbackTicketDto } from '../../../shared/api/contracts/feedback/types';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { QueryErrorPanel } from '../../../shared/ui';
import type { FeedbackInboxPageModel } from '../hooks/useFeedbackInboxPage';

type FeedbackInboxTableGridProps = {
  page: FeedbackInboxPageModel;
  columns: ReadonlyArray<AppTableGridColumnDef<FeedbackTicketDto>>;
};

export const FeedbackInboxTableGrid: React.FC<FeedbackInboxTableGridProps> = ({ page, columns }) => (
  <AppTableGrid
    presentation="table-scroll"
    persistListKey={APP_LIST_PREFERENCE_KEYS.feedbackInbox}
    columns={columns}
    rows={page.items}
    getRowKey={(item) => item.id}
    onScroll={page.onGridScroll}
    onRowClick={page.openTicket}
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
    isEmpty={!page.isLoading && !page.error && page.items.length === 0 && !page.deepLinkTicketId}
    emptyMessage={page.t('feedback.inbox.empty')}
  />
);
