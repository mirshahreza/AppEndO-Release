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
  ToolbarFilterCheckbox,
  ToolbarSearchInput,
  UiSelect,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { getMissedRunPolicyOptions } from '../../operations/operationsI18n';
import type { ScheduledTaskGridRow } from '../../../shared/api/contracts/scheduler/types';
import { useScheduledTasksPage } from '../hooks/useScheduledTasksPage';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { ScheduledTaskFormModal } from './ScheduledTaskFormModal';
import { ScheduledTaskDeleteModal } from './ScheduledTaskDeleteModal';

export const ScheduledTasksWorkspace: React.FC = () => {
  const t = useCultureT();
  const page = useScheduledTasksPage();
  const missedRunPolicyOptions = useMemo(() => getMissedRunPolicyOptions(t), [t]);
  const sortOptions = useMemo(
    () => [{ value: 'name', label: t(columnCommonKey('name')) }],
    [t],
  );

  return (
    <ListPageShell onGridScroll={page.onGridScroll}>
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={(event) => page.setSearchInput(event.target.value)}
            placeholder={t(operationsKey('scheduler.filterPlaceholder'))}
          />
          <div className="w-full min-w-0 sm:w-52">
            <UiSelect
              size="sm"
              ariaLabel={t(operationsKey('scheduler.missedRunPolicyAria'))}
              value={page.scheduler?.missedRunPolicy ?? 'skip'}
              onChange={(event) => {
                void page.handleMissedRunPolicyChange(event.target.value as 'skip' | 'catch_up_once');
              }}
              isDisabled={page.isTogglingScheduler}
            >
              {missedRunPolicyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>
          <ToolbarFilterCheckbox
            id="scheduled-tasks-scheduler-enabled"
            checked={page.scheduler?.enabled ?? false}
            onChange={(checked) => { void page.handleToggleScheduler(checked); }}
            isDisabled={page.isTogglingScheduler}
          >
            {t(operationsKey('scheduler.enabled'))}
          </ToolbarFilterCheckbox>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={page.retryLoad}
            isRefreshing={page.isRefreshing}
            actions={[
              {
                id: 'create-scheduled-task',
                label: t('actions.create'),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openCreateModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <AppTableGrid
        presentation="auto"
        persistListKey={APP_LIST_PREFERENCE_KEYS.scheduledTasks}
        columns={page.gridColumns}
        rows={page.presentation.displayItems}
        getRowKey={(task: ScheduledTaskGridRow) => task.id}
        compact={{ tablet: { cardsPerRow: 2 } }}
        isLoading={page.isLoading}
        loadingMessage={t(operationsKey('scheduler.loading'))}
        errorContent={
          page.isError && page.error ? (
            <QueryErrorPanel
              message={t(operationsKey('scheduler.loadFailed'))}
              detail={page.error}
              onRetry={page.retryLoad}
              isRetrying={page.isRefreshing}
            />
          ) : undefined
        }
        isEmpty={!page.isLoading && !page.isError && page.presentation.displayItems.length === 0}
        emptyMessage={t(operationsKey('scheduler.empty'))}
        footer={(
          <GridPagingFooter
            totalCount={page.presentation.totalCount}
            safePage={page.presentation.safePage}
            pageSize={page.pageSize}
            onPageSizeChange={page.setPageSize}
            sortBy="name"
            sortOptions={sortOptions}
            onSortByChange={() => undefined}
            sortDirection="asc"
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

      <ScheduledTaskFormModal
        open={page.showModal}
        mode={page.modalMode}
        form={page.form}
        functionCatalog={page.functionCatalog}
        schedulerTimezone={page.scheduler?.defaultTimezone || 'UTC'}
        formError={page.formError}
        isSaving={page.isSaving}
        onClose={() => page.setShowModal(false)}
        onSubmit={() => { void page.handleSaveTask(); }}
        onFormChange={page.setForm}
      />

      <ScheduledTaskDeleteModal
        task={page.deleteTarget}
        deleteError={page.deleteError}
        onCancel={() => page.setDeleteTarget(null)}
        onConfirm={() => { void page.confirmDelete(); }}
      />

      {page.toast ? (
        <AppToast type={page.toast.type} text={page.toast.text} />
      ) : null}
    </ListPageShell>
  );
};
