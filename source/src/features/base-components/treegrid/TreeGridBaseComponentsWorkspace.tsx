import React, { useCallback, useMemo, useState } from 'react';
import {
  FormField,
  FormSection,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { BaseTreeGrid, type BaseTreeGridRow } from '../../../components/ui/BaseTreeGrid';
import type { TreeDropPosition } from '../../../shared/types/tree';
import { DemoGridRowActions, demoGridActionsColumnWidth } from '../demoGridRowActions';
import { tierUsesCardLayout, type GridCardBelowTier, type GridPresentationMode } from '../../../shared/lib/appTableGridPresentation';
import type { ViewportTier } from '../../../shared/lib/viewportTokens';
import { renderBooleanIcon } from '../../../shared/lib/gridCellRenderers';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { useBaseComponentsPreviewViewport } from '../components/BaseComponentsPreviewViewport';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BaseComponentsGridHeightField,
  BaseComponentsGridPresentationFields,
  BaseComponentsGridRowActionsFields,
  type CompactActionsPlacement,
  type CompactInheritLabels,
  type CompactInheritLayout,
} from '../components/BaseComponentsGridPresentationFields';
import {
  BaseComponentsGridPagingFields,
  DEFAULT_TREEGRID_PAGING_DEMO_CONFIG,
  useBaseComponentsGridPagingDemo,
  type BaseComponentsGridPagingConfig,
} from '../components/BaseComponentsGridPagingFields';
import { BaseComponentsTreeKindBadge, BaseComponentsTreeRootAccent } from '../baseComponentsPreviewBadges';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';

type BaseComponentsTreeRow = BaseTreeGridRow & {
  label: string;
  kind: 'group' | 'item';
  active: boolean;
};

export type TreeGridBaseComponentsConfig = {
  showHeader: boolean;
  showIdColumn: boolean;
  hideExpandControls: boolean;
  moveDisabled: boolean;
  expandAllByDefault: boolean;
  branchCount: number;
  pattern: 'navigation-tree' | 'treegrid';
  selection: 'none' | 'single' | 'multiple';
  lazyLoad: boolean;
  showGuides: boolean;
  density: 'compact' | 'default';
  state: 'default' | 'branch-loading' | 'empty' | 'error';
  presentation: GridPresentationMode;
  cardBelow: GridCardBelowTier;
  compactPhoneLayout: CompactInheritLayout;
  compactTabletLayout: CompactInheritLayout;
  compactFieldLabels: CompactInheritLabels;
  compactCollapseExtraFields: boolean;
  compactVisibleFieldCount: number;
  compactShowActions: boolean;
  compactActionsPlacement: CompactActionsPlacement;
  rowActions: boolean;
  maxVisibleActions: number;
  fillHeight: boolean;
  stickyHeader: boolean;
  paging: BaseComponentsGridPagingConfig;
};

export const DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG: TreeGridBaseComponentsConfig = {
  showHeader: true,
  showIdColumn: false,
  hideExpandControls: false,
  moveDisabled: true,
  expandAllByDefault: true,
  branchCount: 3,
  pattern: 'treegrid',
  selection: 'none',
  lazyLoad: false,
  showGuides: true,
  density: 'default',
  state: 'default',
  presentation: 'auto',
  cardBelow: 'tablet',
  compactPhoneLayout: 'inherit',
  compactTabletLayout: 'inherit',
  compactFieldLabels: 'inherit',
  compactCollapseExtraFields: false,
  compactVisibleFieldCount: 3,
  compactShowActions: true,
  compactActionsPlacement: 'inherit',
  rowActions: true,
  maxVisibleActions: 3,
  fillHeight: true,
  stickyHeader: true,
  paging: DEFAULT_TREEGRID_PAGING_DEMO_CONFIG,
};

export function resolveTreePresentation(config: Pick<TreeGridBaseComponentsConfig, 'pattern' | 'presentation' | 'showHeader' | 'showIdColumn'>) {
  const navigationPattern = config.pattern === 'navigation-tree';
  return {
    layout: navigationPattern || config.presentation === 'cards' ? 'hybrid-stacked' as const : 'table' as const,
    showHeader: !navigationPattern && config.showHeader,
    showIdColumn: !navigationPattern && config.showIdColumn,
    showDataColumns: !navigationPattern,
  };
}

export function applyTreePattern(
  current: TreeGridBaseComponentsConfig,
  pattern: TreeGridBaseComponentsConfig['pattern'],
): TreeGridBaseComponentsConfig {
  return {
    ...current,
    pattern,
    moveDisabled: pattern === 'navigation-tree' ? true : current.moveDisabled,
  };
}

export function applyTreePresentation(
  current: TreeGridBaseComponentsConfig,
  presentation: GridPresentationMode,
): TreeGridBaseComponentsConfig {
  return {
    ...current,
    presentation,
    moveDisabled: presentation === 'cards' ? true : current.moveDisabled,
  };
}

/** Maps the former table / stacked toggle onto Presentation. */
export function applyTreeLayout(
  current: TreeGridBaseComponentsConfig,
  layout: 'table' | 'hybrid-stacked',
): TreeGridBaseComponentsConfig {
  return applyTreePresentation(current, layout === 'hybrid-stacked' ? 'cards' : 'table');
}

export function resolveTreePreviewLayout(
  config: Pick<TreeGridBaseComponentsConfig, 'pattern' | 'presentation' | 'cardBelow' | 'compactPhoneLayout' | 'compactTabletLayout'>,
  viewportTier: ViewportTier,
): 'table' | 'hybrid-stacked' {
  if (config.pattern === 'navigation-tree') return 'hybrid-stacked';

  const compactLayout = viewportTier === 'phone'
    ? config.compactPhoneLayout
    : viewportTier === 'tablet'
      ? config.compactTabletLayout
      : 'inherit';
  if (compactLayout === 'keep-table') return 'table';
  if (compactLayout === 'cards') return 'hybrid-stacked';

  if (config.presentation === 'cards') return 'hybrid-stacked';
  if (config.presentation === 'table' || config.presentation === 'table-scroll') return 'table';
  if (tierUsesCardLayout(viewportTier, config.cardBelow)) return 'hybrid-stacked';
  return 'table';
}

export function resolveTreeStackedFieldLabels(
  labels: CompactInheritLabels,
): 'inline' | 'stacked' | 'hidden' {
  return labels === 'inherit' ? 'inline' : labels;
}

export function resolveTreePreviewFillProps(fillHeight: boolean) {
  return {
    fillHeight,
    previewHostClassName: fillHeight ? 'flex h-full min-h-0 flex-1 flex-col' : 'min-h-0',
  };
}

export function resolveTreeStackedActionsPlacement(
  config: Pick<TreeGridBaseComponentsConfig, 'rowActions' | 'compactShowActions' | 'compactActionsPlacement'>,
): 'footer' | 'header' | 'none' {
  if (!config.rowActions || !config.compactShowActions) return 'none';
  if (config.compactActionsPlacement === 'inherit') return 'footer';
  return config.compactActionsPlacement;
}

export function resolveTreeStateView(state: TreeGridBaseComponentsConfig['state']) {
  return {
    showError: state === 'error',
    showEmpty: state === 'empty',
    loadingByParent: state === 'branch-loading' ? { 'root-0': true } : {},
  };
}

const ROOT_LABELS = ['Engineering', 'Sales', 'Operations', 'Support'] as const;

function buildTreeCatalog(branchCount: number): BaseComponentsTreeRow[] {
  const rows: BaseComponentsTreeRow[] = [];
  const roots = ROOT_LABELS.slice(0, branchCount);

  roots.forEach((rootLabel, rootIndex) => {
    const rootId = `root-${rootIndex}`;
    rows.push({
      id: rootId,
      parentId: null,
      depth: 0,
      hasChildren: true,
      label: rootLabel,
      kind: 'group',
      active: true,
    });

    ['Team A', 'Team B'].forEach((teamLabel, teamIndex) => {
      const teamId = `${rootId}-team-${teamIndex}`;
      rows.push({
        id: teamId,
        parentId: rootId,
        depth: 1,
        hasChildren: teamIndex === 0,
        label: `${rootLabel} ${teamLabel}`,
        kind: 'item',
        active: teamIndex === 0,
      });

      if (teamIndex === 0) {
        rows.push({
          id: `${teamId}-member`,
          parentId: teamId,
          depth: 2,
          hasChildren: false,
          label: `${teamLabel} lead`,
          kind: 'item',
          active: true,
        });
      }
    });
  });

  return rows;
}

function buildDefaultExpandedById(rows: BaseComponentsTreeRow[], expandAll: boolean): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  rows.forEach((row) => {
    if (row.hasChildren) {
      next[row.id] = expandAll;
    }
  });
  return next;
}

function buildVisibleTreeRows(rows: BaseComponentsTreeRow[], expandedById: Record<string, boolean>): BaseComponentsTreeRow[] {
  const visible: BaseComponentsTreeRow[] = [];

  const walk = (parentId: string | null) => {
    rows
      .filter((row) => row.parentId === parentId)
      .forEach((row) => {
        visible.push(row);
        if (row.hasChildren && (expandedById[row.id] ?? false)) {
          walk(row.id);
        }
      });
  };

  walk(null);
  return visible;
}

const TreeGridBaseComponentsPreview: React.FC<{
  config: TreeGridBaseComponentsConfig;
  viewportTier: ViewportTier;
  rows: BaseComponentsTreeRow[];
  expandedById: Record<string, boolean>;
  onToggleExpand: (row: BaseComponentsTreeRow) => void;
  onMove: (sourceId: string, targetId: string | null, position: TreeDropPosition) => Promise<void>;
  selectedIds: string[];
  onSelect: (row: BaseComponentsTreeRow) => void;
}> = ({ config, viewportTier, rows, expandedById, onToggleExpand, onMove, selectedIds, onSelect }) => {
  const visibleRows = useMemo(
    () => buildVisibleTreeRows(rows, expandedById),
    [expandedById, rows],
  );
  const pagingDemo = useBaseComponentsGridPagingDemo(config.paging, visibleRows.length, viewportTier);
  const fillProps = resolveTreePreviewFillProps(config.fillHeight);
  const stateView = resolveTreeStateView(config.state);

  if (stateView.showError) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-rose-700" role="alert">Tree data could not be loaded.</div>;
  }
  if (stateView.showEmpty) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">No tree nodes to display.</div>;
  }

  const presentation = resolveTreePresentation(config);
  const layout = resolveTreePreviewLayout(config, viewportTier);
  const displayRows = pagingDemo.sliceRows(visibleRows);
  const stackedFieldLabels = resolveTreeStackedFieldLabels(config.compactFieldLabels);

  const columns = presentation.showDataColumns ? [
    {
      key: 'kind',
      header: 'Kind',
      style: { width: '6rem' },
      renderCell: (row: BaseComponentsTreeRow) => <BaseComponentsTreeKindBadge kind={row.kind} />,
    },
    {
      key: 'active',
      header: 'Active',
      headerClassName: 'text-center',
      style: { width: '4.5rem' },
      className: 'text-center',
      hideBelow: 'md' as const,
      renderCell: (row: BaseComponentsTreeRow) => renderBooleanIcon(row.active),
    },
    ...(config.rowActions ? [{
      key: 'actions',
      header: '',
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      className: APP_TABLE_GRID_ACTION_CELL_CLASS,
      style: { width: `${demoGridActionsColumnWidth(config.maxVisibleActions)}px` },
      renderCell: () => <DemoGridRowActions maxVisible={config.maxVisibleActions} />,
    }] : []),
  ] : [];

  const previewColumns = layout === 'hybrid-stacked' && config.compactCollapseExtraFields
    ? (() => {
      const action = columns.filter((column) => column.key === 'actions');
      const fields = columns.filter((column) => column.key !== 'actions')
        .slice(0, config.compactVisibleFieldCount);
      return [...fields, ...action];
    })()
    : columns;

  return (
    <div className={fillProps.previewHostClassName}>
      <div className={fillProps.fillHeight ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0 overflow-auto'}>
        <BaseTreeGrid<BaseComponentsTreeRow>
          rows={displayRows}
          expandedById={expandedById}
          loadingByParent={stateView.loadingByParent}
          moveDisabled={config.moveDisabled}
          hideExpandControls={config.hideExpandControls}
          showHeader={presentation.showHeader}
          showIdColumn={presentation.showIdColumn}
          layout={layout}
          stickyHeader={config.stickyHeader}
          stackedFieldLabels={stackedFieldLabels}
          nodeColumnHeader="Node"
          rowClassName={(row) => cn(
            row.kind === 'group' ? 'bg-slate-50/80' : '',
            row.depth === 0 ? 'font-semibold' : '',
            selectedIds.includes(row.id) && 'bg-indigo-50 text-indigo-800',
            config.density === 'compact' && 'text-[11px]',
            config.showGuides && row.depth > 0 && 'border-s-2 border-slate-200',
          )}
          onToggleExpand={onToggleExpand}
          onMove={onMove}
          onRowClick={config.selection === 'none' ? undefined : onSelect}
          getNodeLabel={(row) => {
            if (row.depth === 0) {
              const rootIndex = Number(row.id.replace('root-', '')) || 0;
              return <BaseComponentsTreeRootAccent rootIndex={rootIndex} label={row.label} />;
            }
            return row.label;
          }}
          columns={previewColumns}
          stackedActionsPlacement={resolveTreeStackedActionsPlacement(config)}
        />
      </div>
      {pagingDemo.footer ? <div className="shrink-0">{pagingDemo.footer}</div> : null}
    </div>
  );
};

export const TreeGridBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<TreeGridBaseComponentsConfig>(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG);
  const previewViewport = useBaseComponentsPreviewViewport();
  const [rows, setRows] = useState<BaseComponentsTreeRow[]>(() => buildTreeCatalog(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.branchCount));
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(() =>
    buildDefaultExpandedById(buildTreeCatalog(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.branchCount), DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.expandAllByDefault),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (config.selection === 'none') setSelectedIds([]);
  }, [config.selection]);
  React.useEffect(() => {
    if (config.state === 'branch-loading') {
      setExpandedById((current) => ({ ...current, 'root-0': true }));
    }
  }, [config.state]);

  const configJson = useMemo(() => JSON.stringify({
    public: {
      selectionMode: config.selection,
      lazyLoad: config.lazyLoad,
      allowMove: !config.moveDisabled,
      showGuides: config.showGuides,
      density: config.density,
      fillHeight: config.fillHeight,
      stickyHeader: config.stickyHeader,
      showHeader: config.pattern === 'treegrid' ? config.showHeader : false,
      showIdColumn: config.pattern === 'treegrid' ? config.showIdColumn : false,
      showExpandControls: !config.hideExpandControls,
      expandAllByDefault: config.expandAllByDefault,
    },
    composition: {
      pattern: config.pattern,
      showExpandAll: true,
      presentation: config.presentation,
      cardBelow: config.cardBelow,
      paging: config.paging.enabled
        ? { mode: config.paging.mode, pageSize: config.paging.pageSize, listMode: config.paging.listMode }
        : false,
    },
    demo: { fixtures: { data: 'three-level', branchCount: config.branchCount }, scenarios: { state: config.state, presentation: config.presentation } },
  }, null, 2), [config]);

  const applyBranchCount = useCallback((branchCount: number) => {
    const nextRows = buildTreeCatalog(branchCount);
    setRows(nextRows);
    setExpandedById(buildDefaultExpandedById(nextRows, config.expandAllByDefault));
  }, [config.expandAllByDefault]);

  const resetWorkspace = useCallback(() => {
    setConfig(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG);
    const nextRows = buildTreeCatalog(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.branchCount);
    setRows(nextRows);
    setExpandedById(buildDefaultExpandedById(nextRows, DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.expandAllByDefault));
    setSelectedIds([]);
  }, []);

  const toggleExpand = useCallback((row: BaseComponentsTreeRow) => {
    if (config.lazyLoad && !expandedById[row.id]) {
      setConfig((current) => ({ ...current, state: 'branch-loading' }));
      window.setTimeout(() => setConfig((current) => ({ ...current, state: 'default' })), 650);
    }
    setExpandedById((current) => ({
      ...current,
      [row.id]: !current[row.id],
    }));
  }, [config.lazyLoad, expandedById]);

  const handleSelect = useCallback((row: BaseComponentsTreeRow) => {
    setSelectedIds((current) => {
      if (config.selection === 'single') return current.includes(row.id) ? [] : [row.id];
      return current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id];
    });
  }, [config.selection]);

  const handleMove = useCallback(async (sourceId: string, targetId: string | null, position: TreeDropPosition) => {
    setRows((current) => {
      const source = current.find((row) => row.id === sourceId);
      if (!source) return current;

      const withoutSource = current.filter((row) => row.id !== sourceId);
      const target = targetId ? withoutSource.find((row) => row.id === targetId) : null;
      const nextParentId = position === 'inside' ? targetId : (target?.parentId ?? null);
      const nextDepth = position === 'inside'
        ? (target ? target.depth + 1 : 0)
        : (target?.depth ?? 0);

      const moved: BaseComponentsTreeRow = {
        ...source,
        parentId: nextParentId,
        depth: nextDepth,
      };

      const insertIndex = targetId
        ? withoutSource.findIndex((row) => row.id === targetId) + (position === 'before' ? 0 : 1)
        : withoutSource.length;

      const next = [...withoutSource];
      next.splice(insertIndex, 0, moved);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="treegrid" json={configJson}>
          <BaseComponentsResetButton onClick={resetWorkspace} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Pattern" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.pattern}
                    onChange={(event) => {
                      const pattern = event.target.value as TreeGridBaseComponentsConfig['pattern'];
                      setConfig((current) => applyTreePattern(current, pattern));
                    }}
                    ariaLabel="Tree pattern">
                    <option value="navigation-tree">navigation tree</option>
                    <option value="treegrid">tree grid</option>
                  </UiSelect>
                </FormField>
                <FormField label="Branches" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={String(config.branchCount)}
                    onChange={(event) => {
                      const count = Number(event.target.value);
                      if (!Number.isNaN(count)) {
                        setConfig((current) => ({ ...current, branchCount: count }));
                        applyBranchCount(count);
                      }
                    }}
                    ariaLabel="Branch count"
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={String(count)}>{count}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <BaseComponentsGridHeightField
                  fillHeight={config.fillHeight}
                  onChange={(fillHeight) => setConfig((current) => ({ ...current, fillHeight }))}
                  ariaLabel="Tree grid height"
                />
                <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.density}
                    onChange={(event) => {
                      const density = event.target.value as TreeGridBaseComponentsConfig['density'];
                      if (density === 'compact' || density === 'default') {
                        setConfig((current) => ({ ...current, density }));
                      }
                    }}
                    ariaLabel="Tree density"
                  >
                    <option value="default">default</option>
                    <option value="compact">compact</option>
                  </UiSelect>
                </FormField>
                {config.pattern === 'treegrid' ? (
                  <FormField label="Sticky header" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.stickyHeader ? 'yes' : 'no'}
                      onChange={(event) => setConfig((current) => ({
                        ...current,
                        stickyHeader: event.target.value === 'yes',
                      }))}
                      ariaLabel="Sticky header"
                    >
                      <option value="yes">on</option>
                      <option value="no">off</option>
                    </UiSelect>
                  </FormField>
                ) : null}

                {config.pattern === 'treegrid' ? <FormField label="Header" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showHeader ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showHeader: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Show header"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField> : null}

                {config.pattern === 'treegrid' ? <FormField label="Id column" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showIdColumn ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showIdColumn: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Show id column"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField> : null}
              </div>
            </FormSection>

            <FormSection title="Tree behavior" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Selection" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.selection}
                    onChange={(event) => setConfig((current) => ({ ...current, selection: event.target.value as TreeGridBaseComponentsConfig['selection'] }))}
                    ariaLabel="Selection">
                    <option value="none">none</option><option value="single">single</option>
                    <option value="multiple">multiple</option>
                  </UiSelect>
                </FormField>
                <FormField label="Lazy children" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.lazyLoad ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({ ...current, lazyLoad: event.target.value === 'yes' }))}
                    ariaLabel="Lazy load tree children">
                    <option value="no">eager</option><option value="yes">lazy</option>
                  </UiSelect>
                </FormField>
                <FormField label="Expand controls" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.hideExpandControls ? 'hide' : 'show'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        hideExpandControls: event.target.value === 'hide',
                      }));
                    }}
                    ariaLabel="Expand controls"
                  >
                    <option value="show">show</option>
                    <option value="hide">hide</option>
                  </UiSelect>
                </FormField>

                {config.pattern === 'treegrid' && config.presentation !== 'cards' ? <FormField label="Drag reorder" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.moveDisabled ? 'off' : 'on'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        moveDisabled: event.target.value === 'off',
                      }));
                    }}
                    ariaLabel="Drag reorder"
                  >
                    <option value="off">off</option>
                    <option value="on">on</option>
                  </UiSelect>
                </FormField> : null}

                <FormField label="Expand all by default" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.expandAllByDefault ? 'yes' : 'no'}
                    onChange={(event) => {
                      const expandAll = event.target.value === 'yes';
                      setConfig((current) => ({ ...current, expandAllByDefault: expandAll }));
                      setExpandedById(buildDefaultExpandedById(rows, expandAll));
                    }}
                    ariaLabel="Expand all by default"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField>
                <FormField label="Guides" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showGuides ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      showGuides: event.target.value === 'yes',
                    }))}
                    ariaLabel="Tree guides"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField>
                <FormField label="Scenario" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state}
                    onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as TreeGridBaseComponentsConfig['state'] }))}
                    ariaLabel="Tree state scenario">
                    <option value="default">default</option><option value="branch-loading">branch loading</option>
                    <option value="empty">empty</option><option value="error">error</option>
                  </UiSelect>
                </FormField>
                {config.pattern === 'treegrid' ? (
                  <BaseComponentsGridRowActionsFields
                    config={config}
                    onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
                  />
                ) : null}
              </div>
            </FormSection>

            <BaseComponentsGridPresentationFields
              variant="tree"
              config={config}
              onChange={(patch) => setConfig((current) => {
                const next = { ...current, ...patch };
                if (patch.presentation === 'cards') next.moveDisabled = true;
                return next;
              })}
              showPresentation={config.pattern === 'treegrid'}
              showCompact={config.pattern === 'treegrid'}
            />
            <BaseComponentsGridPagingFields
              config={config.paging}
              onChange={(patch) => setConfig((current) => ({
                ...current,
                paging: { ...current.paging, ...patch },
              }))}
            />
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="treegrid" fill={config.fillHeight}>
          <div className={resolveTreePreviewFillProps(config.fillHeight).previewHostClassName}>
            <TreeGridBaseComponentsPreview
              config={config}
              viewportTier={previewViewport}
              rows={rows}
              expandedById={expandedById}
              onToggleExpand={toggleExpand}
              onMove={handleMove}
              selectedIds={selectedIds}
              onSelect={handleSelect}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
