import * as React from 'react';
import { Copy, Pencil, Plus, Tags, Trash2, Unplug } from 'lucide-react';
import {
  AppButton,
  AppSplitButton,
  SplitButtonMenuItem,
  BuiltInBadge,
  CatalogSystemTagBadge,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardFooter,
  DevelopmentCatalogCardGrid,
  DevelopmentCatalogCardHeader,
  DevelopmentCatalogIconAction,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarFilterSelect,
  ToolbarBuiltInFilter,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  GridPagingFooter,
  useGridListPresentation,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { cn } from '../../../lib/utils';
import type { DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import { CATALOG_CREATE_KINDS, type CatalogCreateKind } from './create-wizard/catalogCreateKinds';
import {
  CATALOG_KIND_FILTER_OPTIONS,
  CATALOG_TAG_BUILTIN,
  catalogSystemTags,
} from '../../../domain/component-designer/layout-presets/catalogSystemTags';

type ComponentSortField = 'name' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy';
type SortDirection = 'asc' | 'desc';

/** Locked catalog page size — no page-size or paging/infinite switch in this footer. */
const CATALOG_PAGE_SIZE = 1000;

const SORT_OPTIONS: Array<{ value: ComponentSortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created At' },
  { value: 'updatedAt', label: 'Updated At' },
  { value: 'createdBy', label: 'Created By' },
  { value: 'updatedBy', label: 'Updated By' },
];

const formatCatalogDate = (value?: string): string => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, 10) : '—';
};

/** Footer badge matches Server Functions: BuiltIn wins; otherwise the type (custom / shell / template). */
const catalogFooterBadgeTag = (draft: DesignerVersionSummary): string => {
  if (draft.isBuiltIn && !draft.isPackageComponent) {
    return CATALOG_TAG_BUILTIN;
  }
  const tags = catalogSystemTags(draft).filter((tag) => tag !== CATALOG_TAG_BUILTIN);
  return tags[0] ?? 'custom';
};

const compareDrafts = (
  left: DesignerVersionSummary,
  right: DesignerVersionSummary,
  sortBy: ComponentSortField,
  sortDirection: SortDirection,
): number => {
  let result = 0;

  if (sortBy === 'name') {
    result = (left.name ?? '').localeCompare(right.name ?? '', undefined, { sensitivity: 'base' });
  } else if (sortBy === 'createdBy' || sortBy === 'updatedBy') {
    const leftValue = (left[sortBy] ?? '').trim();
    const rightValue = (right[sortBy] ?? '').trim();
    result = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' });
  } else {
    result = (left[sortBy] ?? '').localeCompare(right[sortBy] ?? '');
  }

  return sortDirection === 'asc' ? result : -result;
};

const CatalogDraftCard: React.FC<{
  draft: DesignerVersionSummary;
  isActive: boolean;
  isLoading: boolean;
  isComponentActionBusy: boolean;
  onOpenLiveDesigner?: (draftId: string) => void;
  onEditComponent: (draftId: string) => void;
  onEditComponentTags: (draftId: string) => void;
  onDuplicateComponent: (draftId: string) => void;
  onDeleteComponent: (draftId: string) => void;
}> = ({
  draft,
  isActive,
  isLoading,
  isComponentActionBusy,
  onOpenLiveDesigner,
  onEditComponent,
  onEditComponentTags,
  onDuplicateComponent,
  onDeleteComponent,
}) => {
  const isBuiltIn = Boolean(draft.isBuiltIn);
  const isPackageComponent = Boolean(draft.isPackageComponent);
  const canDelete = !isBuiltIn && !isPackageComponent;
  const canRename = !isPackageComponent;
  const canDuplicate = !isPackageComponent;
  const footerBadgeTag = catalogFooterBadgeTag(draft);
  const handleTitleClick = isLoading || !onOpenLiveDesigner
    ? undefined
    : () => {
        onOpenLiveDesigner(draft.id);
      };

  return (
    <DevelopmentCatalogCard isActive={isActive} isLoading={isLoading}>
      <DevelopmentCatalogCardHeader
        title={isLoading ? 'Loading…' : draft.name}
        onTitleClick={handleTitleClick}
        titleAction={canDelete ? (
          <DevelopmentCatalogIconAction
            intent="delete"
            aria-label={`Delete ${draft.name}`}
            title="Delete"
            disabled={isComponentActionBusy || isLoading}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteComponent(draft.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </DevelopmentCatalogIconAction>
        ) : null}
      />

      <div className="mt-auto">
        <DevelopmentCatalogCardFooter
          date={formatCatalogDate(draft.updatedAt)}
          badge={
            footerBadgeTag === CATALOG_TAG_BUILTIN ? (
              <BuiltInBadge data-testid={`catalog-type-badge-${footerBadgeTag}`} />
            ) : (
              <CatalogSystemTagBadge
                tag={footerBadgeTag}
                data-testid={`catalog-type-badge-${footerBadgeTag}`}
              />
            )
          }
        >
          {canRename || canDuplicate ? (
            <>
              {canRename ? (
                <DevelopmentCatalogIconAction
                  intent="duplicate"
                  aria-label={`Rename ${draft.name}`}
                  title="Rename"
                  disabled={isComponentActionBusy || isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditComponent(draft.id);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
              {canRename ? (
                <DevelopmentCatalogIconAction
                  intent="settings"
                  aria-label={`Tags for ${draft.name}`}
                  title="Tags"
                  disabled={isComponentActionBusy || isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditComponentTags(draft.id);
                  }}
                >
                  <Tags className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
              {canDuplicate ? (
                <DevelopmentCatalogIconAction
                  intent="duplicate"
                  aria-label={`Duplicate ${draft.name}`}
                  title="Duplicate"
                  disabled={isComponentActionBusy || isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicateComponent(draft.id);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </DevelopmentCatalogIconAction>
              ) : null}
            </>
          ) : null}
        </DevelopmentCatalogCardFooter>
      </div>
    </DevelopmentCatalogCard>
  );
};

const CatalogCardGrid: React.FC<{
  drafts: DesignerVersionSummary[];
  activeDraftId: string | null;
  loadingComponentId: string | null;
  isComponentActionBusy: boolean;
  onOpenLiveDesigner?: (draftId: string) => void;
  onEditComponent: (draftId: string) => void;
  onEditComponentTags: (draftId: string) => void;
  onDuplicateComponent: (draftId: string) => void;
  onDeleteComponent: (draftId: string) => void;
}> = ({
  drafts,
  activeDraftId,
  loadingComponentId,
  isComponentActionBusy,
  onOpenLiveDesigner,
  onEditComponent,
  onEditComponentTags,
  onDuplicateComponent,
  onDeleteComponent,
}) => (
  <DevelopmentCatalogCardGrid>
    {drafts.map((draft) => (
      <CatalogDraftCard
        key={draft.id}
        draft={draft}
        isActive={draft.id === activeDraftId}
        isLoading={loadingComponentId === draft.id}
        isComponentActionBusy={isComponentActionBusy}
        onOpenLiveDesigner={onOpenLiveDesigner}
        onEditComponent={onEditComponent}
        onEditComponentTags={onEditComponentTags}
        onDuplicateComponent={onDuplicateComponent}
        onDeleteComponent={onDeleteComponent}
      />
    ))}
  </DevelopmentCatalogCardGrid>
);

export type DesignerPaletteSidebarProps = {
  layout?: 'page' | 'sidebar';
  paletteSearch: string;
  onPaletteSearchChange: (value: string) => void;
  onOpenCreate: (kind: CatalogCreateKind) => void;
  onRefreshComponents: () => void;
  catalogKindFilter: string;
  onCatalogKindFilterChange: (value: string) => void;
  catalogBuiltInFilter?: string;
  onCatalogBuiltInFilterChange?: (value: string) => void;
  onEditComponent: (draftId: string) => void;
  onEditComponentTags: (draftId: string) => void;
  onDuplicateComponent: (draftId: string) => void;
  onDeleteComponent: (draftId: string) => void;
  isComponentActionBusy: boolean;
  isDraftsLoading: boolean;
  groups: Record<string, DesignerVersionSummary[]>;
  activeDraftId: string | null;
  loadingComponentId: string | null;
  onOpenLiveDesigner?: (draftId: string) => void;
  onOpenUnusedComponents?: () => void;
};

export const DesignerPaletteSidebar: React.FC<DesignerPaletteSidebarProps> = ({
  paletteSearch,
  onPaletteSearchChange,
  onOpenCreate,
  onRefreshComponents,
  catalogKindFilter,
  onCatalogKindFilterChange,
  catalogBuiltInFilter = '',
  onCatalogBuiltInFilterChange,
  onEditComponent,
  onEditComponentTags,
  onDuplicateComponent,
  onDeleteComponent,
  isComponentActionBusy,
  isDraftsLoading,
  groups,
  activeDraftId,
  loadingComponentId,
  onOpenLiveDesigner,
  onOpenUnusedComponents,
}) => {
  const [sortBy, setSortBy] = React.useState<ComponentSortField>('updatedAt');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = React.useState(false);

  const sortedItems = React.useMemo(() => {
    const items = Object.values(groups).flat();
    const compare = (left: DesignerVersionSummary, right: DesignerVersionSummary) => (
      compareDrafts(left, right, sortBy, sortDirection)
    );
    return [...items].sort(compare);
  }, [groups, sortBy, sortDirection]);

  const presentation = useGridListPresentation({
    items: sortedItems,
    pageSize: CATALOG_PAGE_SIZE,
    listMode: 'paging',
    resetKeys: [paletteSearch, catalogKindFilter, catalogBuiltInFilter, sortBy, sortDirection],
  });

  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll(presentation.handleScrollEnd);

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white font-sans">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={paletteSearch}
            onChange={onPaletteSearchChange}
            placeholder="Search components"
            ariaLabel="Search palette components"
          />
          <ToolbarFilterSelect
            value={catalogKindFilter}
            onChange={onCatalogKindFilterChange}
            ariaLabel="Kind"
            allLabel="All"
            hint="Filter by type: Custom, Shell, or Template. BuiltIn is a separate filter."
            options={[...CATALOG_KIND_FILTER_OPTIONS]}
          />
          <ToolbarBuiltInFilter
            value={catalogBuiltInFilter}
            onChange={onCatalogBuiltInFilterChange ?? (() => undefined)}
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <span className="inline-flex" data-testid="catalog-create">
            <AppSplitButton
              intent="create"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              label="Create"
              isOpen={isCreateMenuOpen}
              onOpenChange={setIsCreateMenuOpen}
              triggerAriaLabel="Create component"
              menuAriaLabel="Create component kinds"
              menuClassName="min-w-[16rem]"
            >
              {CATALOG_CREATE_KINDS.map((option) => {
                const Icon = option.icon;
                return (
                  <SplitButtonMenuItem
                    key={option.value}
                    icon={<Icon className="h-3.5 w-3.5 shrink-0" />}
                    data-testid={`catalog-create-${option.value}`}
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      onOpenCreate(option.value);
                    }}
                  >
                    {option.title}
                  </SplitButtonMenuItem>
                );
              })}
            </AppSplitButton>
          </span>
          <ToolbarActionGroupWithRefresh
            onRefresh={onRefreshComponents}
            isRefreshing={isDraftsLoading}
            actions={onOpenUnusedComponents
              ? [{
                id: 'unused-components',
                label: 'Unused',
                icon: <Unplug className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'secondary',
                onClick: onOpenUnusedComponents,
              }]
              : []}
          />
        </div>
      </ListPageToolbarFrame>

      <div className="min-h-0 flex-1 overflow-auto" onScroll={handleGridScroll}>
        {isDraftsLoading ? (
          <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
            Loading components…
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-5 text-center">
            <p className="text-sm font-medium text-slate-400">
              No results
            </p>
            <p className="text-xs font-medium text-slate-500">
              Try another search or create a layout.
            </p>
          </div>
        ) : (
          <CatalogCardGrid
            drafts={presentation.displayItems}
            activeDraftId={activeDraftId}
            loadingComponentId={loadingComponentId}
            isComponentActionBusy={isComponentActionBusy}
            onOpenLiveDesigner={onOpenLiveDesigner}
            onEditComponent={onEditComponent}
            onEditComponentTags={onEditComponentTags}
            onDuplicateComponent={onDuplicateComponent}
            onDeleteComponent={onDeleteComponent}
          />
        )}
      </div>

      <GridPagingFooter
        totalCount={presentation.totalCount}
        safePage={presentation.safePage}
        pageSize={CATALOG_PAGE_SIZE}
        onPageSizeChange={() => undefined}
        showPageSizeControls={false}
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onToggleSortDirection={toggleSortDirection}
        totalPages={presentation.totalPages}
        pageNumbers={presentation.pageNumbers}
        onPageChange={presentation.setPage}
      />
    </div>
  );
};
