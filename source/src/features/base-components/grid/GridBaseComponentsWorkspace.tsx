import React, { useMemo, useState } from 'react';
import {
  AppTableGrid,
  APP_TABLE_GRID_BORDER_WIDTH_OPTIONS,
  APP_TABLE_GRID_CELL_PADDING_X_OPTIONS,
  APP_TABLE_GRID_MARGIN_OPTIONS,
  DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX,
  DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX,
  DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX,
  DEFAULT_APP_TABLE_GRID_MARGIN_PX,
  FormField,
  FormSection,
  UiSelect,
  resolveGridPagingFooterChrome,
  type AppTableGridChrome,
  type AppTableGridHeaderQueryControlsVisibility,
  type AppTableGridScrollOwner,
  type AppTableGridSize,
  type AppTableGridColumnTextDirection,
  APP_TABLE_GRID_COLUMN_TEXT_DIRECTIONS,
  isAppTableGridColumnTextDirection,
} from '../../../shared/ui';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_HERO_BODY_CELL_CLASS,
  APP_TABLE_GRID_HERO_HEADER_CELL_CLASS,
  APP_TABLE_GRID_ROW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { renderBooleanIcon } from '../../../shared/lib/gridCellRenderers';
import { useGridQueryState } from '../../../shared/lib/useGridQueryState';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsCategoryBadge } from '../baseComponentsPreviewBadges';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';
import {
  DEFAULT_GRID_CARD_BELOW,
  resolveGridEffectivePresentation,
  type GridCardBelowTier,
  type GridEffectivePresentation,
  type GridPresentationMode,
} from '../../../shared/lib/appTableGridPresentation';
import {
  parseGridCompactFromProps,
  type GridCompactCardsPerRow,
  type GridCompactViewportConfig,
} from '../../../shared/lib/gridCompactViewport';
import type { ViewportTier } from '../../../shared/lib/viewportTokens';
import { DemoGridRowActions, demoGridActionsColumnWidth, DEMO_GRID_ROW_ACTIONS } from '../demoGridRowActions';
import { useBaseComponentsPreviewViewport } from '../components/BaseComponentsPreviewViewport';
import {
  BaseComponentsGridHeightField,
  BaseComponentsGridPresentationFields,
  BaseComponentsGridRowActionsFields,
  type CompactInheritLayout,
  type CompactTriState,
} from '../components/BaseComponentsGridPresentationFields';
import {
  BaseComponentsGridPagingFields,
  DEFAULT_GRID_PAGING_DEMO_CONFIG,
  useBaseComponentsGridPagingDemo,
  type BaseComponentsGridPagingConfig,
} from '../components/BaseComponentsGridPagingFields';

type GridMode = 'composed' | 'column';
type DisplayState = 'data' | 'loading' | 'empty' | 'error';
type GridPreset = 'read-only' | 'sortable' | 'selectable';
type GridSelection = 'none' | 'single' | 'multiple';

type BaseComponentsGridRow = {
  id: string;
  thumbnailUrl: string;
  name: string;
  active: boolean;
  category: string;
  owner: string;
  updatedAt: string;
};

export type GridBaseComponentsConfig = {
  size: AppTableGridSize;
  mode: GridMode;
  rowCount: number;
  displayState: DisplayState;
  enableSort: boolean;
  enableFilter: boolean;
  headerQueryControlsVisibility: AppTableGridHeaderQueryControlsVisibility;
  enableColumnLayout: boolean;
  preset: GridPreset;
  selection: GridSelection;
  presentation: GridPresentationMode;
  cardBelow: GridCardBelowTier;
  stickyHeader: boolean;
  viewport: 'desktop' | 'tablet' | 'phone';
  compactPhoneLayout: CompactInheritLayout;
  compactTabletLayout: CompactInheritLayout;
  compactTabletCardsPerRow: GridCompactCardsPerRow;
  compactFreezeFirstColumn: CompactTriState;
  compactCollapseExtraFields: boolean;
  compactVisibleFieldCount: number;
  compactShowActions: boolean;
  compactShowMeta: boolean;
  rowActions: boolean;
  maxVisibleActions: number;
  fillHeight: boolean;
  chrome: AppTableGridChrome;
  scrollOwner: AppTableGridScrollOwner;
  margin: number;
  borderWidth: number;
  cellPaddingX: number;
  demoColumnTextDirection: AppTableGridColumnTextDirection;
  /** 0 = unset; applies `minWidth` on the Name column (flex width). */
  demoNameColumnMinWidth: number;
  paging: BaseComponentsGridPagingConfig;
};

const CATEGORIES = ['Core', 'Integration', 'Reporting'] as const;

export const DEFAULT_GRID_BASE_COMPONENTS_CONFIG: GridBaseComponentsConfig = {
  size: 'sm',
  mode: 'column',
  rowCount: 12,
  displayState: 'data',
  enableSort: true,
  enableFilter: true,
  headerQueryControlsVisibility: 'hover',
  enableColumnLayout: true,
  preset: 'sortable',
  selection: 'none',
  presentation: 'auto',
  cardBelow: 'tablet',
  stickyHeader: true,
  viewport: 'desktop',
  compactPhoneLayout: 'inherit',
  compactTabletLayout: 'inherit',
  compactTabletCardsPerRow: 2,
  compactFreezeFirstColumn: 'inherit',
  compactCollapseExtraFields: false,
  compactVisibleFieldCount: 3,
  compactShowActions: true,
  compactShowMeta: true,
  rowActions: true,
  maxVisibleActions: 3,
  fillHeight: true,
  chrome: 'classic',
  scrollOwner: 'self',
  margin: DEFAULT_APP_TABLE_GRID_MARGIN_PX,
  borderWidth: DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  cellPaddingX: DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX,
  demoColumnTextDirection: 'culture',
  demoNameColumnMinWidth: 0,
  paging: DEFAULT_GRID_PAGING_DEMO_CONFIG,
};

export function resolveGridPreviewPresentation(
  presentation: GridPresentationMode,
  viewport: GridBaseComponentsConfig['viewport'],
  cardBelow: GridCardBelowTier = DEFAULT_GRID_CARD_BELOW,
): GridEffectivePresentation {
  return resolveGridEffectivePresentation(presentation, viewport, cardBelow);
}

export function applyGridMode(
  current: GridBaseComponentsConfig,
  mode: GridMode,
): GridBaseComponentsConfig {
  return {
    ...current,
    mode,
    selection: mode === 'composed' ? 'none' : current.selection,
    presentation: mode === 'composed' ? 'table' : current.presentation,
  };
}

export function applyGridPreset(
  current: GridBaseComponentsConfig,
  preset: GridPreset,
): GridBaseComponentsConfig {
  return {
    ...current,
    preset,
    enableSort: preset !== 'read-only',
    selection: preset === 'selectable' ? 'multiple' : 'none',
    enableColumnLayout: preset === 'sortable',
  };
}

export function applyGridChrome(
  current: GridBaseComponentsConfig,
  chrome: AppTableGridChrome,
): GridBaseComponentsConfig {
  const isHero = chrome === 'hero';
  return {
    ...current,
    chrome,
    margin: isHero ? DEFAULT_APP_TABLE_GRID_HERO_MARGIN_PX : DEFAULT_APP_TABLE_GRID_MARGIN_PX,
    borderWidth: isHero ? DEFAULT_APP_TABLE_GRID_HERO_BORDER_WIDTH_PX : DEFAULT_APP_TABLE_GRID_BORDER_WIDTH_PX,
  };
}

export function resolveGridControlVisibility(config: Pick<GridBaseComponentsConfig, 'mode' | 'presentation'>) {
  return {
    selection: config.mode === 'column',
    presentation: config.mode === 'column',
    compact: config.mode === 'column',
    columnQuery: config.mode === 'column',
  };
}

export function resolveGridPreviewFillProps(fillHeight: boolean) {
  return {
    fillHeight,
    scrollClassName: fillHeight ? 'max-h-full' : undefined,
    previewHostClassName: fillHeight ? 'flex h-full min-h-0 flex-1 flex-col' : 'min-h-0',
  };
}

export function buildGridCompactFromDemoConfig(
  config: Pick<
    GridBaseComponentsConfig,
    | 'compactPhoneLayout'
    | 'compactTabletLayout'
    | 'compactTabletCardsPerRow'
    | 'compactFreezeFirstColumn'
    | 'compactCollapseExtraFields'
    | 'compactVisibleFieldCount'
    | 'compactShowActions'
    | 'compactShowMeta'
  >,
): GridCompactViewportConfig | undefined {
  return parseGridCompactFromProps({
    compactPhoneLayout: config.compactPhoneLayout,
    compactTabletLayout: config.compactTabletLayout,
    compactTabletCardsPerRow: config.compactTabletCardsPerRow,
    compactFreezeFirstColumn: config.compactFreezeFirstColumn,
    compactCollapseExtraFields: config.compactCollapseExtraFields ? 'on' : 'inherit',
    compactVisibleFieldCount: config.compactCollapseExtraFields ? config.compactVisibleFieldCount : 'inherit',
    compactShowActions: config.compactShowActions ? 'inherit' : 'off',
    compactShowMeta: config.compactShowMeta ? 'inherit' : 'off',
  });
}

function buildSampleRows(count: number): BaseComponentsGridRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    thumbnailUrl: `https://picsum.photos/seed/grid-demo-${index + 1}/160/160`,
    name: `BaseComponents item ${index + 1}`,
    active: index % 3 !== 1,
    category: CATEGORIES[index % CATEGORIES.length],
    owner: `Owner ${(index % 4) + 1}`,
    updatedAt: `2026-0${(index % 9) + 1}-15`,
  }));
}

function createColumnDefs(config: GridBaseComponentsConfig): AppTableGridColumnDef<BaseComponentsGridRow>[] {
  return [
    {
      id: 'thumbnail',
      label: 'Image',
      width: 72,
      cellClassName: 'text-center',
      headerClassName: 'text-center',
      sort: false,
      filter: false,
      card: { role: 'media' },
      renderCell: (row) => (
        <span className="mx-auto flex h-8 w-8 items-center justify-center">
          <img
            src={row.thumbnailUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-md object-cover"
          />
        </span>
      ),
    },
    {
      id: 'name',
      label: 'Name',
      ...(config.demoNameColumnMinWidth > 0 ? { minWidth: config.demoNameColumnMinWidth } : {}),
      textDirection: config.demoColumnTextDirection,
      sort: config.enableSort ? {} : false,
      filter: config.enableFilter ? { type: 'text' } : false,
      getSortValue: (row) => row.name,
      getFilterValue: (row) => row.name,
      card: { role: 'title' },
      renderCell: (row) => (
        <span className={cn(
          'text-sm text-slate-800',
          config.chrome === 'hero' ? 'font-semibold' : 'font-medium',
        )}>
          {row.name}
        </span>
      ),
    },
    {
      id: 'category',
      label: 'Category',
      width: 120,
      sort: config.enableSort ? {} : false,
      filter: config.enableFilter
        ? { type: 'select', options: CATEGORIES.map((value) => ({ value, label: value })) }
        : false,
      getSortValue: (row) => row.category,
      getFilterValue: (row) => row.category,
      card: { role: 'field', label: 'Category' },
      renderCell: (row) => <BaseComponentsCategoryBadge category={row.category} />,
    },
    {
      id: 'active',
      label: 'Active',
      width: 72,
      cellClassName: 'text-center',
      headerClassName: 'text-center',
      sort: config.enableSort ? {} : false,
      filter: config.enableFilter ? { type: 'boolean' } : false,
      getSortValue: (row) => row.active,
      getFilterValue: (row) => row.active,
      card: { role: 'field', label: 'Active' },
      renderCell: (row) => renderBooleanIcon(row.active),
    },
    {
      id: 'owner',
      label: 'Owner',
      width: 100,
      sort: config.enableSort ? {} : false,
      filter: config.enableFilter ? { type: 'text' } : false,
      getSortValue: (row) => row.owner,
      getFilterValue: (row) => row.owner,
      card: { role: 'field', label: 'Owner' },
      hideBelow: 'md',
      renderCell: (row) => <span className="text-slate-600">{row.owner}</span>,
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      width: 108,
      sort: config.enableSort ? {} : false,
      filter: config.enableFilter ? { type: 'dateRange' } : false,
      getSortValue: (row) => row.updatedAt,
      getFilterValue: (row) => row.updatedAt,
      card: { role: 'meta', label: 'Updated' },
      hideBelow: 'lg',
      renderCell: (row) => <span className="font-mono text-[11px] text-slate-500">{row.updatedAt}</span>,
    },
    ...(config.rowActions ? [{
      id: 'actions',
      label: '',
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
      width: demoGridActionsColumnWidth(config.maxVisibleActions),
      sort: false as const,
      filter: false as const,
      layout: { hideable: false, resizable: false, reorderable: false },
      card: { role: 'actions' as const },
      renderCell: () => <DemoGridRowActions maxVisible={config.maxVisibleActions} />,
    }] : []),
  ];
}

const GridBaseComponentsPreview: React.FC<{
  config: GridBaseComponentsConfig;
  viewportTier: ViewportTier;
}> = ({ config, viewportTier }) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const rows = useMemo(() => buildSampleRows(config.rowCount), [config.rowCount]);
  const columns = useMemo(() => createColumnDefs(config), [config]);
  const gridQuery = useGridQueryState({ columns, gridQueryMode: 'client' });

  const isLoading = config.displayState === 'loading';
  const isEmpty = config.displayState === 'empty';
  const isError = config.displayState === 'error';

  const compact = useMemo(() => buildGridCompactFromDemoConfig(config), [config]);
  const pagingDemo = useBaseComponentsGridPagingDemo(
    config.paging,
    rows.length,
    viewportTier,
    { chrome: resolveGridPagingFooterChrome(config.chrome) },
  );
  const displayRows = pagingDemo.sliceRows(rows);
  const fillProps = resolveGridPreviewFillProps(config.fillHeight);
  const isHeroChrome = config.chrome === 'hero';
  const headerCellClass = isHeroChrome ? APP_TABLE_GRID_HERO_HEADER_CELL_CLASS : APP_TABLE_GRID_HEADER_CELL_CLASS;
  const bodyCellClass = isHeroChrome ? APP_TABLE_GRID_HERO_BODY_CELL_CLASS : APP_TABLE_GRID_CELL_PR_CLASS;

  if (config.mode === 'composed') {
    return (
      <AppTableGrid
        size={config.size}
        chrome={config.chrome}
        stickyHeader={config.stickyHeader}
        fillHeight={fillProps.fillHeight}
        scrollClassName={fillProps.scrollClassName}
        margin={config.margin}
        borderWidth={config.borderWidth}
        cellPaddingX={config.cellPaddingX}
        isLoading={isLoading}
        loadingMessage="Loading baseComponents rows…"
        isEmpty={isEmpty}
        emptyMessage="No rows to display."
        errorContent={isError ? <div className="p-4 text-sm text-rose-700">Failed to load baseComponents rows.</div> : undefined}
        footer={pagingDemo.footer}
        header={(
          <tr>
            <th className={headerCellClass}>Name</th>
            <th className={cn(headerCellClass, 'w-[7.5rem]')}>Category</th>
            <th className={cn(headerCellClass, 'w-[4.5rem] text-center')}>Active</th>
            <th className={cn(headerCellClass, 'w-[6.75rem]')}>Updated</th>
          </tr>
        )}
      >
        {displayRows.map((row) => (
          <tr key={row.id} className={cn(APP_TABLE_GRID_ROW_CLASS, 'hover:bg-slate-50/80')}>
            <td className={bodyCellClass}>
              <span className={cn('text-sm text-slate-800', isHeroChrome ? 'font-semibold' : 'font-medium')}>{row.name}</span>
            </td>
            <td className={bodyCellClass}>
              <BaseComponentsCategoryBadge category={row.category} />
            </td>
            <td className={cn(bodyCellClass, 'text-center')}>
              {renderBooleanIcon(row.active)}
            </td>
            <td className={bodyCellClass}>
              <span className="font-mono text-[11px] text-slate-500">{row.updatedAt}</span>
            </td>
          </tr>
        ))}
      </AppTableGrid>
    );
  }

  return (
    <AppTableGrid
      size={config.size}
      chrome={config.chrome}
      fillHeight={fillProps.fillHeight}
      scrollClassName={fillProps.scrollClassName}
      margin={config.margin}
      borderWidth={config.borderWidth}
      cellPaddingX={config.cellPaddingX}
      columns={columns}
      rows={displayRows}
      getRowKey={(row) => row.id}
      query={gridQuery.query}
      onQueryChange={gridQuery.handleGridQueryChange}
      headerQueryControlsVisibility={config.headerQueryControlsVisibility}
      enableColumnLayout={config.enableColumnLayout}
      persistListKey={APP_LIST_PREFERENCE_KEYS.baseComponentsGrid}
      selectionMode={config.selection}
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
      presentation={config.presentation}
      cardBelow={config.cardBelow}
      getCardRowActions={config.rowActions ? () => DEMO_GRID_ROW_ACTIONS : undefined}
      cardActionsMaxVisible={config.maxVisibleActions}
      viewportTier={viewportTier}
      compact={compact}
      stickyHeader={config.stickyHeader}
      footer={pagingDemo.footer}
      isLoading={isLoading}
      loadingMessage="Loading baseComponents rows…"
      isEmpty={isEmpty}
      emptyMessage="No rows to display."
      errorContent={isError ? <div className="p-4 text-sm text-rose-700">Failed to load baseComponents rows.</div> : undefined}
    />
  );
};

export const GridBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<GridBaseComponentsConfig>(DEFAULT_GRID_BASE_COMPONENTS_CONFIG);
  const visibleControls = resolveGridControlVisibility(config);
  const previewViewport = useBaseComponentsPreviewViewport();
  const configJson = useMemo(() => JSON.stringify({
    public: {
      size: config.size,
      chrome: config.chrome,
      selectionMode: config.selection,
      stickyHeader: config.stickyHeader,
      fillHeight: config.fillHeight,
      headerQueryControlsVisibility: config.headerQueryControlsVisibility,
    },
    composition: {
      preset: config.preset,
      features: [
        config.enableSort && 'sort',
        config.enableFilter && 'filter',
        'resize',
        config.enableColumnLayout && 'reorder/pin/show-hide',
      ].filter(Boolean),
      presentation: config.presentation,
      cardBelow: config.cardBelow,
      compact: {
        phoneLayout: config.compactPhoneLayout,
        tabletLayout: config.compactTabletLayout,
        tabletCardsPerRow: config.compactTabletCardsPerRow,
      },
      paging: config.paging.enabled
        ? { mode: config.paging.mode, pageSize: config.paging.pageSize, listMode: config.paging.listMode }
        : false,
    },
    demo: {
      fixtures: { rowCount: config.rowCount, columns: 'standard-columns' },
      scenarios: { state: config.displayState, viewport: previewViewport, mode: config.mode },
    },
  }, null, 2), [config, previewViewport]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="grid" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_GRID_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.preset}
                    onChange={(event) => {
                      const preset = event.target.value as GridPreset;
                      setConfig((current) => applyGridPreset(current, preset));
                    }}
                    ariaLabel="Grid preset"
                  >
                    {(['read-only', 'sortable', 'selectable'] as const).map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => {
                      const value = event.target.value as AppTableGridSize;
                      if (value === 'xs' || value === 'sm') {
                        setConfig((current) => ({ ...current, size: value }));
                      }
                    }}
                    ariaLabel="Grid size"
                  >
                    <option value="xs">xs</option>
                    <option value="sm">sm</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsGridHeightField
                  fillHeight={config.fillHeight}
                  onChange={(fillHeight) => setConfig((current) => ({ ...current, fillHeight }))}
                  ariaLabel="Grid height"
                />

                <FormField label="Chrome" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.chrome}
                    onChange={(event) => {
                      const chrome = event.target.value as AppTableGridChrome;
                      if (chrome === 'classic' || chrome === 'hero') {
                        setConfig((current) => applyGridChrome(current, chrome));
                      }
                    }}
                    ariaLabel="Grid chrome"
                  >
                    <option value="classic">classic</option>
                    <option value="hero">hero</option>
                  </UiSelect>
                </FormField>
                <FormField label="Name min width" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.demoNameColumnMinWidth)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isNaN(next)) {
                        setConfig((current) => ({ ...current, demoNameColumnMinWidth: next }));
                      }
                    }}
                    ariaLabel="Name column minimum width"
                  >
                    <option value="0">unset</option>
                    <option value="96">96</option>
                    <option value="120">120</option>
                    <option value="160">160</option>
                    <option value="240">240</option>
                  </UiSelect>
                </FormField>

                <FormField label="Cell padding" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.cellPaddingX)}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isNaN(next)) {
                        setConfig((current) => ({ ...current, cellPaddingX: next }));
                      }
                    }}
                    ariaLabel="Grid cell padding"
                  >
                    {[...APP_TABLE_GRID_CELL_PADDING_X_OPTIONS].map((px) => (
                      <option key={px} value={String(px)}>{px}px</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField
                  label="Column text direction"
                  hint="Applies to the Name column in this sample."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  reserveHintSlot={false}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.demoColumnTextDirection}
                    onChange={(event) => {
                      if (isAppTableGridColumnTextDirection(event.target.value)) {
                        setConfig((current) => ({
                          ...current,
                          demoColumnTextDirection: event.target.value,
                        }));
                      }
                    }}
                    ariaLabel="Grid column text direction"
                  >
                    {APP_TABLE_GRID_COLUMN_TEXT_DIRECTIONS.map((direction) => (
                      <option key={direction} value={direction}>{direction}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {config.chrome === 'hero' ? (
                  <>
                    <FormField label="Margin" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={String(config.margin)}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (!Number.isNaN(next)) {
                            setConfig((current) => ({ ...current, margin: next }));
                          }
                        }}
                        ariaLabel="Grid margin"
                      >
                        {[...APP_TABLE_GRID_MARGIN_OPTIONS].map((px) => (
                          <option key={px} value={String(px)}>{px}px</option>
                        ))}
                      </UiSelect>
                    </FormField>
                    <FormField label="Border" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={String(config.borderWidth)}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (!Number.isNaN(next)) {
                            setConfig((current) => ({ ...current, borderWidth: next }));
                          }
                        }}
                        ariaLabel="Grid border width"
                      >
                        {[...APP_TABLE_GRID_BORDER_WIDTH_OPTIONS].map((px) => (
                          <option key={px} value={String(px)}>{px}px</option>
                        ))}
                      </UiSelect>
                    </FormField>
                  </>
                ) : null}

                <FormField label="Mode" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.mode}
                    onChange={(event) => {
                      const mode = event.target.value as GridMode;
                      if (mode === 'composed' || mode === 'column') {
                        setConfig((current) => applyGridMode(current, mode));
                      }
                    }}
                    ariaLabel="Grid mode"
                  >
                    <option value="column">column</option>
                    <option value="composed">composed</option>
                  </UiSelect>
                </FormField>

                <FormField label="Rows" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.rowCount)}
                    onChange={(event) => {
                      const count = Number(event.target.value);
                      if (!Number.isNaN(count)) {
                        setConfig((current) => ({ ...current, rowCount: count }));
                      }
                    }}
                    ariaLabel="Row count"
                  >
                    {[4, 8, 12, 16, 20, 24, 100].map((count) => (
                      <option key={count} value={String(count)}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.displayState}
                    onChange={(event) => {
                      const state = event.target.value as DisplayState;
                      if (state === 'data' || state === 'loading' || state === 'empty' || state === 'error') {
                        setConfig((current) => ({ ...current, displayState: state }));
                      }
                    }}
                    ariaLabel="Display state"
                  >
                    <option value="data">data</option>
                    <option value="loading">loading</option>
                    <option value="empty">empty</option>
                    <option value="error">error</option>
                  </UiSelect>
                </FormField>
                <FormField label="Sticky header" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.stickyHeader ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, stickyHeader: event.target.value === 'yes' }))}
                    ariaLabel="Grid sticky header">
                    <option value="yes">on</option><option value="no">off</option>
                  </UiSelect>
                </FormField>
                {visibleControls.selection ? <FormField label="Selection" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.selection}
                    onChange={(event) => setConfig((current) => ({ ...current, selection: event.target.value as GridSelection }))}
                    ariaLabel="Selection"
                  >
                    <option value="none">none</option>
                    <option value="single">single</option>
                    <option value="multiple">multiple</option>
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>

            <BaseComponentsGridPresentationFields
              config={config}
              onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
              showPresentation={visibleControls.presentation}
              showCompact={visibleControls.compact}
            />

            {visibleControls.columnQuery ? (
              <FormSection title="Column query" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
                <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                  <FormField label="Sort" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.enableSort ? 'yes' : 'no'}
                      onChange={(event) => {
                        setConfig((current) => ({
                          ...current,
                          enableSort: event.target.value === 'yes',
                        }));
                      }}
                      ariaLabel="Enable sort"
                    >
                      <option value="yes">on</option>
                      <option value="no">off</option>
                    </UiSelect>
                  </FormField>

                  <FormField label="Filter" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.enableFilter ? 'yes' : 'no'}
                      onChange={(event) => {
                        setConfig((current) => ({
                          ...current,
                          enableFilter: event.target.value === 'yes',
                        }));
                      }}
                      ariaLabel="Enable filter"
                    >
                      <option value="yes">on</option>
                      <option value="no">off</option>
                    </UiSelect>
                  </FormField>

                  {(config.enableSort || config.enableFilter) ? (
                    <FormField label="Header sort/filter" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.headerQueryControlsVisibility}
                        onChange={(event) => {
                          setConfig((current) => ({
                            ...current,
                            headerQueryControlsVisibility: event.target.value as AppTableGridHeaderQueryControlsVisibility,
                          }));
                        }}
                        ariaLabel="Header sort and filter visibility"
                      >
                        <option value="hover">hover overlay</option>
                        <option value="always">always in header</option>
                      </UiSelect>
                    </FormField>
                  ) : null}

                  <FormField label="Layout" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.enableColumnLayout ? 'yes' : 'no'}
                      onChange={(event) => {
                        setConfig((current) => ({
                          ...current,
                          enableColumnLayout: event.target.value === 'yes',
                        }));
                      }}
                      ariaLabel="Column layout control"
                    >
                      <option value="yes">show</option>
                      <option value="no">hide</option>
                    </UiSelect>
                  </FormField>
                  <BaseComponentsGridRowActionsFields
                    config={config}
                    onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
                  />
                </div>
              </FormSection>
            ) : null}

            <BaseComponentsGridPagingFields
              config={config.paging}
              onChange={(patch) => setConfig((current) => ({
                ...current,
                paging: { ...current.paging, ...patch },
              }))}
            />
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="grid" fill={config.fillHeight}>
          <div className={resolveGridPreviewFillProps(config.fillHeight).previewHostClassName}>
            <GridBaseComponentsPreview config={config} viewportTier={previewViewport} />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
