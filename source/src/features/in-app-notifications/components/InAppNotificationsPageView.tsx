import React from 'react';
import type { InAppNotificationAdminRow } from '../../../shared/api/contracts/notifications/inAppNotificationsAdmin';
import {
  AppTableGrid,
  CreateEditModalShell,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarFilterCheckbox,
  ToolbarSearchInput,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import type { InAppNotificationsAdminPageState } from '../hooks/useInAppNotificationsAdminPage';

const formatWhen = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export type InAppNotificationsDetailModalProps = {
  notificationId: number | null;
  item: InAppNotificationAdminRow | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

export const InAppNotificationsDetailModal: React.FC<InAppNotificationsDetailModalProps> = ({
  notificationId,
  item,
  isLoading,
  error,
  onClose,
}) => {
  if (notificationId === null) return null;

  return (
    <CreateEditModalShell
      size="lg"
      title={item?.title ?? `Notification #${notificationId}`}
      onClose={onClose}
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : item ? (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">User</dt>
            <dd className="text-slate-800">
              {item.username}
              {' '}
              <span className="font-mono text-slate-400">
                #
                {item.userId}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Body</dt>
            <dd className="whitespace-pre-wrap text-slate-700">{item.body}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Source</dt>
              <dd className="font-mono text-xs text-slate-600">{item.source}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Severity</dt>
              <dd className="text-slate-700">{item.severity}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Created</dt>
              <dd className="font-mono text-xs text-slate-600">{formatWhen(item.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Read / seen</dt>
              <dd className="font-mono text-xs text-slate-600">
                {formatWhen(item.readAt)}
                {' / '}
                {formatWhen(item.seenAt)}
              </dd>
            </div>
          </div>
          {item.href ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Link</dt>
              <dd className="break-all font-mono text-xs text-sky-700">{item.href}</dd>
            </div>
          ) : null}
          {item.metadataJson ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Metadata</dt>
              <dd className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-[11px] text-slate-600">
                {item.metadataJson}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </CreateEditModalShell>
  );
};

export type InAppNotificationsPageViewProps = {
  page: InAppNotificationsAdminPageState;
};

export const InAppNotificationsPageView: React.FC<InAppNotificationsPageViewProps> = ({ page }) => (
  <ListPageShell onGridScroll={page.onGridScroll}>
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={page.searchInput}
          onChange={page.setSearchInput}
          placeholder={page.searchPlaceholder}
          ariaLabel={page.searchAria}
        />
        <ToolbarFilterCheckbox
          id="in-app-notifications-unread-only"
          checked={page.unreadOnly}
          onChange={page.setUnreadOnly}
        >
          {page.unreadOnlyLabel}
        </ToolbarFilterCheckbox>
      </div>
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroupWithRefresh
          onRefresh={page.retryLoad}
          isRefreshing={page.isLoading || page.isRetrying}
          actions={[]}
        />
      </div>
    </ListPageToolbarFrame>

    <AppTableGrid
      presentation="auto"
      persistListKey={APP_LIST_PREFERENCE_KEYS.inAppNotifications}
      columns={page.gridColumns}
      rows={page.rows}
      getRowKey={(row) => String(row.id)}
      getCardRowActions={page.getCardRowActions}
      compact={{ tablet: { cardsPerRow: 2 } }}
      isLoading={page.isLoading}
      loadingMessage={page.loadingMessage}
      errorContent={
        page.isError && page.error ? (
          <QueryErrorPanel
            message={page.loadingMessage}
            detail={page.error}
            onRetry={page.retryLoad}
            isRetrying={page.isRetrying}
          />
        ) : undefined
      }
      isEmpty={!page.isLoading && !page.isError && page.rows.length === 0}
      emptyMessage={page.emptyMessage}
      footer={(
        <GridPagingFooter
          totalCount={page.totalCount}
          safePage={page.safePage}
          pageSize={page.pageSize}
          onPageSizeChange={page.setPageSize}
          sortBy="created_at"
          sortOptions={[]}
          onSortByChange={() => undefined}
          sortDirection="desc"
          onToggleSortDirection={() => undefined}
          showSortControls={false}
          totalPages={page.totalPages}
          pageNumbers={page.pageNumbers}
          onPageChange={page.setPage}
          listMode={page.listMode}
          onListModeChange={page.setListMode}
          visibleInfiniteCount={page.rows.length}
        />
      )}
    />

    <InAppNotificationsDetailModal
      notificationId={page.viewId}
      item={page.viewItem}
      isLoading={page.viewId !== null && page.isViewLoading}
      error={page.viewError}
      onClose={page.closeView}
    />
  </ListPageShell>
);
