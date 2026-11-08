import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import {
  AppTableGrid,
  AppToast,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarFilterRadioGroup,
  ToolbarSearchInput,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import type { JobGridRow } from '../../../shared/api/contracts/jobs/types';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { getJobSortOptions, getJobStatusOptions, interpolateOperationsTemplate } from '../../operations/operationsI18n';
import { useJobsPage } from '../hooks/useJobsPage';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { JobCancelModal } from './JobCancelModal';
import { JobEnqueueModal } from './JobEnqueueModal';

export const JobsWorkspace: React.FC = () => {
  const t = useCultureT();
  const page = useJobsPage();
  const statusOptions = useMemo(() => getJobStatusOptions(t), [t]);
  const sortOptions = useMemo(() => getJobSortOptions(t), [t]);

  return (
    <ListPageShell onGridScroll={page.onGridScroll}>
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={page.setSearchInput}
            placeholder={t(operationsKey('jobs.filterPlaceholder'))}
          />
          <ToolbarFilterRadioGroup
            value={page.statusFilter}
            options={statusOptions}
            onChange={page.setStatusFilter}
            ariaLabel={t(operationsKey('jobs.filterStatusAria'))}
          />
          {page.stats ? (
            <span className="text-xs text-slate-500">
              {interpolateOperationsTemplate(t(operationsKey('jobs.statsRunningPending')), {
                running: page.stats.running,
                pending: page.stats.pending,
              })}
            </span>
          ) : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={page.retryLoad}
            isRefreshing={page.isRefreshing}
            actions={[
              {
                id: 'enqueue-job',
                label: t(operationsKey('jobs.enqueue')),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openEnqueueModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <AppTableGrid
        presentation="auto"
        persistListKey={APP_LIST_PREFERENCE_KEYS.jobs}
        columns={page.gridColumns}
        rows={page.presentation.displayItems}
        getRowKey={(job: JobGridRow) => job.id}
        compact={{ tablet: { cardsPerRow: 2 } }}
        isLoading={page.isLoading}
        loadingMessage={t(operationsKey('jobs.loading'))}
        errorContent={
          page.isError && page.error ? (
            <QueryErrorPanel
              message={t(operationsKey('jobs.loadFailed'))}
              detail={page.error}
              onRetry={page.retryLoad}
              isRetrying={page.isRefreshing}
            />
          ) : undefined
        }
        isEmpty={!page.isLoading && !page.isError && page.presentation.displayItems.length === 0}
        emptyMessage={t(operationsKey('jobs.empty'))}
        footer={(
          <GridPagingFooter
            totalCount={page.presentation.totalCount}
            safePage={page.presentation.safePage}
            pageSize={page.pageSize}
            onPageSizeChange={page.setPageSize}
            sortBy="created_at"
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

      <JobEnqueueModal
        open={page.showEnqueueModal}
        form={page.enqueueForm}
        functionCatalog={page.functionCatalog}
        formError={page.enqueueError}
        isSaving={page.isEnqueueing}
        onClose={() => page.setShowEnqueueModal(false)}
        onSubmit={() => { void page.handleEnqueue(); }}
        onFormChange={page.setEnqueueForm}
      />

      <JobCancelModal
        job={page.cancelTarget}
        cancelError={page.cancelError}
        onCancel={() => page.setCancelTarget(null)}
        onConfirm={() => { void page.confirmCancel(); }}
      />

      {page.toast ? (
        <AppToast type={page.toast.type} text={page.toast.text} />
      ) : null}
    </ListPageShell>
  );
};
