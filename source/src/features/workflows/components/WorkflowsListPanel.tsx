import React from 'react';
import { AlertTriangle, Clock, Copy, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  AppButton,
  CreateEditModalShell,
  DEFAULT_GRID_LIST_MODE,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogIconAction,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  ToolbarFilterRadioGroup,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiInput,
  useGridListPresentation,
  type ToolbarFilterRadioOption,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { DEFAULT_GRID_PAGE_SIZE } from '../../../shared/lib/gridPagingConstants';
import { usePersistedListPaging } from '../../../shared/lib/usePersistedListPreferences';
import { cn } from '../../../lib/utils';
import type { WorkflowDefinitionSummary } from '../types';
import type { WorkflowPublishedFilter, WorkflowSortField, WorkflowsPageState } from '../hooks/useWorkflowsPage';
import { workflowPublishedCardClass } from './workflowPublishedBadge';
import { isWorkflowPublished } from '../lib/workflowPublished';
import { WorkflowDossierButton } from './WorkflowDossierButton';
import { WorkflowPublishedIndicator } from './WorkflowPublishedIndicator';
import { WorkflowDeadLettersPanel } from './WorkflowDeadLettersPanel';
import { WorkflowSlaViolationsPanel } from './WorkflowSlaViolationsPanel';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';

const PUBLISHED_FILTER_OPTIONS: ReadonlyArray<ToolbarFilterRadioOption> = [
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
];

const SORT_OPTIONS: Array<{ value: WorkflowSortField; label: string }> = [
  { value: 'key', label: 'Key' },
  { value: 'published', label: 'Published' },
  { value: 'draftVersion', label: 'Draft version' },
  { value: 'updatedAt', label: 'Updated' },
];

const formatUpdatedDate = (value: string | null): string => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, 10) : '—';
};

type WorkflowsListPanelProps = {
  page: WorkflowsPageState;
  onOpen: (id: number) => void;
};

export const WorkflowsListPanel: React.FC<WorkflowsListPanelProps> = ({ page, onOpen }) => {
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.workflows,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
    defaultListMode: DEFAULT_GRID_LIST_MODE,
  });

  const presentation = useGridListPresentation({
    items: page.sortedDefinitions,
    pageSize,
    listMode,
    resetKeys: [page.searchQuery, page.publishedFilter, page.sortBy, page.sortDirection],
  });

  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll(presentation.handleScrollEnd);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white font-sans">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchQuery}
            onChange={page.setSearchQuery}
            placeholder="key, scope, published…"
            ariaLabel="Search workflows"
          />
          <ToolbarFilterRadioGroup
            value={page.publishedFilter}
            options={PUBLISHED_FILTER_OPTIONS}
            onChange={(value) => page.setPublishedFilter(value as WorkflowPublishedFilter)}
            ariaLabel="Filter workflows by published state"
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton intent={page.deadLettersOpen ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => page.setDeadLettersOpen((v) => !v)}>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Dead letters
          </AppButton>
          <AppButton intent={page.slaViolationsOpen ? 'toggle-on' : 'toggle-off'} size="sm" onClick={() => page.setSlaViolationsOpen((v) => !v)}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            SLA violations
          </AppButton>
          <ToolbarActionGroupWithRefresh
            onRefresh={page.refreshDefinitions}
            isRefreshing={page.isRefreshing && !page.isLoading}
            actions={[
              {
                id: 'create-workflow',
                label: 'Create',
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: page.openCreateModal,
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <WorkflowDeadLettersPanel open={page.deadLettersOpen} onClose={() => page.setDeadLettersOpen(false)} />
      <WorkflowSlaViolationsPanel open={page.slaViolationsOpen} onClose={() => page.setSlaViolationsOpen(false)} />

      <div className="min-h-0 flex-1 overflow-auto" onScroll={handleGridScroll}>
        {page.isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
            Loading workflows…
          </div>
        ) : page.loadError ? (
          <QueryErrorPanel
            message="Failed to load workflows."
            detail={page.loadError}
            onRetry={page.refreshDefinitions}
            isRetrying={page.isRefreshing}
          />
        ) : page.sortedDefinitions.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-5 text-center">
            <p className="text-sm font-medium text-slate-400">No workflows found</p>
            <p className="text-xs font-medium text-slate-500">Try another search or create a workflow.</p>
          </div>
        ) : (
          <DevelopmentCatalogCardGrid className="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
            {presentation.displayItems.map((definition: WorkflowDefinitionSummary) => {
              const published = isWorkflowPublished(definition);
              return (
              <DevelopmentCatalogCard key={definition.id} className={cn('group', workflowPublishedCardClass(published))}>
                <DevelopmentCatalogCardHeader
                  title={`${definition.key} (v${definition.draftVersion})`}
                  onTitleClick={() => onOpen(definition.id)}
                  titleAction={published ? (
                    <WorkflowPublishedIndicator />
                  ) : (
                    <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <DevelopmentCatalogIconAction
                        intent="delete"
                        aria-label={`Delete ${definition.key}`}
                        title="Delete"
                        disabled={page.isDeleting}
                        onClick={(event) => {
                          event.stopPropagation();
                          page.openDeleteDialog(definition);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </DevelopmentCatalogIconAction>
                    </div>
                  )}
                />
                <DevelopmentCatalogCardFooter date={formatUpdatedDate(definition.updatedAt)}>
                  <WorkflowDossierButton
                    definitionId={definition.id}
                    workflowKey={definition.key}
                    variant="card"
                    onOpen={() => page.openDossier(definition.id)}
                  />
                  <DevelopmentCatalogIconAction
                    intent="duplicate"
                    aria-label={`Duplicate ${definition.key}`}
                    title="Duplicate"
                    onClick={(event) => {
                      event.stopPropagation();
                      page.openDuplicateDialog(definition);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </DevelopmentCatalogIconAction>
                </DevelopmentCatalogCardFooter>
              </DevelopmentCatalogCard>
              );
            })}
          </DevelopmentCatalogCardGrid>
        )}
      </div>

      <GridPagingFooter
        totalCount={presentation.totalCount}
        safePage={presentation.safePage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        sortBy={page.sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={page.setSortBy}
        sortDirection={page.sortDirection}
        onToggleSortDirection={page.toggleSortDirection}
        totalPages={presentation.totalPages}
        pageNumbers={presentation.pageNumbers}
        onPageChange={presentation.setPage}
        listMode={listMode}
        onListModeChange={setListMode}
        visibleInfiniteCount={presentation.visibleInfiniteCount}
      />

      {page.isCreateOpen ? (
        <CreateEditModalShell
          size="md"
          title="Create Workflow"
          onClose={() => page.setIsCreateOpen(false)}
          onBackdropClick={() => page.setIsCreateOpen(false)}
          footer={(
            <>
              <AppButton intent="cancel" onClick={() => page.setIsCreateOpen(false)}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton
                intent="primary"
                onClick={() => { void page.handleCreateWorkflow(); }}
                disabled={!page.newWorkflowKey.trim() || page.isCreating}
              >
                {page.isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {page.isCreating ? 'Creating…' : 'Create'}
              </AppButton>
            </>
          )}
        >
          <div className="space-y-4">
            {page.createError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {page.createError}
              </div>
            ) : null}
            <div className="space-y-[2px]">
              <label className="block ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Workflow Name
              </label>
              <UiInput
                size="sm"
                autoDir={false}
                value={page.newWorkflowKey}
                onChange={(event) => page.setNewWorkflowKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  if (!page.newWorkflowKey.trim() || page.isCreating) {
                    return;
                  }
                  void page.handleCreateWorkflow();
                }}
                placeholder="e.g. order-approval"
                ariaLabel="Workflow name"
                className="font-mono"
                autoFocus
              />
            </div>
          </div>
        </CreateEditModalShell>
      ) : null}
    </div>
  );
};
