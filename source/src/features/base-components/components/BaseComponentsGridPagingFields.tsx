import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  GridPagingFooter,
  UiSelect,
} from '../../../shared/ui';
import type { GridListMode } from '../../../shared/lib/gridPagingConstants';
import type { GridPagingNavButtonLabelMode } from '../../../shared/ui/GridPagingFooter';
import type { ViewportTier } from '../../../shared/lib/viewportTokens';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { markBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';

export type BaseComponentsGridPagingMode = 'numbered' | 'prev-next' | 'cursor' | 'load-more';
export type BaseComponentsGridPagingState = 'default' | 'loading' | 'first' | 'last';

export type BaseComponentsGridPagingConfig = {
  enabled: boolean;
  listMode: GridListMode;
  pageSize: number;
  showSortControls: boolean;
  mode: BaseComponentsGridPagingMode;
  showSummary: boolean;
  showFirstLast: boolean;
  siblingCount: 0 | 1 | 2;
  pageJump: boolean;
  state: BaseComponentsGridPagingState;
  navButtonLabelMode: GridPagingNavButtonLabelMode;
};

export const DEFAULT_GRID_PAGING_DEMO_CONFIG: BaseComponentsGridPagingConfig = {
  enabled: true,
  listMode: 'paging',
  pageSize: 10,
  showSortControls: true,
  mode: 'numbered',
  showSummary: true,
  showFirstLast: true,
  siblingCount: 1,
  pageJump: false,
  state: 'default',
  navButtonLabelMode: 'icon',
};

export const DEFAULT_TREEGRID_PAGING_DEMO_CONFIG: BaseComponentsGridPagingConfig = {
  ...DEFAULT_GRID_PAGING_DEMO_CONFIG,
  enabled: false,
};

export const BASE_COMPONENTS_GRID_PAGING_PAGE_SIZES = [10, 25, 50, 100] as const;

export function resolvePagingControlVisibility(mode: BaseComponentsGridPagingMode) {
  return {
    listMode: mode === 'numbered' || mode === 'prev-next',
    siblingPages: mode === 'numbered',
    firstLast: mode === 'numbered',
    pageJump: mode === 'numbered',
    pageNumbers: mode === 'numbered',
  };
}

export function resolveGridPagingProductionProps(
  config: Pick<
    BaseComponentsGridPagingConfig,
    'mode' | 'showSummary' | 'showFirstLast' | 'showSortControls' | 'pageJump'
  >,
  localListMode: GridListMode,
  viewport: Extract<ViewportTier, 'phone' | 'tablet' | 'desktop'>,
) {
  const forceInfinite = config.mode === 'load-more' || config.mode === 'cursor';
  return {
    listMode: forceInfinite ? 'infinite' as const : localListMode,
    showSummary: config.showSummary,
    showFirstLast: config.showFirstLast && config.mode === 'numbered',
    showPageNumbers: config.mode === 'numbered',
    showSortControls: config.showSortControls,
    responsiveMode: viewport,
    showPageJump: config.pageJump && config.mode === 'numbered',
    trailingAction: config.mode === 'cursor'
      ? 'cursor' as const
      : config.mode === 'load-more'
        ? 'load-more' as const
        : 'none' as const,
  };
}

function pagingViewport(tier: ViewportTier): Extract<ViewportTier, 'phone' | 'tablet' | 'desktop'> {
  return tier === 'phone' || tier === 'tablet' ? tier : 'desktop';
}

type PagingSortKey = 'name' | 'updated';

const PAGING_SORT_OPTIONS = [
  { value: 'name' as const, label: 'Name' },
  { value: 'updated' as const, label: 'Updated' },
];

export function useBaseComponentsGridPagingDemo(
  paging: BaseComponentsGridPagingConfig,
  totalCount: number,
  viewportTier: ViewportTier,
  options?: { chrome?: 'page' | 'hero' },
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paging.pageSize);
  const [sortBy, setSortBy] = useState<PagingSortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleInfiniteCount, setVisibleInfiniteCount] = useState(Math.min(paging.pageSize, totalCount));
  const [listMode, setListMode] = useState<GridListMode>(paging.listMode);

  useEffect(() => {
    setPageSize(paging.pageSize);
  }, [paging.pageSize]);
  useEffect(() => {
    setListMode(paging.listMode);
  }, [paging.listMode]);
  useEffect(() => {
    if (paging.state === 'first' || paging.state === 'default') setPage(1);
    if (paging.state === 'last') setPage(Math.max(1, Math.ceil(totalCount / pageSize)));
  }, [paging.state, totalCount, pageSize]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const safePage = Math.min(page, totalPages);
  const startPage = Math.max(1, safePage - paging.siblingCount);
  const pageNumbers = Array.from(
    { length: Math.min(totalPages - startPage + 1, (paging.siblingCount * 2) + 1) },
    (_, index) => startPage + index,
  );
  const productionProps = resolveGridPagingProductionProps(
    paging,
    listMode,
    pagingViewport(viewportTier),
  );

  const sliceRows = useMemo(() => {
    return <T,>(rows: readonly T[]): T[] => {
      if (!paging.enabled) return [...rows];
      if (productionProps.listMode === 'infinite') {
        return rows.slice(0, Math.max(1, visibleInfiniteCount));
      }
      const start = (safePage - 1) * pageSize;
      return rows.slice(start, start + pageSize);
    };
  }, [paging.enabled, productionProps.listMode, visibleInfiniteCount, safePage, pageSize]);

  const footer = !paging.enabled ? undefined : (
    <GridPagingFooter
      chrome={options?.chrome}
      totalCount={paging.showSummary ? totalCount : 0}
      safePage={safePage}
      pageSize={pageSize}
      pageSizes={[...BASE_COMPONENTS_GRID_PAGING_PAGE_SIZES]}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
      sortBy={sortBy}
      sortOptions={PAGING_SORT_OPTIONS}
      onSortByChange={(value) => {
        if (value === 'name' || value === 'updated') setSortBy(value);
      }}
      sortDirection={sortDirection}
      onToggleSortDirection={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
      totalPages={totalPages}
      pageNumbers={pageNumbers}
      onPageChange={setPage}
      listMode={productionProps.listMode}
      onListModeChange={(mode) => {
        setListMode(mode);
        if (mode === 'infinite') {
          setVisibleInfiniteCount(Math.min(pageSize, totalCount));
        }
      }}
      visibleInfiniteCount={visibleInfiniteCount}
      showSortControls={productionProps.showSortControls}
      showSummary={productionProps.showSummary}
      showFirstLast={productionProps.showFirstLast}
      showPageNumbers={productionProps.showPageNumbers}
      responsiveMode={productionProps.responsiveMode}
      navButtonLabelMode={paging.navButtonLabelMode}
      trailing={(
        <>
          {productionProps.showPageJump ? (
            <UiSelect
              size="sm"
              value={String(safePage)}
              onChange={(event) => setPage(Number(event.target.value))}
              ariaLabel="Jump to page"
            >
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <option key={pageNumber} value={pageNumber}>Page {pageNumber}</option>
              ))}
            </UiSelect>
          ) : null}
          {paging.state === 'loading' ? (
            <span className="inline-flex items-center gap-1 text-xs text-cyan-700" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading
            </span>
          ) : productionProps.trailingAction !== 'none' ? (
            <AppButton
              size="sm"
              intent="utility"
              onClick={() => setVisibleInfiniteCount((count) => Math.min(totalCount, count + pageSize))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              {productionProps.trailingAction === 'cursor' ? 'Next cursor' : 'Load more'}
            </AppButton>
          ) : null}
        </>
      )}
    />
  );

  return { footer, sliceRows };
}

type BaseComponentsGridPagingFieldsProps = {
  config: BaseComponentsGridPagingConfig;
  onChange: (patch: Partial<BaseComponentsGridPagingConfig>) => void;
};

export const BaseComponentsGridPagingFields: React.FC<BaseComponentsGridPagingFieldsProps> = ({
  config,
  onChange,
}) => {
  const visibleControls = resolvePagingControlVisibility(config.mode);

  return (
    <FormSection title="Paging" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
      <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
        <FormField label="Paging" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
          <UiSelect
            size="sm"
            className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
            value={config.enabled ? 'yes' : 'no'}
            onChange={(event) => onChange({ enabled: event.target.value === 'yes' })}
            ariaLabel="Paging"
          >
            <option value="yes">on</option>
            <option value="no">off</option>
          </UiSelect>
        </FormField>
        {config.enabled ? (
          <>
            <FormField label="Paging pattern" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={config.mode}
                onChange={(event) => onChange({
                  mode: event.target.value as BaseComponentsGridPagingMode,
                })}
                ariaLabel="Paging pattern"
              >
                <option value="numbered">numbered</option>
                <option value="prev-next">previous / next</option>
                <option value="cursor">cursor</option>
                <option value="load-more">load more</option>
              </UiSelect>
            </FormField>
            {visibleControls.listMode ? (
              <FormField label="List mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.listMode}
                  onChange={(event) => {
                    const value = event.target.value as GridListMode;
                    if (value === 'paging' || value === 'infinite') {
                      onChange({ listMode: value });
                    }
                  }}
                  ariaLabel="List mode"
                >
                  <option value="paging">paging</option>
                  <option value="infinite">infinite</option>
                </UiSelect>
              </FormField>
            ) : null}
            <FormField label="Page size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={String(config.pageSize)}
                onChange={(event) => onChange({ pageSize: Number(event.target.value) })}
                ariaLabel="Page size"
              >
                {BASE_COMPONENTS_GRID_PAGING_PAGE_SIZES.map((size) => (
                  <option key={size} value={String(size)}>{size}</option>
                ))}
              </UiSelect>
            </FormField>
            <FormField label="Sort controls" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={config.showSortControls ? 'yes' : 'no'}
                onChange={(event) => onChange({ showSortControls: event.target.value === 'yes' })}
                ariaLabel="Sort controls"
              >
                <option value="yes">show</option>
                <option value="no">hide</option>
              </UiSelect>
            </FormField>
            {visibleControls.siblingPages ? (
              <FormField label="Sibling pages" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={String(config.siblingCount)}
                  onChange={(event) => onChange({
                    siblingCount: Number(event.target.value) as 0 | 1 | 2,
                  })}
                  ariaLabel="Paging sibling count"
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </UiSelect>
              </FormField>
            ) : null}
            <FormField label="Summary" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={config.showSummary ? 'yes' : 'no'}
                onChange={(event) => onChange({ showSummary: event.target.value === 'yes' })}
                ariaLabel="Paging result summary"
              >
                <option value="yes">show</option>
                <option value="no">hide</option>
              </UiSelect>
            </FormField>
            <FormField label="Nav buttons" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={config.navButtonLabelMode}
                onChange={(event) => {
                  const value = event.target.value as GridPagingNavButtonLabelMode;
                  if (value === 'icon' || value === 'iconAndLabel') {
                    onChange({ navButtonLabelMode: value });
                  }
                }}
                ariaLabel="Paging navigation button labels"
              >
                <option value="icon">icon only</option>
                <option value="iconAndLabel">icon + label</option>
              </UiSelect>
            </FormField>
            {visibleControls.firstLast ? (
              <FormField label="First / last" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.showFirstLast ? 'yes' : 'no'}
                  onChange={(event) => onChange({ showFirstLast: event.target.value === 'yes' })}
                  ariaLabel="Paging first and last actions"
                >
                  <option value="yes">show</option>
                  <option value="no">hide</option>
                </UiSelect>
              </FormField>
            ) : null}
            {visibleControls.pageJump ? (
              <FormField label="Page jump" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  value={config.pageJump ? 'yes' : 'no'}
                  onChange={(event) => onChange({ pageJump: event.target.value === 'yes' })}
                  ariaLabel="Paging page jump"
                >
                  <option value="yes">show</option>
                  <option value="no">hide</option>
                </UiSelect>
              </FormField>
            ) : null}
            <FormField label="Paging state" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
              <UiSelect
                size="sm"
                className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                value={config.state}
                onChange={(event) => onChange({
                  state: event.target.value as BaseComponentsGridPagingState,
                })}
                ariaLabel="Paging state"
              >
                <option value="default">default</option>
                <option value="loading">loading</option>
                <option value="first">first page</option>
                <option value="last">last page</option>
              </UiSelect>
            </FormField>
          </>
        ) : null}
      </div>
    </FormSection>
  );
};
markBaseComponentsConfigSectionSource(BaseComponentsGridPagingFields);
