import * as React from 'react';
import { HwyMemberDirectoryLegacyFilterBarPanel } from '../hwy/HwyMemberDirectoryLegacyFilterBarPanel';
import { resolveHwyLegacyFieldFilterToolbarChrome } from '../hwy/hwyMemberListToolbarLegacyFilterChrome';
import { HwyMemberListToolbarActionsEnd } from '../hwy/HwyMemberListToolbarActionsEnd';
import { HwyMemberListToolbarRefreshControl } from '../hwy/hwyMemberListToolbarRefreshControl';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ListPageToolbarFrame,
  ListPageToolbarScrollRoot,
  PAGE_TOOLBAR_INNER_ROW_CLASS,
  PAGE_TOOLBAR_MULTI_ROW_CLASS,
  useListPageToolbarScrollContext,
  ToolbarExportButton,
  ToolbarFilterCheckboxGroupItem,
  ToolbarFilterMatchLogicBadge,
  ToolbarFilterRadioGroup,
  ToolbarFilterSelect,
  ListFilterToolbarControl,
  QueryPresetChips,
  ToolbarRefreshButton,
  ToolbarRefreshWithListCount,
  ToolbarSearchInput,
  type ListFilterButtonProps,
  type QueryPresetChipItem,
} from '../../shared/ui';
import {
  DEFAULT_FILTER_MATCH_LOGIC,
  type FilterMatchLogic,
} from '../../shared/lib/filterMatchLogic';
import {
  fieldFilterSupportsMatchLogic,
  resolveEffectiveFieldFilters,
  resolveFieldFilterOptionDisplayLabel,
  resolveFieldFilterStaticOptions,
  type DesignerGridToolbarConfig,
  type DesignerGridToolbarFieldFilterConfig,
} from './designerGridToolbarConfig';
import { useResolvedToolbarFieldFilters } from './useResolvedToolbarFieldFilters';
import type { DesignerExportFormat } from './designerDataExport';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { resolveDesignerGridCultureText } from './designerGridCultureKeys';
import type { RuntimeRenderMode } from './runtimeTypes';
import { executeDesignerGridCellClick } from './bindingGridRowActionRuntime';
import { executePickFileCreateBehavior } from './designerGridPickFileCreate';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';
import { resolveDesignerGridActionIcon, type DesignerGridRowActionBehavior } from './designerGridActionColumns';
type DesignerGridPageToolbarProps = {
  node: DesignerNode;
  document?: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions;
  config: DesignerGridToolbarConfig;
  mode: RuntimeRenderMode;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  /** @deprecated Prefer checkboxSelections keyed by field-filter id. */
  roleFilters?: Record<string, boolean>;
  onRoleFilterChange?: (role: string, checked: boolean) => void;
  /** checkbox-group selections: filterId → optionValue → checked */
  checkboxSelections?: Record<string, Record<string, boolean>>;
  onCheckboxFilterChange?: (filterId: string, optionValue: string, checked: boolean) => void;
  matchLogicByFilterId?: Record<string, FilterMatchLogic>;
  onMatchLogicChange?: (filterId: string, value: FilterMatchLogic) => void;
  /** radio-group selections: filterId → selected value (includes legacy paramFilterValues). */
  paramFilterValues?: Record<string, string>;
  radioSelections?: Record<string, string>;
  onParamFilterChange?: (filterId: string, value: string) => void;
  onRadioFilterChange?: (filterId: string, value: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Server list total (exact COUNT when available). Shown beside refresh when set. */
  listTotalCount?: number;
  onExport?: (format: DesignerExportFormat) => void;
  patchStore?: (path: string, value: unknown) => void;
  patchStoreState?: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => void;
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  designerStore?: Record<string, unknown>;
  onLovFilterOpen?: (filterId: string) => void;
  listWhereFilterEnabled?: boolean;
  listFilterButtonProps?: ListFilterButtonProps;
  queryPresets?: readonly QueryPresetChipItem[];
  queryPresetSelectedIds?: readonly string[];
  onQueryPresetChange?: (nextIds: string[]) => void;
  /** When false, toolbar field filters (status, institute, …) stay hidden. Default true. */
  showFieldFilters?: boolean;
  /** Toggle for legacy-style field filter bar (Hawiety lists). */
  legacyFieldFilterToggle?: React.ReactNode;
  /** True when field-by-field legacy mode is active (toggle on). */
  legacyFieldFilterModeActive?: boolean;
  /** When false, hide global toolbar search (legacy per-field bar active). */
  globalSearchVisible?: boolean;
  /** Second-row legacy field inputs (member directory). */
  memberDirectoryLegacyFilterBar?: React.ReactNode;
  /** Legacy membership status checkboxes (All People list). */
  memberDirectoryLegacyMembershipRow?: React.ReactNode;
};

const executeCreateBehavior = (
  node: DesignerNode,
  document: DesignerDocument | undefined,
  bindingDefinitions: DesignerBindingDefinitions | undefined,
  behavior: DesignerGridRowActionBehavior | undefined,
  patchStore?: (path: string, value: unknown) => void,
  patchStoreState?: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => void,
  navigate?: (to: string, options?: { replace?: boolean }) => void,
  designerStore?: Record<string, unknown>,
  onRefresh?: () => void,
): void => {
  if (!behavior || behavior.kind === 'none') {
    return;
  }

  if (behavior.kind === 'pick-file-create') {
    void executePickFileCreateBehavior(behavior, {
      bindingDefinitions,
      designerStore,
      onRefresh,
    });
    return;
  }

  if (behavior.kind === 'navigate') {
    const target = behavior.navigateTarget?.trim();
    if (target && navigate) {
      navigate(target, { replace: behavior.navigateReplace === true });
    }
    return;
  }

  if (!document || !bindingDefinitions) {
    return;
  }

  executeDesignerGridCellClick(
    node,
    document,
    bindingDefinitions,
    {},
    {
      key: '__toolbar_create',
      label: 'Create',
      cellClickBehavior: behavior,
    },
    {
      patchStore: patchStore ?? (() => undefined),
      patchStoreState,
      navigate,
    },
  );
};

const resolveCheckboxSelection = (
  filter: DesignerGridToolbarFieldFilterConfig,
  checkboxSelections: Record<string, Record<string, boolean>> | undefined,
  legacyRoleFilters: Record<string, boolean> | undefined,
): Record<string, boolean> => {
  if (checkboxSelections?.[filter.id]) {
    return checkboxSelections[filter.id]!;
  }
  if (
    legacyRoleFilters
    && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
  ) {
    return legacyRoleFilters;
  }
  return {};
};

export const DesignerGridPageToolbar: React.FC<DesignerGridPageToolbarProps> = ({
  node,
  document,
  bindingDefinitions,
  config,
  mode,
  searchInput,
  onSearchInputChange,
  roleFilters,
  onRoleFilterChange,
  checkboxSelections,
  onCheckboxFilterChange,
  matchLogicByFilterId,
  onMatchLogicChange,
  paramFilterValues,
  radioSelections,
  onParamFilterChange,
  onRadioFilterChange,
  onRefresh,
  isRefreshing = false,
  listTotalCount,
  onExport,
  patchStore,
  patchStoreState,
  navigate,
  designerStore,
  onLovFilterOpen,
  listWhereFilterEnabled = false,
  listFilterButtonProps,
  queryPresets,
  queryPresetSelectedIds,
  onQueryPresetChange,
  showFieldFilters = true,
  legacyFieldFilterToggle,
  legacyFieldFilterModeActive = false,
  globalSearchVisible = true,
  memberDirectoryLegacyFilterBar,
  memberDirectoryLegacyMembershipRow,
}) => {
  const listToolbarScroll = useListPageToolbarScrollContext();
  const culture = useOptionalCulture();
  const translate = culture?.ready ? culture.t : undefined;
  const search = config.search;
  const filterAllLabel = translate
    ? (() => {
      const translated = translate('grid.filter.all', { missing: 'silent' });
      return translated !== 'grid.filter.all' ? translated : 'All';
    })()
    : 'All';
  const resolveFilterAriaLabel = (filter: DesignerGridToolbarFieldFilterConfig): string => {
    const key = filter.labelTranslationKey?.trim();
    if (key && translate) {
      const translated = translate(key);
      if (translated !== key) {
        return translated;
      }
    }
    return filter.label;
  };
  const searchPlaceholder = resolveDesignerGridCultureText(
    node,
    'searchPlaceholderTranslationKey',
    search?.placeholder ?? '…',
    translate,
  );
  const effectiveFieldFilters = React.useMemo(
    () => resolveEffectiveFieldFilters(config),
    [config],
  );
  const { fieldFilters, revalidateLovFilter } = useResolvedToolbarFieldFilters(
    effectiveFieldFilters,
    bindingDefinitions,
  );
  const create = config.create;
  const refresh = config.refresh;
  const exportEnabled = config.export?.enabled === true || config.showExportButton === true;
  const exportDefaultFormat = config.export?.defaultFormat === 'xlsx' || config.export?.defaultFormat === 'pdf'
    ? config.export.defaultFormat
    : 'csv';
  const CreateIcon = resolveDesignerGridActionIcon(create?.icon ?? 'Plus');
  const radioValues = radioSelections ?? paramFilterValues ?? {};
  const hasToolbarFieldFilters = showFieldFilters
    && fieldFilters.some((filter) => resolveFieldFilterStaticOptions(filter).length > 0);
  const showListTotalBadge = typeof listTotalCount === 'number'
    && Number.isFinite(listTotalCount)
    && refresh?.enabled;
  const actionsEndSeparatorBefore = Boolean(create?.enabled) || exportEnabled;
  const swapRefreshWithListFilter = Boolean(
    listWhereFilterEnabled
    && listFilterButtonProps
    && refresh?.enabled,
  );
  const hasLegacyFilterModeSwitch = legacyFieldFilterToggle != null;
  const legacyFilterToolbarChrome = resolveHwyLegacyFieldFilterToolbarChrome({
    hasLegacyFilterModeSwitch,
    legacyFieldFilterModeActive,
    refreshEnabled: Boolean(refresh?.enabled && onRefresh && !swapRefreshWithListFilter),
  });
  const searchVisible = Boolean(search?.enabled) && (
    hasLegacyFilterModeSwitch
      ? legacyFilterToolbarChrome.quickSearchVisible
      : globalSearchVisible
  );
  const listFilterSeparatorBefore = searchVisible
    || hasToolbarFieldFilters
    || Boolean(memberDirectoryLegacyFilterBar);
  const refreshInFiltersCluster = legacyFilterToolbarChrome.refreshInFiltersCluster;
  const passRefreshToActionsEnd = !hasLegacyFilterModeSwitch;
  const listTotalCountValue = showListTotalBadge
    ? Math.max(0, Math.floor(listTotalCount))
    : undefined;
  const listFilterInActionsNode = swapRefreshWithListFilter && listFilterButtonProps ? (
    <ListFilterToolbarControl
      filterButtonProps={listFilterButtonProps}
      separatorBefore
    />
  ) : null;
  const refreshInFiltersSeparatorBefore = hasLegacyFilterModeSwitch
    ? legacyFilterToolbarChrome.quickSearchVisible
    : listFilterSeparatorBefore;
  const refreshInFiltersNode = swapRefreshWithListFilter ? (
    listTotalCountValue !== undefined ? (
      <ToolbarRefreshWithListCount
        count={listTotalCountValue}
        onClick={() => onRefresh?.()}
        isRefreshing={isRefreshing}
        disabled={mode === 'design' || !onRefresh}
        separatorBefore={refreshInFiltersSeparatorBefore}
      />
    ) : (
      <ToolbarRefreshButton
        onClick={() => onRefresh?.()}
        isRefreshing={isRefreshing}
        disabled={mode === 'design' || !onRefresh}
        separatorBefore={refreshInFiltersSeparatorBefore}
      />
    )
  ) : null;

  const handleCheckboxChange = (filter: DesignerGridToolbarFieldFilterConfig, optionValue: string, checked: boolean) => {
    if (onCheckboxFilterChange) {
      onCheckboxFilterChange(filter.id, optionValue, checked);
      return;
    }
    if (
      onRoleFilterChange
      && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
    ) {
      onRoleFilterChange(optionValue, checked);
    }
  };

  const handleRadioChange = (filterId: string, value: string) => {
    if (onRadioFilterChange) {
      onRadioFilterChange(filterId, value);
      return;
    }
    onParamFilterChange?.(filterId, value);
  };

  const filtersCluster = (
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        {searchVisible ? (
          <ToolbarSearchInput
            value={searchInput}
            onChange={onSearchInputChange}
            placeholder={searchPlaceholder}
            ariaLabel={searchPlaceholder !== '…' ? searchPlaceholder : (search?.placeholder ?? 'Search')}
          />
        ) : null}
        {refreshInFiltersCluster ? (
          <HwyMemberListToolbarRefreshControl
            listTotalCount={listTotalCountValue}
            onRefresh={() => onRefresh?.()}
            isRefreshing={isRefreshing}
            refreshDisabled={mode === 'design' || !onRefresh}
            separatorBefore={legacyFilterToolbarChrome.quickSearchVisible}
          />
        ) : null}

        {showFieldFilters ? fieldFilters.map((filter) => {
          if (
            memberDirectoryLegacyMembershipRow
            && filter.id === 'membershipStatusCode'
          ) {
            return null;
          }
          const options = resolveFieldFilterStaticOptions(filter);
          if (filter.controlType === 'checkbox-group') {
            if (options.length === 0) {
              return null;
            }
            const selection = resolveCheckboxSelection(filter, checkboxSelections, roleFilters);
            const matchLogic = matchLogicByFilterId?.[filter.id]
              ?? filter.matchLogic
              ?? DEFAULT_FILTER_MATCH_LOGIC;
            return (
              <div
                key={filter.id}
                className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}
                data-testid={`designer-grid-toolbar-field-filter-${filter.id}`}
              >
                <ToolbarFilterMatchLogicBadge
                  value={matchLogic}
                  onChange={(next) => onMatchLogicChange?.(filter.id, next)}
                  ariaLabel={`${filter.label} match logic`}
                />
                <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden />
                {options.map((option) => (
                  <ToolbarFilterCheckboxGroupItem
                    key={option.value}
                    id={`${node.id}-grid-toolbar-${filter.id}-${option.value}`}
                    checked={Boolean(selection[option.value])}
                    onChange={(checked) => handleCheckboxChange(filter, option.value, checked)}
                  >
                    {option.label}
                  </ToolbarFilterCheckboxGroupItem>
                ))}
              </div>
            );
          }

          if (filter.controlType === 'select') {
            if (options.length === 0 && filter.optionsSource !== 'lov') {
              return null;
            }
            const filterAriaLabel = resolveFilterAriaLabel(filter);
            const displayOptions = options.map((option) => ({
              value: option.value,
              label: resolveFieldFilterOptionDisplayLabel(option, translate),
            }));
            const supportsMatchLogic = fieldFilterSupportsMatchLogic(filter);
            const matchLogic = supportsMatchLogic
              ? (matchLogicByFilterId?.[filter.id]
                ?? filter.matchLogic
                ?? DEFAULT_FILTER_MATCH_LOGIC)
              : undefined;
            return (
              <ToolbarFilterSelect
                key={filter.id}
                value={radioValues[filter.id] ?? ''}
                options={displayOptions}
                onChange={(value) => handleRadioChange(filter.id, value)}
                ariaLabel={filterAriaLabel}
                allLabel={filterAllLabel}
                className={filter.selectHostClassName}
                multiple={filter.multiple === true}
                matchLogic={matchLogic}
                onMatchLogicChange={
                  supportsMatchLogic
                    ? (next) => onMatchLogicChange?.(filter.id, next)
                    : undefined
                }
                matchLogicAriaLabel={(() => {
                  const filterLabel = resolveFilterAriaLabel(filter);
                  if (!translate) {
                    return `${filter.label} match logic`;
                  }
                  const suffix = translate('grid.filter.matchLogic.ariaSuffix', { missing: 'silent' });
                  return `${filterLabel} ${suffix !== 'grid.filter.matchLogic.ariaSuffix' ? suffix : 'match logic'}`;
                })()}
                onDropdownOpen={
                  filter.optionsSource === 'lov'
                    ? () => {
                        void revalidateLovFilter(filter.id);
                        onLovFilterOpen?.(filter.id);
                      }
                    : undefined
                }
              />
            );
          }

          return (
            <ToolbarFilterRadioGroup
              key={filter.id}
              value={radioValues[filter.id] ?? ''}
              options={options}
              onChange={(value) => handleRadioChange(filter.id, value)}
              ariaLabel={filter.label}
            />
          );
        }) : null}
        {!swapRefreshWithListFilter && listWhereFilterEnabled && listFilterButtonProps ? (
          <ListFilterToolbarControl
            filterButtonProps={listFilterButtonProps}
            separatorBefore={listFilterSeparatorBefore}
          />
        ) : null}
        {refreshInFiltersNode}
        {queryPresets && queryPresets.length > 0 && onQueryPresetChange ? (
          <QueryPresetChips
            presets={queryPresets}
            selectedIds={queryPresetSelectedIds ?? []}
            onChange={onQueryPresetChange}
            className="ms-1"
          />
        ) : null}
    </div>
  );

  const actionsCluster = (
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        {create?.enabled ? (
          <AppButton
            type="button"
            intent="secondary"
            size="icon-md"
            disabled={mode === 'design'}
            aria-label={create.label ?? 'Add'}
            title={create.label ?? 'Add'}
            onClick={() => executeCreateBehavior(
              node,
              document,
              bindingDefinitions,
              create.behavior,
              patchStore,
              patchStoreState,
              navigate,
              designerStore,
              onRefresh,
            )}
          >
            <CreateIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </AppButton>
        ) : null}
        {exportEnabled ? (
          <ToolbarExportButton
            defaultFormat={exportDefaultFormat}
            disabled={mode === 'design' || !onExport}
            onExport={(format) => onExport?.(format)}
            separatorBefore={create?.enabled === true}
          />
        ) : null}
        {actionsEndSeparatorBefore ? (
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        ) : null}
        <HwyMemberListToolbarActionsEnd
          listTotalCount={
            swapRefreshWithListFilter || !passRefreshToActionsEnd
              ? undefined
              : listTotalCountValue
          }
          actionsLeading={hasLegacyFilterModeSwitch ? listFilterInActionsNode : undefined}
          legacyFieldFilterToggle={legacyFieldFilterToggle}
          refreshSlotReplacement={hasLegacyFilterModeSwitch ? undefined : listFilterInActionsNode}
          onRefresh={
            swapRefreshWithListFilter
              ? undefined
              : (passRefreshToActionsEnd && refresh?.enabled
                ? () => onRefresh?.()
                : undefined)
          }
          isRefreshing={isRefreshing}
          refreshDisabled={mode === 'design' || !onRefresh}
        />
      </div>
  );

  if (memberDirectoryLegacyFilterBar || memberDirectoryLegacyMembershipRow) {
    return (
      <ListPageToolbarScrollRoot
        collapsed={listToolbarScroll?.listToolbarCollapsed ?? false}
        className={PAGE_TOOLBAR_MULTI_ROW_CLASS}
      >
        <div className={PAGE_TOOLBAR_INNER_ROW_CLASS}>
          {filtersCluster}
          {actionsCluster}
        </div>
        <HwyMemberDirectoryLegacyFilterBarPanel
          membershipRow={memberDirectoryLegacyMembershipRow}
          fieldFilterRow={memberDirectoryLegacyFilterBar}
        />
      </ListPageToolbarScrollRoot>
    );
  }

  return (
    <ListPageToolbarFrame>
      {filtersCluster}
      {actionsCluster}
    </ListPageToolbarFrame>
  );
};
