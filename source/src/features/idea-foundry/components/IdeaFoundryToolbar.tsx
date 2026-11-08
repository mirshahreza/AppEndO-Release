import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, Plus } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarFilterSelect,
  ToolbarSearchInput,
  UiSelect,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { cn } from '../../../lib/utils';
import {
  DEFAULT_IDEA_SORT,
  IDEA_IMPORTANCE_OPTIONS,
  IDEA_MATURITY_OPTIONS,
  IDEA_SCALE_OPTIONS,
  IDEA_SORT_OPTIONS,
  isIdeaSortField,
  type IdeaSortDirection,
  type IdeaSortField,
} from '../ideaFoundryCatalog';

export type IdeaFoundryFilters = {
  searchQuery: string;
  maturity: string;
  importance: string;
  scale: string;
  sortBy: IdeaSortField;
  sortDirection: IdeaSortDirection;
};

type IdeaFoundryToolbarProps = {
  filters: IdeaFoundryFilters;
  onFiltersChange: (patch: Partial<IdeaFoundryFilters>) => void;
  onCreate: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  listToolbarCollapsed?: boolean;
};

export const IdeaFoundryToolbar: React.FC<IdeaFoundryToolbarProps> = ({
  filters,
  onFiltersChange,
  onCreate,
  onRefresh,
  isRefreshing,
  listToolbarCollapsed = false,
}) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={filters.searchQuery}
        onChange={(searchQuery) => onFiltersChange({ searchQuery })}
        placeholder="title or description…"
        ariaLabel="Search ideas"
      />
      <ToolbarFilterSelect
        value={filters.maturity}
        onChange={(maturity) => onFiltersChange({ maturity })}
        options={IDEA_MATURITY_OPTIONS.map((option) => ({ value: option.value, label: option.title }))}
        ariaLabel="Stage"
        allLabel="All stages"
      />
      <ToolbarFilterSelect
        value={filters.importance}
        onChange={(importance) => onFiltersChange({ importance })}
        options={IDEA_IMPORTANCE_OPTIONS.map((option) => ({ value: option.value, label: option.title }))}
        ariaLabel="Importance"
        allLabel="All importance"
      />
      <ToolbarFilterSelect
        value={filters.scale}
        onChange={(scale) => onFiltersChange({ scale })}
        options={IDEA_SCALE_OPTIONS.map((option) => ({ value: option.value, label: option.title }))}
        ariaLabel="Scale"
        allLabel="All scales"
      />
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <div className="flex shrink-0 items-center gap-1">
        <div
          className="min-w-[9rem] max-w-[12rem] shrink-0"
          {...pageGuideLocalProps('Sort by', 'Order the board by updated, title, stage, importance, scale, or created.')}
        >
          <UiSelect
            size="sm"
            value={filters.sortBy}
            ariaLabel="Sort by"
            className="shrink-0 font-medium text-slate-700"
            onChange={(event) => {
              const next = event.target.value;
              onFiltersChange({ sortBy: isIdeaSortField(next) ? next : DEFAULT_IDEA_SORT });
            }}
          >
            {IDEA_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </div>
        <AppButton
          intent="utility"
          size="icon-md"
          aria-label={filters.sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
          title={filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          onClick={() => onFiltersChange({
            sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc',
          })}
        >
          {filters.sortDirection === 'asc'
            ? <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden="true" />
            : <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden="true" />}
        </AppButton>
      </div>
      <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      <ToolbarActionGroupWithRefresh
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={[
          {
            id: 'new-idea',
            label: 'New idea',
            icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
            intent: 'create',
            primary: true,
            onClick: onCreate,
            guideHint: PAGE_GUIDE_EN['pageGuide.page.ideaFoundry.create.hint'],
          },
        ]}
      />
    </div>
  </ListPageToolbarFrame>
);
