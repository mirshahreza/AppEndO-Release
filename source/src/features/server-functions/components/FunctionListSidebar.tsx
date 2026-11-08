import React from 'react';
import {
  Copy,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Unplug,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  ACCESS_CONTROL_ACTION_ARIA_LABEL,
  AccessControlActionIcon,
  BuiltInBadge,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardBadge,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogIconAction,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ToolbarBuiltInFilter,
  ToolbarFilterSelect,
  UiChip,
  GridPagingFooter,
  useGridListPresentation,
  DEFAULT_GRID_LIST_MODE,
} from '../../../shared/ui';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { DEFAULT_GRID_PAGE_SIZE } from '../../../shared/lib/gridPagingConstants';
import { usePersistedListPaging } from '../../../shared/lib/usePersistedListPreferences';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import { PackageSourceBadge } from '../../../shared/packages/PackageSourceBadge';
import { readServerFunctionCatalogTags } from '../../../shared/lib/serverFunctionCatalogTags';
import { ServerFunctionDocsToolbarButtons } from './ServerFunctionDocsToolbarButtons';
import { METHOD_THEME } from '../constants';
import type { ServerFunctionItem } from '../types';
import type { ServerFunctionMethodFilter } from '../hooks/useServerFunctionCatalog';

type FunctionSortField = 'name' | 'method' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy';

type SortDirection = 'asc' | 'desc';

const HTTP_METHOD_FILTER_OPTIONS: Array<{ value: ServerFunctionMethodFilter; label: string }> = [
  { value: 'ALL', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const SORT_OPTIONS: Array<{ value: FunctionSortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'method', label: 'Method' },
  { value: 'createdAt', label: 'Created At' },
  { value: 'updatedAt', label: 'Updated At' },
  { value: 'createdBy', label: 'Created By' },
  { value: 'updatedBy', label: 'Updated By' },
];

const formatCatalogDate = (value?: string): string => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, 10) : '—';
};

const compareFunctions = (
  left: ServerFunctionItem,
  right: ServerFunctionItem,
  sortBy: FunctionSortField,
  sortDirection: SortDirection,
): number => {
  let result = 0;

  if (sortBy === 'name') {
    result = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  } else if (sortBy === 'method') {
    result = left.method.localeCompare(right.method);
  } else if (sortBy === 'createdBy' || sortBy === 'updatedBy') {
    const field = sortBy === 'createdBy' ? 'created_by' : 'updated_by';
    const leftValue = (left[field] ?? '').trim();
    const rightValue = (right[field] ?? '').trim();
    result = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' });
  } else if (sortBy === 'createdAt') {
    result = (left.created_at ?? '').localeCompare(right.created_at ?? '');
  } else {
    result = (left.updated_at ?? '').localeCompare(right.updated_at ?? '');
  }

  return sortDirection === 'asc' ? result : -result;
};

export type FunctionListSidebarProps = {
  layout?: 'page' | 'sidebar';
  isLargeScreen: boolean;
  sidebarWidth: number;
  activeId: string | null;
  onLoadFunction: (id: string) => void;
  builtInFilter: string;
  onBuiltInFilterChange: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  methodFilter: ServerFunctionMethodFilter;
  setMethodFilter: React.Dispatch<React.SetStateAction<ServerFunctionMethodFilter>>;
  groups: Record<string, ServerFunctionItem[]>;
  isCatalogLoading?: boolean;
  isCatalogFetching?: boolean;
  onRefreshCatalog: () => void;
  onCreateScript: () => void;
  onDuplicateFunction: (fn: ServerFunctionItem) => void;
  onRenameFunction: (fn: ServerFunctionItem) => void;
  onConfigureAccess: (fn: ServerFunctionItem) => void;
  onConfigureSettings: (fn: ServerFunctionItem) => void;
  onDeleteFunction: (id: string) => void;
  onOpenUnusedFunctions?: () => void;
  isFunctionActionBusy?: boolean;
};

export const FunctionListSidebar: React.FC<FunctionListSidebarProps> = ({
  activeId,
  onLoadFunction,
  builtInFilter,
  onBuiltInFilterChange,
  searchQuery,
  setSearchQuery,
  methodFilter,
  setMethodFilter,
  groups,
  isCatalogLoading = false,
  isCatalogFetching = false,
  onRefreshCatalog,
  onCreateScript,
  onDuplicateFunction,
  onRenameFunction,
  onConfigureAccess,
  onConfigureSettings,
  onDeleteFunction,
  onOpenUnusedFunctions,
  isFunctionActionBusy = false,
}) => {
  const [sortBy, setSortBy] = React.useState<FunctionSortField>('updatedAt');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.serverFunctions,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
    defaultListMode: DEFAULT_GRID_LIST_MODE,
  });

  const sortedItems = React.useMemo(() => {
    const items = Object.values(groups).flat();
    return [...items].sort((left, right) => compareFunctions(left, right, sortBy, sortDirection));
  }, [groups, sortBy, sortDirection]);

  const presentation = useGridListPresentation({
    items: sortedItems,
    pageSize,
    listMode,
    resetKeys: [searchQuery, methodFilter, builtInFilter, sortBy, sortDirection],
  });

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white font-sans">
      <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="name, path, method, tags…"
            ariaLabel="Search edge routes"
          />
          <ToolbarBuiltInFilter
            value={builtInFilter}
            onChange={onBuiltInFilterChange}
          />
          <ToolbarFilterSelect
            value={methodFilter === 'ALL' ? '' : methodFilter}
            onChange={(next) => setMethodFilter((next.trim() || 'ALL') as ServerFunctionMethodFilter)}
            ariaLabel="Method"
            allLabel="All"
            className="lg:max-w-[8.5rem] 2xl:max-w-[12rem]"
            options={HTTP_METHOD_FILTER_OPTIONS.filter((option) => option.value !== 'ALL')}
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ServerFunctionDocsToolbarButtons scope="all" />
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <ToolbarActionGroupWithRefresh
            onRefresh={onRefreshCatalog}
            isRefreshing={isCatalogFetching && !isCatalogLoading}
            actions={[
              {
                id: 'create-server-function',
                label: 'Create',
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: onCreateScript,
              },
              ...(onOpenUnusedFunctions
                ? [{
                  id: 'server-functions-unused',
                  label: 'Unused',
                  icon: <Unplug className="h-3.5 w-3.5" aria-hidden="true" />,
                  intent: 'secondary' as const,
                  onClick: onOpenUnusedFunctions,
                }]
                : []),
            ]}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" onScroll={presentation.handleScrollEnd}>
        {isCatalogLoading ? (
          <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
            Loading server functions…
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-5 text-center">
            <p className="text-sm font-medium text-slate-400">No results</p>
            <p className="text-xs font-medium text-slate-500">Try another search or create a route.</p>
          </div>
        ) : (
          <DevelopmentCatalogCardGrid>
            {presentation.displayItems.map((fn) => {
              const isActive = fn.id === activeId;
              const canManage = !fn.isBuiltIn && !isPackageServerFunction(fn);
              const catalogTags = readServerFunctionCatalogTags(fn.metadataJson);

              return (
                <DevelopmentCatalogCard key={fn.id} isActive={isActive}>
                  <DevelopmentCatalogCardHeader
                    title={fn.name}
                    titleTone="identifier"
                    onTitleClick={() => onLoadFunction(fn.id)}
                    titleAction={canManage ? (
                      <DevelopmentCatalogIconAction
                        intent="delete"
                        aria-label={`Delete ${fn.name}`}
                        title="Delete"
                        disabled={isFunctionActionBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteFunction(fn.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </DevelopmentCatalogIconAction>
                    ) : null}
                  />

                  {catalogTags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {catalogTags.slice(0, 4).map((tag) => (
                        <UiChip key={tag.toLowerCase()} size="sm" variant="soft" color="default">
                          {tag}
                        </UiChip>
                      ))}
                    </div>
                  ) : null}

                  {isPackageServerFunction(fn) ? (
                    <div className="mt-1 flex justify-end">
                      <PackageSourceBadge packageId={fn.packageId} packageDisplayName={fn.packageDisplayName} />
                    </div>
                  ) : null}

                  <DevelopmentCatalogCardFooter
                    date={formatCatalogDate(fn.updated_at)}
                    badge={
                      fn.isBuiltIn && !isPackageServerFunction(fn) ? (
                        <BuiltInBadge />
                      ) : (
                        <DevelopmentCatalogCardBadge
                          className={cn(
                            isPackageServerFunction(fn)
                              ? 'border-slate-200 bg-slate-50 text-slate-700'
                              : METHOD_THEME[fn.method].badge,
                          )}
                        >
                          {isPackageServerFunction(fn) ? 'Pkg' : fn.method}
                        </DevelopmentCatalogCardBadge>
                      )
                    }
                  >
                    {(!isPackageServerFunction(fn) || canManage) ? (
                      <div className="flex items-center gap-0.5">
                        {!isPackageServerFunction(fn) ? (
                          <>
                            <DevelopmentCatalogIconAction
                              intent="settings"
                              aria-label={`Settings for ${fn.name}`}
                              title="Settings"
                              disabled={isFunctionActionBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                onConfigureSettings(fn);
                              }}
                            >
                              <Settings className="h-3 w-3" />
                            </DevelopmentCatalogIconAction>
                            <DevelopmentCatalogIconAction
                              intent="access"
                              aria-label={`${ACCESS_CONTROL_ACTION_ARIA_LABEL} for ${fn.name}`}
                              title="Access"
                              disabled={isFunctionActionBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                onConfigureAccess(fn);
                              }}
                            >
                              <AccessControlActionIcon className="h-3 w-3" />
                            </DevelopmentCatalogIconAction>
                          </>
                        ) : null}
                        {canManage ? (
                          <>
                            <DevelopmentCatalogIconAction
                              intent="duplicate"
                              aria-label={`Rename ${fn.name}`}
                              title="Rename"
                              disabled={isFunctionActionBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                onRenameFunction(fn);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </DevelopmentCatalogIconAction>
                            <DevelopmentCatalogIconAction
                              intent="duplicate"
                              aria-label={`Duplicate ${fn.name}`}
                              title="Duplicate"
                              disabled={isFunctionActionBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDuplicateFunction(fn);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </DevelopmentCatalogIconAction>
                          </>
                        ) : null}
                      </div>
                    ) : null}
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
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onToggleSortDirection={toggleSortDirection}
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
