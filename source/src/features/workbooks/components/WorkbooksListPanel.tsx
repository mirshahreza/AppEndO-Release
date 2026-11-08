import React, { useMemo, useState } from 'react';
import { Plus, Share2, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  DEFAULT_GRID_LIST_MODE,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogIconAction,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  QueryErrorPanel,
  ToolbarFilterRadioGroup,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  useGridListPresentation,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import {
  APP_TABLE_GRID_ACTOR_TEXT_CLASS,
  APP_TABLE_GRID_CARD_ACTIONS_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { DEFAULT_GRID_PAGE_SIZE } from '../../../shared/lib/gridPagingConstants';
import { usePersistedListPaging } from '../../../shared/lib/usePersistedListPreferences';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import type { WorkbookListItem } from '../../../shared/api/contracts/workbooks/types';
import { formatWorkbookCatalogActor, formatWorkbookCatalogDate } from '../workbookCatalogAudit';

type WorkbookSortField = 'name' | 'updatedAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: Array<{ value: WorkbookSortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'updatedAt', label: 'Updated At' },
  { value: 'createdAt', label: 'Created At' },
];

const WorkbookCatalogAuditLine: React.FC<{
  label: string;
  date: string;
  actor: string;
  actorRole: 'Creator' | 'Editor';
}> = ({ label, date, actor, actorRole }) => (
  <div className="flex min-w-0 items-center justify-start gap-2">
    <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {label}
    </span>
    <span className="shrink-0 text-xs font-semibold leading-none text-slate-600" title={`${label} ${date}`}>
      {date}
    </span>
    <span
      className={cn('min-w-0 truncate', APP_TABLE_GRID_ACTOR_TEXT_CLASS)}
      title={`${actorRole} ${actor}`}
      aria-label={`${actorRole} ${actor}`}
    >
      {actor}
    </span>
  </div>
);

const WorkbookCatalogAuditFields: React.FC<{ item: WorkbookListItem }> = ({ item }) => {
  const created = formatWorkbookCatalogDate(item.createdAt);
  const updated = formatWorkbookCatalogDate(item.updatedAt);
  const creator = formatWorkbookCatalogActor(item.createdByUsername);
  const editor = formatWorkbookCatalogActor(item.updatedByUsername);
  return (
    <ListPageToolbarFrame>

      <WorkbookCatalogAuditLine
        label="Created"
        date={created}
        actor={creator}
        actorRole="Creator"
      />
      <WorkbookCatalogAuditLine
        label="Edited"
        date={updated}
        actor={editor}
        actorRole="Editor"
      />
    </ListPageToolbarFrame>
  );
};

const compareWorkbooks = (
  left: WorkbookListItem,
  right: WorkbookListItem,
  sortBy: WorkbookSortField,
  sortDirection: SortDirection,
): number => {
  let result = 0;
  if (sortBy === 'name') {
    result = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  } else {
    result = (left[sortBy] ?? '').localeCompare(right[sortBy] ?? '');
  }
  return sortDirection === 'asc' ? result : -result;
};

type WorkbooksListScope = 'mine' | 'shared';

type WorkbooksListPanelProps = {
  items: WorkbookListItem[];
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  onRefresh: () => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (item: WorkbookListItem) => void;
  onShare?: (item: WorkbookListItem) => void;
  isDeleting: boolean;
  allowSharing?: boolean;
  listScope?: WorkbooksListScope;
  onListScopeChange?: (scope: WorkbooksListScope) => void;
  mineCount?: number;
  sharedCount?: number;
};

const viewerRoleBadge = (item: WorkbookListItem) => {
  if (item.viewerRole === 'can-edit') {
    return { label: 'Can edit', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (item.viewerRole === 'can-view') {
    return { label: 'Can view', className: 'bg-slate-100 text-slate-600' };
  }
  return { label: 'Owner', className: 'bg-indigo-50 text-indigo-700' };
};

export const WorkbooksListPanel: React.FC<WorkbooksListPanelProps> = ({
  items,
  search,
  onSearchChange,
  isLoading,
  isRefreshing,
  loadError,
  onRefresh,
  onCreate,
  onOpen,
  onDelete,
  onShare,
  isDeleting,
  allowSharing = false,
  listScope = 'mine',
  onListScopeChange,
  mineCount,
  sharedCount,
}) => {
  const [sortBy, setSortBy] = useState<WorkbookSortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.workbooks,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
    defaultListMode: DEFAULT_GRID_LIST_MODE,
  });

  const sortedItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((item) => item.name.toLowerCase().includes(query))
      : items;
    return [...filtered].sort((left, right) => compareWorkbooks(left, right, sortBy, sortDirection));
  }, [items, search, sortBy, sortDirection]);

  const presentation = useGridListPresentation({
    items: sortedItems,
    pageSize,
    listMode,
    resetKeys: [search, sortBy, sortDirection],
  });

  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll(presentation.handleScrollEnd);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-white font-sans" data-testid="workbooks-list">
      <div
        className={cn(
          `${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between gap-2 lg:gap-3`)}
      >
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="name…"
            ariaLabel="Search workbooks"
          />
          {allowSharing && onListScopeChange ? (
            <ToolbarFilterRadioGroup
              ariaLabel="Workbook list"
              value={listScope}
              onChange={(value) => onListScopeChange(value === 'shared' ? 'shared' : 'mine')}
              options={[
                { value: 'mine', label: 'Mine', count: mineCount },
                { value: 'shared', label: 'Shared with me', count: sharedCount },
              ]}
            />
          ) : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={onRefresh}
            isRefreshing={isRefreshing && !isLoading}
            actions={listScope === 'mine'
              ? [{
                id: 'create-workbook',
                label: 'Create',
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: onCreate,
                guideHint: 'Create a private spreadsheet that only you can open.',
              }]
              : []}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" onScroll={handleGridScroll}>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
            Loading workbooks…
          </div>
        ) : loadError ? (
          <QueryErrorPanel
            message="Failed to load workbooks."
            detail={loadError}
            onRetry={onRefresh}
            isRetrying={isRefreshing}
          />
        ) : sortedItems.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-5 text-center">
            <p className="text-sm font-medium text-slate-400">
              {listScope === 'shared' ? 'Nothing shared with you yet.' : 'No workbooks yet.'}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {listScope === 'shared'
                ? 'When someone adds your username, the workbook appears here.'
                : 'Try another search or create a workbook.'}
            </p>
          </div>
        ) : (
          <DevelopmentCatalogCardGrid className="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
            {presentation.displayItems.map((item) => {
              const canManage = !allowSharing || (
                item.viewerRole !== 'can-view' && item.viewerRole !== 'can-edit'
              );
              const deleteAction = canManage ? (
                <DevelopmentCatalogIconAction
                  intent="delete"
                  aria-label={`Delete ${item.name}`}
                  title="Delete"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null;
              const shareAction = allowSharing && canManage && onShare ? (
                <DevelopmentCatalogIconAction
                  intent="access"
                  aria-label={`Share ${item.name}`}
                  title="Share"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShare(item);
                  }}
                >
                  <Share2 className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null;

              return (
              <DevelopmentCatalogCard key={item.id}>
                <DevelopmentCatalogCardHeader
                  title={item.name}
                  onTitleClick={() => onOpen(item.id)}
                  titleAction={!allowSharing ? deleteAction : undefined}
                  trailing={allowSharing ? (
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        viewerRoleBadge(item).className,
                      )}
                      >
                        {viewerRoleBadge(item).label}
                      </span>
                      {deleteAction}
                    </div>
                  ) : undefined}
                />
                <div className="mt-auto flex items-end justify-between gap-2">
                  <WorkbookCatalogAuditFields item={item} />
                  {shareAction ? (
                    <div className="shrink-0 pb-0.5">
                      {shareAction}
                    </div>
                  ) : null}
                </div>
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
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={(value) => setSortBy(value as WorkbookSortField)}
        sortDirection={sortDirection}
        onToggleSortDirection={() => {
          setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        }}
        totalPages={presentation.totalPages}
        pageNumbers={presentation.pageNumbers}
        onPageChange={presentation.setPage}
        listMode={listMode}
        onListModeChange={setListMode}
        visibleInfiniteCount={presentation.visibleInfiniteCount}
      />
    </div>
  );
};
