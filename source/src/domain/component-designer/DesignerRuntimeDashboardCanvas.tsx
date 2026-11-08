import * as React from 'react';
import {
  DASHBOARD_CANVAS_CONFIG_PROP,
  DASHBOARD_PERSONALIZABLE_PROP,
  DASHBOARD_WIDGET_GRID_PROP,
  parseDashboardCanvasPageConfig,
  type DashboardAccessPermission,
  type DashboardCanvasPageConfig,
  type DashboardCanvasPersonalization,
  type DashboardUserWidget,
  emptyDashboardCanvasPersonalization,
} from '../../shared/api/contracts/dashboard-canvas';
import type { PivotResult } from '../../shared/api/contracts/data-api';
import { PIVOT_AGGREGATIONS } from '../../shared/api/contracts/data-api';
import {
  EMPTY_FUNCTION_ACCESS_CONTROL,
  type FunctionAccessControl,
  type FunctionAccessMode,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  buildDashboardEmbedHref,
  buildDrillDownPivotSpec,
  buildWidgetPivotSpec,
  dashboardSnapshotViewerPath,
  isDashboardChromeStrippedView,
  parseDashboardWidgetFieldMapping,
  parseDashboardWidgetVizConfig,
  pivotResultToChartRows,
  readDashboardFilterQuery,
  writeDashboardFilterQuery,
  resolveDashboardFilterDefault,
  scopeDashboardFilters,
  type DashboardCanvasQueryState,
  type DashboardChartKind,
  type PivotTableCalculation,
} from '../../shared/lib/dashboardCanvas';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { UiDashboardCanvas, type UiDashboardCanvasItem } from '../../shared/ui/UiDashboardCanvas';
import {
  AccessControlModal,
  AppButton,
  AppTableGrid,
  ConfirmDialogShell,
  CreateEditModalShell,
  FormField,
  FormSection,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_INNER_ROW_CLASS,
  PAGE_TOOLBAR_MULTI_ROW_CLASS,
  ShellResponsivePopover,
  TOOLBAR_ACTION_COMPACT_BUTTON_CLASS,
  TOOLBAR_ACTION_LABEL_CLASS,
  UiSegmentedControl,
  ToolbarRefreshButton,
  UiInput,
  UiOptionCardGroup,
  UiRadioChoiceList,
  UiSelect,
  UiTextarea,
  UiTooltip,
  showAppFeedbackToast,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import { apiFetch, apiGet, apiPost, apiPut } from '../../shared/api/client';
import { Bookmark, Download, Eye, Globe, GripVertical, Link2, ListFilter, MessageSquare, Plus, Share2, Sparkles, Trash2, UserCheck } from 'lucide-react';
import { DesignerRuntimeDashboardUserWidget, requestDashboardCanvasPivot } from './DesignerRuntimeDashboardUserWidget';
import { DesignerRuntimeDashboardFilterBar } from './DesignerRuntimeDashboardFilterBar';
import {
  developerNodeToDashboardWidget,
  downloadDashboardBlob,
  nodeDashboardTabId,
  parseDashboardGrid,
  readNodeVariants,
} from './dashboardCanvasRuntimeHelpers';

const readConfig = (options: RuntimeRenderOptions): DashboardCanvasPageConfig => {
  const document = options.designerDocument;
  const root = document?.nodes[document.rootNodeId];
  const parsed = parseDashboardCanvasPageConfig(root?.props?.[DASHBOARD_CANVAS_CONFIG_PROP]);
  return {
    ...parsed,
    personalizable: root?.props?.[DASHBOARD_PERSONALIZABLE_PROP] === true || parsed.personalizable,
  };
};

type DesignerRuntimeDashboardCanvasProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  children: React.ReactNode;
};

export const DesignerRuntimeDashboardCanvas: React.FC<DesignerRuntimeDashboardCanvasProps> = ({
  node,
  options,
  children,
}) => {
  const config = React.useMemo(() => readConfig(options), [options.designerDocument]);
  const pageId = options.designerDocument?.id ?? '';
  const childIds = node.children;
  const [personalization, setPersonalization] = React.useState<DashboardCanvasPersonalization>(
    emptyDashboardCanvasPersonalization(),
  );
  const [querySearch, setQuerySearch] = React.useState(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [commentOpen, setCommentOpen] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<Array<{ id: number; body: string; authorId: number }>>([]);
  const [commentBody, setCommentOpenBody] = React.useState('');
  const [draftKind, setDraftKind] = React.useState<DashboardUserWidget['kind']>('chart');
  const [draftDomain, setDraftDomain] = React.useState(config.domain[0]?.id ?? '');
  const [draftDimension, setDraftDimension] = React.useState('');
  const [draftMetric, setDraftMetric] = React.useState('');
  const [draftAggregation, setDraftAggregation] = React.useState<(typeof PIVOT_AGGREGATIONS)[number]>('sum');
  const [draftChartKind, setDraftChartKind] = React.useState<DashboardChartKind>('bar');
  const [draftComboIndex, setDraftComboIndex] = React.useState(0);
  const [draftMetricB, setDraftMetricB] = React.useState('');
  const [draftPrompt, setDraftPrompt] = React.useState('');
  const [draftText, setDraftText] = React.useState('');
  const [draftBinning, setDraftBinning] = React.useState<'none' | 'fixedCount' | 'fixedWidth' | 'custom'>('none');
  const [draftBinCount, setDraftBinCount] = React.useState('5');
  const [draftBinWidth, setDraftBinWidth] = React.useState('');
  const [draftBreakpoints, setDraftBreakpoints] = React.useState('');
  const [draftCalc, setDraftCalc] = React.useState<PivotTableCalculation | ''>('');
  const [draftGoalKind, setDraftGoalKind] = React.useState<'none' | 'static' | 'average' | 'min' | 'max'>('none');
  const [draftGoalValue, setDraftGoalValue] = React.useState('');
  const [shareOpen, setShareOpen] = React.useState(false);
  const [aclOpen, setAclOpen] = React.useState(false);
  const [accessControl, setAccessControl] = React.useState<FunctionAccessControl>(EMPTY_FUNCTION_ACCESS_CONTROL);
  const [accessPermission, setAccessPermission] = React.useState<DashboardAccessPermission>('view');
  const [embedOrigins, setEmbedOrigins] = React.useState('');
  const [accessSaving, setAccessSaving] = React.useState(false);
  const [snapshotSaving, setSnapshotSaving] = React.useState(false);
  const [snapshotLink, setSnapshotLink] = React.useState('');
  const [draftSaving, setDraftSaving] = React.useState(false);
  const [viewName, setViewName] = React.useState('');
  const [viewOpen, setViewOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [relatedOpen, setRelatedOpen] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [drill, setDrill] = React.useState<{ title: string; rows: Array<Record<string, unknown>>; loading?: boolean } | null>(null);
  const [compactWidgetIds, setCompactWidgetIds] = React.useState<string[]>([]);
  const resultsRef = React.useRef<Record<string, PivotResult>>({});
  const chromeStripped = isDashboardChromeStrippedView(
    typeof window === 'undefined' ? '' : window.location.pathname,
    querySearch,
  );

  React.useEffect(() => {
    const onPop = () => setQuerySearch(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const filterState = React.useMemo(() => readDashboardFilterQuery(querySearch), [querySearch]);
  const tabs = config.tabs ?? [];
  const activeTab = filterState.tabId && tabs.some((tab) => tab.id === filterState.tabId)
    ? filterState.tabId
    : tabs[0]?.id;

  const applyQuery = React.useCallback((next: DashboardCanvasQueryState) => {
    const serialized = writeDashboardFilterQuery(next);
    window.history.replaceState(null, '', `${window.location.pathname}${serialized ? `?${serialized}` : ''}`);
    setQuerySearch(serialized ? `?${serialized}` : '');
  }, []);

  React.useEffect(() => {
    if (options.mode !== 'runtime' || !(config.filters ?? []).length) {
      return;
    }
    const nextFilters = { ...filterState.filters };
    let changed = false;
    for (const declaration of config.filters ?? []) {
      if (nextFilters[declaration.id]) {
        continue;
      }
      const resolved = resolveDashboardFilterDefault(declaration.defaultValue);
      if (!resolved) {
        continue;
      }
      nextFilters[declaration.id] = resolved;
      changed = true;
    }
    if (changed) {
      applyQuery({ ...filterState, tabId: activeTab, filters: nextFilters });
    }
  }, [applyQuery, config.filters, filterState, activeTab, options.mode]);

  React.useEffect(() => {
    if (!pageId || options.mode !== 'runtime' || !config.personalizable) {
      return;
    }
    void apiGet<{ personalization?: DashboardCanvasPersonalization }>(
      `/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/personalization`,
    ).then(({ data }) => {
      if (data.personalization) setPersonalization(data.personalization);
    }).catch(() => undefined);
  }, [pageId, config.personalizable, options.mode]);

  const persist = React.useCallback(async (next: DashboardCanvasPersonalization) => {
    setPersonalization(next);
    if (!pageId || options.mode !== 'runtime') return;
    await apiPut(`/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/personalization`, {
      personalization: next,
    });
  }, [pageId, options.mode]);

  const layout: UiDashboardCanvasItem[] = React.useMemo(() => {
    const items: UiDashboardCanvasItem[] = [];
    childIds.forEach((id, index) => {
      const child = options.designerDocument?.nodes[id];
      if (tabs.length > 0) {
        const homeTab = nodeDashboardTabId(child) ?? tabs[0]?.id;
        if (homeTab && homeTab !== activeTab) return;
      }
      items.push(parseDashboardGrid(child?.props?.[DASHBOARD_WIDGET_GRID_PROP], {
        i: id,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 6,
        w: 6,
        h: 6,
      }));
    });
    for (const widget of personalization.userWidgets) {
      if (activeTab && widget.tabId && widget.tabId !== activeTab) continue;
      items.push({ i: widget.id, ...widget.gridPosition });
    }
    for (const [id, size] of Object.entries(personalization.sizes)) {
      const item = items.find((entry) => entry.i === id);
      if (item) {
        item.w = size.w;
        item.h = size.h;
      }
    }
    const compact = new Set(compactWidgetIds);
    for (const item of items) {
      if (compact.has(item.i)) {
        const cap = item.w >= 10 ? 3 : 4;
        if (item.h > cap) {
          item.h = cap;
        }
      }
    }
    return items.filter((item) => !personalization.hiddenNodeIds.includes(item.i));
  }, [childIds, options.designerDocument, personalization, activeTab, tabs, compactWidgetIds]);

  const childById = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    React.Children.forEach(children, (child, index) => {
      const id = childIds[index];
      if (id) map.set(id, child);
    });
    return map;
  }, [children, childIds]);

  const visibleDeveloperIds = layout.map((item) => item.i).filter((id) => childById.has(id));
  const visibleUserWidgets = personalization.userWidgets.filter((widget) => (
    (!activeTab || !widget.tabId || widget.tabId === activeTab)
    && !personalization.hiddenNodeIds.includes(widget.id)
  ));
  const visibleFilters = React.useMemo(
    () => scopeDashboardFilters(config.filters ?? [], layout.map((item) => item.i), config.domain),
    [config.filters, config.domain, layout],
  );

  const onUserWidgetResult = React.useCallback((widgetId: string, result: PivotResult | null) => {
    if (result) resultsRef.current[widgetId] = result;
    else delete resultsRef.current[widgetId];
    const empty = !result || result.cells.length === 0;
    setCompactWidgetIds((current) => {
      const has = current.includes(widgetId);
      if (empty === has) {
        return current;
      }
      return empty ? [...current, widgetId] : current.filter((id) => id !== widgetId);
    });
  }, []);

  const handleDataPoint = (widget: DashboardUserWidget, category: string) => {
    const mapping = parseDashboardWidgetFieldMapping(widget.fieldMapping);
    const field = filterState.drillBy?.[widget.id] || mapping.dimension;
    if (field) {
      applyQuery({
        ...filterState,
        tabId: activeTab,
        crossFilter: { ...(filterState.crossFilter ?? {}), [field]: category },
      });
    }
    const title = `${widget.kind} · ${category}`;
    setDrill({ title, rows: [], loading: true });
    const built = buildWidgetPivotSpec(widget, config, filterState);
    const entry = config.domain.find((item) => item.id === widget.domainEntryId);
    if (!pageId || !built || !field || !entry) {
      const current = resultsRef.current[widget.id];
      setDrill({
        title,
        rows: current ? pivotResultToChartRows(current).filter((row) => String(row.label ?? '') === category) : [],
        loading: false,
      });
      return;
    }
    void requestDashboardCanvasPivot(
      pageId,
      built.domainEntryId,
      buildDrillDownPivotSpec(built.spec, field, category, entry.exposedFields),
      widget.id,
    ).then((result) => {
      setDrill({
        title,
        rows: result ? pivotResultToChartRows(result) : [],
        loading: false,
      });
    }).catch(() => {
      setDrill({ title, rows: [], loading: false });
    });
  };

  const addWidget = async () => {
    const pair = (config.joinablePairs ?? [])[draftComboIndex];
    await persist({
      ...personalization,
      userWidgets: [...personalization.userWidgets, {
        id: `uw_${Date.now().toString(36)}`,
        tabId: activeTab,
        kind: draftKind,
        domainEntryId: draftKind === 'combo' || draftKind === 'text' ? undefined : draftDomain,
        comboRef: draftKind === 'combo' ? pair : undefined,
        fieldMapping: {
          dimension: draftDimension || undefined,
          metric: draftMetric || undefined,
          aggregation: draftAggregation,
          chartKind: draftChartKind,
          metricB: draftKind === 'combo' ? draftMetricB || undefined : undefined,
        },
        vizConfig: {
          text: draftKind === 'text' ? draftText : undefined,
          tableCalculation: draftCalc || undefined,
          binning: draftBinning === 'none' ? undefined : {
            mode: draftBinning,
            count: Number(draftBinCount) || 5,
            width: Number(draftBinWidth) || undefined,
            breakpoints: draftBreakpoints.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)),
          },
          referenceLine: draftGoalKind === 'none' ? undefined : {
            kind: draftGoalKind,
            value: draftGoalKind === 'static' ? Number(draftGoalValue) : undefined,
          },
        },
        gridPosition: { x: 0, y: layout.length * 4, w: 6, h: 4 },
      }],
    });
    setAddOpen(false);
    showAppFeedbackToast('Widget added to this dashboard.', { type: 'success' });
  };

  const applyWidgetDraft = (widget: Partial<DashboardUserWidget> & { kind?: DashboardUserWidget['kind'] }) => {
    if (widget.kind) setDraftKind(widget.kind);
    if (widget.domainEntryId) setDraftDomain(widget.domainEntryId);
    const mapping = parseDashboardWidgetFieldMapping(widget.fieldMapping);
    if (mapping.dimension) setDraftDimension(mapping.dimension);
    if (mapping.metric) setDraftMetric(mapping.metric);
    if (mapping.aggregation) setDraftAggregation(mapping.aggregation);
    if (mapping.chartKind) setDraftChartKind(mapping.chartKind);
    if (mapping.metricB) setDraftMetricB(mapping.metricB);
    if (widget.comboRef) {
      const index = (config.joinablePairs ?? []).findIndex((pair) => (
        pair.domainEntryIdA === widget.comboRef?.domainEntryIdA
        && pair.fieldA === widget.comboRef.fieldA
        && pair.domainEntryIdB === widget.comboRef.domainEntryIdB
        && pair.fieldB === widget.comboRef.fieldB
      ));
      if (index >= 0) setDraftComboIndex(index);
    }
    const viz = parseDashboardWidgetVizConfig(widget.vizConfig);
    if (viz.text) setDraftText(viz.text);
    if (viz.tableCalculation) setDraftCalc(viz.tableCalculation);
    if (viz.binning?.mode) setDraftBinning(viz.binning.mode);
    if (viz.binning?.count) setDraftBinCount(String(viz.binning.count));
    if (viz.binning?.width) setDraftBinWidth(String(viz.binning.width));
    if (viz.referenceLine?.kind && viz.referenceLine.kind !== 'median') {
      setDraftGoalKind(viz.referenceLine.kind);
    }
    if (viz.referenceLine?.value != null) setDraftGoalValue(String(viz.referenceLine.value));
  };

  const draftWidgetFromPrompt = async () => {
    if (!pageId || !draftPrompt.trim()) {
      showAppFeedbackToast('Describe the widget first.', { type: 'error' });
      return;
    }
    setDraftSaving(true);
    try {
      const { data } = await apiPost<{ widget?: Partial<DashboardUserWidget> & { kind?: DashboardUserWidget['kind'] } }>(
        '/api/dashboard-canvas/draft-widget',
        { pageId, prompt: draftPrompt },
      );
      if (data.widget) {
        applyWidgetDraft(data.widget);
        showAppFeedbackToast('Draft applied. Review and add the widget.', { type: 'success' });
      }
    } catch {
      showAppFeedbackToast('Unable to draft this widget.', { type: 'error' });
    } finally {
      setDraftSaving(false);
    }
  };

  const openComments = async (widgetId: string) => {
    setCommentOpen(widgetId);
    if (!pageId) return;
    const { data } = await apiGet<{ items?: Array<{ id: number; body: string; authorId: number }> }>(
      `/api/dashboard-canvas/comments?pageId=${encodeURIComponent(pageId)}&widgetNodeId=${encodeURIComponent(widgetId)}`,
    );
    setComments(data.items ?? []);
  };

  const explainWidget = async (widgetId: string) => {
    const result = resultsRef.current[widgetId] ?? {
      cells: [], measures: [], rowAxis: { fields: [], members: [] }, colAxis: { fields: [], members: [] },
    };
    const { data } = await apiPost<{ explanation?: string }>('/api/dashboard-canvas/explain', {
      pageId, widgetNodeId: widgetId, result,
    });
    showAppFeedbackToast(data.explanation || 'No explanation available.', { type: 'info' });
  };

  const exportPage = async (format: 'png' | 'pdf') => {
    const results = Object.entries(resultsRef.current).map(([widgetId, result]) => ({ widgetId, result }));
    const response = await apiFetch(`/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, format }),
    });
    downloadDashboardBlob(await response.blob(), `dashboard-${pageId || 'canvas'}.${format}`);
    showAppFeedbackToast(`${format.toUpperCase()} export downloaded.`, { type: 'success' });
  };

  const activeDomain = config.domain.find((entry) => entry.id === draftDomain) ?? config.domain[0];
  const addDisabled = config.domain.length === 0;
  const dashboardToolbarActionButtonClass = cn(
    TOOLBAR_ACTION_COMPACT_BUTTON_CLASS,
    'max-lg:!h-11 max-lg:!w-11 max-lg:!min-h-11 max-lg:!min-w-11',
  );
  const addButton = (
    <AppButton
      intent="secondary"
      size="sm"
      onClick={() => setAddOpen(true)}
      disabled={addDisabled}
      className={dashboardToolbarActionButtonClass}
    >
      <Plus className="h-3.5 w-3.5" />
      <span className={TOOLBAR_ACTION_LABEL_CLASS}>Add widget</span>
    </AppButton>
  );

  const hasCrossFilter = Boolean(filterState.crossFilter && Object.keys(filterState.crossFilter).length > 0);
  const showDashboardFilterBar = visibleFilters.length > 0 || hasCrossFilter;

  const dashboardRefreshButton = (
    <ToolbarRefreshButton
      onClick={() => setRefreshNonce((value) => value + 1)}
      separatorBefore={false}
    />
  );

  const dashboardPageActions = config.personalizable && !chromeStripped ? (
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      {(
        <>
          {addDisabled ? <UiTooltip content="no data domain configured for this page"><span>{addButton}</span></UiTooltip> : addButton}
          <ShellResponsivePopover
            open={exportOpen}
            onOpenChange={setExportOpen}
            ariaLabel="Export dashboard"
            trigger={(
              <AppButton intent="secondary" size="sm" className={dashboardToolbarActionButtonClass}>
                <Download className="h-3.5 w-3.5" />
                <span className={TOOLBAR_ACTION_LABEL_CLASS}>Export</span>
              </AppButton>
            )}
          >
            <div className="flex min-w-[10rem] flex-col gap-1 p-2">
              <AppButton intent="secondary" size="sm" onClick={() => { setExportOpen(false); void exportPage('png'); }}>PNG</AppButton>
              <AppButton intent="secondary" size="sm" onClick={() => { setExportOpen(false); void exportPage('pdf'); }}>PDF</AppButton>
            </div>
          </ShellResponsivePopover>
          {personalization.savedViews.length > 0 ? (
            <div className="w-full min-w-0 sm:w-[8.5rem] sm:shrink-0">
              <UiSelect
                size="sm"
                ariaLabel="My saved views"
                placeholder="My views"
                value=""
                onChange={(event) => {
                  const view = personalization.savedViews.find((item) => item.id === event.target.value);
                  if (view) {
                    window.history.replaceState(null, '', `${window.location.pathname}${view.urlQueryString}`);
                    setQuerySearch(view.urlQueryString);
                  }
                }}
              >
                {personalization.savedViews.map((view) => (
                  <option key={view.id} value={view.id}>{view.name}</option>
                ))}
              </UiSelect>
            </div>
          ) : null}
          <ShellResponsivePopover
            open={viewOpen}
            onOpenChange={setViewOpen}
            ariaLabel="Save view"
            trigger={(
              <AppButton intent="secondary" size="sm" className={dashboardToolbarActionButtonClass}>
                <Bookmark className="h-3.5 w-3.5" />
                <span className={TOOLBAR_ACTION_LABEL_CLASS}>Save view</span>
              </AppButton>
            )}
          >
            <div className="flex min-w-[16rem] flex-col gap-2 p-2">
              <FormField label="View name">
                <UiInput size="sm" value={viewName} onChange={(event) => setViewName(event.target.value)} ariaLabel="Saved view name" />
              </FormField>
              <AppButton intent="primary" size="sm" onClick={() => {
                if (!viewName.trim()) return;
                void persist({
                  ...personalization,
                  savedViews: [...personalization.savedViews, {
                    id: `sv_${Date.now().toString(36)}`,
                    name: viewName.trim(),
                    urlQueryString: window.location.search,
                    createdAt: new Date().toISOString(),
                  }],
                });
                setViewName('');
                setViewOpen(false);
              }}>Save</AppButton>
            </div>
          </ShellResponsivePopover>
          {(config.dashboardLinks ?? []).length > 0 ? (
            <ShellResponsivePopover
              open={relatedOpen}
              onOpenChange={setRelatedOpen}
              ariaLabel="Related dashboards"
              trigger={(
                <AppButton intent="secondary" size="sm" className={dashboardToolbarActionButtonClass}>
                  <Link2 className="h-3.5 w-3.5" />
                  <span className={TOOLBAR_ACTION_LABEL_CLASS}>Related</span>
                </AppButton>
              )}
            >
              <div className="flex min-w-[12rem] flex-col gap-1 p-2">
                {(config.dashboardLinks ?? []).map((link, index) => (
                  <AppButton
                    key={`${link.label}-${index}`}
                    intent="secondary"
                    size="sm"
                    onClick={() => {
                      setRelatedOpen(false);
                      if ('url' in link.target) {
                        const href = link.forwardFilterState
                          ? `${link.target.url}${link.target.url.includes('?') ? '&' : '?'}${window.location.search.replace(/^\?/, '')}`
                          : link.target.url;
                        window.open(href, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      window.location.assign(`/studio/pages/${link.target.pageId}${window.location.search}`);
                    }}
                  >
                    {link.label}
                  </AppButton>
                ))}
              </div>
            </ShellResponsivePopover>
          ) : null}
          <AppButton
            intent="secondary"
            size="sm"
            className={dashboardToolbarActionButtonClass}
            onClick={() => {
              setShareOpen(true);
              setSnapshotLink('');
              if (!pageId) return;
              void apiGet<{ access?: { accessControl?: FunctionAccessControl | null; accessPermission?: DashboardAccessPermission; embedAllowedOrigins?: string[] } | null }>(
                `/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/access`,
              ).then(({ data }) => {
                setAccessControl(data.access?.accessControl ?? EMPTY_FUNCTION_ACCESS_CONTROL);
                setAccessPermission(data.access?.accessPermission ?? 'view');
                setEmbedOrigins((data.access?.embedAllowedOrigins ?? []).join(', '));
              });
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className={TOOLBAR_ACTION_LABEL_CLASS}>Share</span>
          </AppButton>
          {!showDashboardFilterBar ? dashboardRefreshButton : null}
        </>
      )}
    </div>
  ) : (!showDashboardFilterBar ? (
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      {dashboardRefreshButton}
    </div>
  ) : null);

  const dashboardFiltersRow = showDashboardFilterBar ? (
    <div className={cn(PAGE_TOOLBAR_INNER_ROW_CLASS, 'border-t border-slate-100')}>
      <DesignerRuntimeDashboardFilterBar
        pageId={pageId}
        filters={visibleFilters}
        values={filterState.filters}
        crossFilter={filterState.crossFilter}
        onChange={(filterId, value) => applyQuery({
          ...filterState,
          tabId: activeTab,
          filters: { ...filterState.filters, [filterId]: value },
        })}
        onClearCrossFilter={() => applyQuery({ ...filterState, tabId: activeTab, crossFilter: undefined })}
      />
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        {dashboardRefreshButton}
      </div>
    </div>
  ) : null;

  const showDashboardToolbar = tabs.length > 0
    || visibleFilters.length > 0
    || (config.personalizable && !chromeStripped);

  const showDashboardHeaderOne = tabs.length > 0 || Boolean(dashboardPageActions);

  const widgetChrome = (
    id: string,
    fields: string[],
    variants: Array<{ key: string; label: string }>,
    userOwned: boolean,
    kind?: DashboardUserWidget['kind'],
    empty?: boolean,
  ) => (
    <span className="flex shrink-0 items-center gap-1">
      {variants.length > 0 ? (
        <div className="w-[8.5rem] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="Widget variant"
            placeholder="Variant"
            value={personalization.variantSelections[id] ?? ''}
            onChange={(event) => {
              void persist({
                ...personalization,
                variantSelections: { ...personalization.variantSelections, [id]: event.target.value },
              });
            }}
          >
            {variants.map((variant) => (
              <option key={variant.key} value={variant.key}>{variant.label}</option>
            ))}
          </UiSelect>
        </div>
      ) : null}
      {fields.length > 0 && kind !== 'kpi' && !empty ? (
        <div className="w-[8.5rem] shrink-0">
          <UiSelect
            size="sm"
            ariaLabel="Drill by"
            placeholder="Drill by"
            value={filterState.drillBy?.[id] ?? ''}
            onChange={(event) => {
              const next = { ...(filterState.drillBy ?? {}) };
              if (event.target.value) next[id] = event.target.value;
              else delete next[id];
              applyQuery({ ...filterState, tabId: activeTab, drillBy: next });
            }}
          >
            {fields.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </UiSelect>
        </div>
      ) : null}
      {chromeStripped || kind === 'kpi' || empty ? null : (
        <>
          <AppButton intent="secondary" size="icon-md" onClick={() => void openComments(id)} aria-label="Comments">
            <MessageSquare className="h-3.5 w-3.5" />
          </AppButton>
          <AppButton intent="secondary" size="icon-md" onClick={() => void explainWidget(id)} aria-label="Explain this chart">
            <Sparkles className="h-3.5 w-3.5" />
          </AppButton>
        </>
      )}
      {chromeStripped || kind === 'kpi' || empty ? null : userOwned ? (
        <AppButton intent="secondary" size="icon-md" onClick={() => setPendingDelete(id)} aria-label="Remove widget">
          <Trash2 className="h-3.5 w-3.5" />
        </AppButton>
      ) : config.personalizable ? (
        <AppButton intent="secondary" size="icon-md" onClick={() => void persist({
          ...personalization,
          hiddenNodeIds: [...personalization.hiddenNodeIds, id],
        })} aria-label="Hide widget">
          <Eye className="h-3.5 w-3.5" />
        </AppButton>
      ) : null}
    </span>
  );

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-hidden" data-designer-component="viz.dashboard-canvas">
      {showDashboardToolbar ? (
        <div className={`${PAGE_TOOLBAR_MULTI_ROW_CLASS} shrink-0`}>
          {showDashboardHeaderOne ? (
            <div
              className={cn(
                PAGE_TOOLBAR_INNER_ROW_CLASS,
                tabs.length === 0 && 'justify-end',
              )}
            >
              {tabs.length > 0 ? (
                <div className="flex min-w-0 w-full flex-1 items-center sm:w-auto sm:max-w-md lg:max-w-lg">
                  <UiSegmentedControl
                    items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                    selectedKey={activeTab}
                    onSelectionChange={(tabId) => applyQuery({ ...filterState, tabId })}
                    ariaLabel="Dashboard views"
                    width="equal"
                    className="w-full min-w-0 sm:w-auto"
                  />
                </div>
              ) : (
                <div className="min-w-0 flex-1" aria-hidden="true" />
              )}
              {dashboardPageActions}
            </div>
          ) : null}
          {dashboardFiltersRow}
        </div>
      ) : null}

      <UiDashboardCanvas
        className="px-3 pb-3 pt-2"
        layout={layout}
        isDraggable={options.mode === 'runtime' && config.personalizable && !chromeStripped}
        isResizable={options.mode === 'runtime' && config.personalizable && !chromeStripped}
        onLayoutChange={(next) => {
          const sizes: DashboardCanvasPersonalization['sizes'] = {};
          for (const item of next) sizes[item.i] = { w: item.w, h: item.h };
          if (JSON.stringify(sizes) === JSON.stringify(personalization.sizes)) return;
          void persist({ ...personalization, sizes });
        }}
      >
        {visibleDeveloperIds.map((id) => {
          const childNode = options.designerDocument?.nodes[id];
          const synthetic = options.mode === 'runtime'
            ? developerNodeToDashboardWidget(childNode, config, {
              variantKey: personalization.variantSelections[id],
              drillBy: filterState.drillBy?.[id],
            })
            : null;
          const fields = synthetic
            ? (config.domain.find((entry) => entry.id === synthetic.domainEntryId)?.exposedFields ?? [])
            : config.domain.flatMap((entry) => entry.exposedFields);
          const widgetTitle = parseDashboardWidgetFieldMapping(synthetic?.fieldMapping).title
            || (typeof childNode?.props?.title === 'string' ? childNode.props.title : '');
          return (
            <div key={id} className="relative h-full overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="dashboard-canvas-drag-handle flex h-10 items-center gap-1 border-b border-slate-100 px-2 text-[11px] text-slate-500">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{widgetTitle}</span>
                {widgetChrome(id, fields, readNodeVariants(childNode), false, synthetic?.kind, compactWidgetIds.includes(id))}
              </div>
              <div className="h-[calc(100%-2.5rem)] overflow-auto p-2">
                {synthetic ? (
                  <DesignerRuntimeDashboardUserWidget
                    pageId={pageId}
                    widget={synthetic}
                    config={config}
                    query={filterState}
                    refreshNonce={refreshNonce}
                    onResult={onUserWidgetResult}
                    onDataPoint={handleDataPoint}
                  />
                ) : childById.get(id)}
              </div>
            </div>
          );
        })}
        {visibleUserWidgets.map((widget) => {
          const entry = config.domain.find((item) => item.id === widget.domainEntryId)
            ?? config.domain.find((item) => item.id === widget.comboRef?.domainEntryIdA);
          const widgetTitle = parseDashboardWidgetFieldMapping(widget.fieldMapping).title || widget.kind;
          return (
            <div key={widget.id} className="relative h-full overflow-hidden rounded-md border border-dashed border-slate-300 bg-white">
              <div className="dashboard-canvas-drag-handle flex h-10 items-center gap-1 border-b border-slate-100 px-2 text-[11px] text-slate-500">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{widgetTitle}</span>
                {widgetChrome(widget.id, widget.kind === 'text' ? [] : (entry?.exposedFields ?? []), [], true, widget.kind, compactWidgetIds.includes(widget.id))}
              </div>
              <div className="h-[calc(100%-2.5rem)] overflow-auto p-2">
                <DesignerRuntimeDashboardUserWidget
                  pageId={pageId}
                  widget={widget}
                  config={config}
                  query={filterState}
                  refreshNonce={refreshNonce}
                  onResult={onUserWidgetResult}
                  onDataPoint={handleDataPoint}
                />
              </div>
            </div>
          );
        })}
      </UiDashboardCanvas>

      {addOpen ? (
        <CreateEditModalShell
          size="md"
          title="Add Widget"
          onClose={() => setAddOpen(false)}
          onBackdropClick={() => setAddOpen(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <AppButton intent="cancel" onClick={() => setAddOpen(false)}>Cancel</AppButton>
              <AppButton intent="primary" onClick={() => void addWidget()}>Add</AppButton>
            </div>
          )}
        >
          <div className="flex flex-col gap-3">
            <FormField label="Describe what you want">
              <UiInput size="sm" value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} ariaLabel="Natural language widget draft" />
            </FormField>
            <AppButton intent="secondary" size="sm" disabled={draftSaving} onClick={() => void draftWidgetFromPrompt()}>
              <Sparkles className="h-3.5 w-3.5" />
              Draft with AI
            </AppButton>
            <FormField label="Kind">
              <UiSelect size="sm" ariaLabel="Widget kind" value={draftKind} onChange={(event) => setDraftKind(event.target.value as DashboardUserWidget['kind'])}>
                <option value="chart">Chart</option>
                <option value="kpi">KPI</option>
                <option value="table">Table</option>
                <option value="text">Text</option>
                {(config.joinablePairs ?? []).length > 0 ? <option value="combo">Combo</option> : null}
              </UiSelect>
            </FormField>
            {draftKind === 'text' ? (
              <FormField label="Note">
                <UiTextarea size="sm" value={draftText} onChange={(event) => setDraftText(event.target.value)} ariaLabel="Notes widget text" rows={4} />
              </FormField>
            ) : null}
            {draftKind === 'combo' ? (
              <FormField label="Joinable pair">
                <UiSelect size="sm" ariaLabel="Joinable pair" value={String(draftComboIndex)} onChange={(event) => setDraftComboIndex(Number(event.target.value))}>
                  {(config.joinablePairs ?? []).map((pair, index) => (
                    <option key={`${pair.domainEntryIdA}-${pair.fieldA}-${index}`} value={String(index)}>{pair.label || `${pair.fieldA} / ${pair.fieldB}`}</option>
                  ))}
                </UiSelect>
              </FormField>
            ) : null}
            {draftKind !== 'text' && draftKind !== 'combo' ? (
              <FormField label="Domain entry">
                <UiSelect size="sm" ariaLabel="Domain entry" value={draftDomain} onChange={(event) => setDraftDomain(event.target.value)}>
                  {config.domain.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
                  ))}
                </UiSelect>
              </FormField>
            ) : null}
            {draftKind !== 'text' ? (
              <>
                {draftKind !== 'kpi' ? (
                  <FormField label="Dimension">
                    <UiSelect size="sm" ariaLabel="Dimension" value={draftDimension} onChange={(event) => setDraftDimension(event.target.value)}>
                      <option value="">None</option>
                      {(activeDomain?.exposedFields ?? []).map((field) => <option key={field} value={field}>{field}</option>)}
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="Metric">
                  <UiSelect size="sm" ariaLabel="Metric" value={draftMetric} onChange={(event) => setDraftMetric(event.target.value)}>
                    <option value="">Select metric</option>
                    {(activeDomain?.exposedFields ?? []).map((field) => <option key={field} value={field}>{field}</option>)}
                  </UiSelect>
                </FormField>
                {draftKind === 'combo' ? (
                  <FormField label="Metric B">
                    <UiSelect size="sm" ariaLabel="Metric B" value={draftMetricB} onChange={(event) => setDraftMetricB(event.target.value)}>
                      <option value="">Select metric</option>
                      {(config.domain.find((entry) => entry.id === (config.joinablePairs ?? [])[draftComboIndex]?.domainEntryIdB)?.exposedFields ?? []).map((field) => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </UiSelect>
                  </FormField>
                ) : null}
                <FormField label="Aggregation">
                  <UiSelect size="sm" ariaLabel="Aggregation" value={draftAggregation} onChange={(event) => setDraftAggregation(event.target.value as (typeof PIVOT_AGGREGATIONS)[number])}>
                    {PIVOT_AGGREGATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </UiSelect>
                </FormField>
                {draftKind === 'chart' || draftKind === 'combo' ? (
                  <FormField label="Chart kind">
                    <UiSelect size="sm" ariaLabel="Chart kind" value={draftChartKind} onChange={(event) => setDraftChartKind(event.target.value as DashboardChartKind)}>
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="pie">Pie</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {draftDimension ? (
                  <FormField label="Binning">
                    <UiSelect size="sm" ariaLabel="Binning" value={draftBinning} onChange={(event) => setDraftBinning(event.target.value as typeof draftBinning)}>
                      <option value="none">None</option>
                      <option value="fixedCount">Fixed count</option>
                      <option value="fixedWidth">Fixed width</option>
                      <option value="custom">Custom breakpoints</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {draftBinning === 'fixedCount' ? <FormField label="Bin count"><UiInput size="sm" value={draftBinCount} onChange={(event) => setDraftBinCount(event.target.value)} ariaLabel="Bin count" /></FormField> : null}
                {draftBinning === 'fixedWidth' ? <FormField label="Bin width"><UiInput size="sm" value={draftBinWidth} onChange={(event) => setDraftBinWidth(event.target.value)} ariaLabel="Bin width" /></FormField> : null}
                {draftBinning === 'custom' ? <FormField label="Breakpoints"><UiInput size="sm" value={draftBreakpoints} onChange={(event) => setDraftBreakpoints(event.target.value)} ariaLabel="Custom breakpoints" /></FormField> : null}
                <FormField label="Table calculation">
                  <UiSelect size="sm" ariaLabel="Table calculation" value={draftCalc} onChange={(event) => setDraftCalc(event.target.value as PivotTableCalculation | '')}>
                    <option value="">None</option>
                    <option value="runningTotal">Running total</option>
                    <option value="percentOfTotal">Percent of total</option>
                    <option value="rank">Rank</option>
                  </UiSelect>
                </FormField>
                <FormField label="Reference line">
                  <UiSelect size="sm" ariaLabel="Reference line" value={draftGoalKind} onChange={(event) => setDraftGoalKind(event.target.value as typeof draftGoalKind)}>
                    <option value="none">None</option>
                    <option value="static">Static</option>
                    <option value="average">Average</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </UiSelect>
                </FormField>
                {draftGoalKind === 'static' ? <FormField label="Goal value"><UiInput size="sm" value={draftGoalValue} onChange={(event) => setDraftGoalValue(event.target.value)} ariaLabel="Reference line value" /></FormField> : null}
              </>
            ) : null}
          </div>
        </CreateEditModalShell>
      ) : null}

      {commentOpen ? (
        <CreateEditModalShell
          size="sm"
          title="Widget comments"
          onClose={() => setCommentOpen(null)}
          onBackdropClick={() => setCommentOpen(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <AppButton intent="cancel" onClick={() => setCommentOpen(null)}>Close</AppButton>
              <AppButton intent="primary" onClick={() => {
                if (!commentOpen || !pageId) return;
                void apiPost('/api/dashboard-canvas/comments', { pageId, widgetNodeId: commentOpen, body: commentBody }).then(() => {
                  setCommentOpenBody('');
                  void openComments(commentOpen);
                });
              }}>Send</AppButton>
            </div>
          )}
        >
          <div className="flex flex-col gap-2">
            {comments.map((item) => (
              <p key={item.id} className="rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700">{item.body}</p>
            ))}
            <UiTextarea size="sm" value={commentBody} onChange={(event) => setCommentOpenBody(event.target.value)} ariaLabel="Comment body" rows={3} />
          </div>
        </CreateEditModalShell>
      ) : null}

      {drill ? (
        <CreateEditModalShell size="lg" title={`Underlying rows · ${drill.title}`} onClose={() => setDrill(null)} onBackdropClick={() => setDrill(null)} footer={<AppButton intent="cancel" onClick={() => setDrill(null)}>Close</AppButton>}>
          <AppTableGrid
            chrome="hero"
            fillHeight={false}
            scrollOwner="panel"
            ariaLabel="Underlying pivot rows"
            isLoading={Boolean(drill.loading)}
            loadingMessage="Loading underlying rows…"
            columns={[
              { id: 'label', label: 'Member', renderCell: (row: Record<string, unknown>) => String(row.label ?? ''), isRowHeader: true },
              { id: 'value', label: 'Value', renderCell: (row: Record<string, unknown>) => (row.value == null ? '—' : String(row.value)) },
            ]}
            rows={drill.rows}
            getRowKey={(row) => String(row.label ?? '')}
          />
        </CreateEditModalShell>
      ) : null}

      <ConfirmDialogShell
        open={Boolean(pendingDelete)}
        title="Remove this widget?"
        confirmIntent="destructive"
        confirmLabel="Remove"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void persist({
            ...personalization,
            userWidgets: personalization.userWidgets.filter((widget) => widget.id !== pendingDelete),
          });
          setPendingDelete(null);
        }}
      >
        This only removes a widget you added. Developer widgets stay on the page.
      </ConfirmDialogShell>

      {shareOpen ? (
        <CreateEditModalShell
          size="md"
          title="Share dashboard"
          onClose={() => setShareOpen(false)}
          onBackdropClick={() => setShareOpen(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <AppButton intent="cancel" onClick={() => setShareOpen(false)}>Close</AppButton>
              <AppButton intent="primary" disabled={accessSaving} onClick={() => {
                setAccessSaving(true);
                void apiPut(`/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/access`, {
                  accessControl,
                  accessPermission,
                  embedAllowedOrigins: embedOrigins.split(',').map((item) => item.trim()).filter(Boolean),
                }).then(() => {
                  showAppFeedbackToast('Sharing updated.', { type: 'success' });
                  setShareOpen(false);
                }).finally(() => setAccessSaving(false));
              }}>Save</AppButton>
            </div>
          )}
        >
          <FormSection title="Who can open this link">
            <UiOptionCardGroup
              ariaLabel="Dashboard access mode"
              value={accessControl.accessMode ?? 'authenticated'}
              onChange={(value) => setAccessControl({ ...accessControl, accessMode: value as FunctionAccessMode })}
              options={[
                { value: 'specific', title: 'Restricted', description: 'Only people you add by exact username.', icon: ListFilter },
                { value: 'authenticated', title: 'Anyone signed in', description: 'Any signed-in platform user with the link.', icon: UserCheck },
                { value: 'public', title: 'Anyone with the link', description: 'Anyone who has the link, even without signing in.', icon: Globe },
              ]}
            />
          </FormSection>
          <FormSection title="Permission" divided>
            <UiRadioChoiceList
              ariaLabel="Dashboard permission"
              orientation="horizontal"
              value={accessPermission}
              onChange={(value) => setAccessPermission(value as DashboardAccessPermission)}
              options={[
                { value: 'view', label: 'Can view' },
                { value: 'personalize', label: 'Can personalize' },
              ]}
            />
          </FormSection>
          <FormSection title="Embed origins" divided>
            <FormField label="Allowed origins">
              <UiInput size="sm" value={embedOrigins} onChange={(event) => setEmbedOrigins(event.target.value)} ariaLabel="Embed allowed origins" />
            </FormField>
          </FormSection>
          <FormSection title="Access lists" divided>
            <AppButton intent="secondary" size="sm" onClick={() => setAclOpen(true)}>Edit access lists</AppButton>
          </FormSection>
          <FormSection title="Embed this page" divided>
            <p className="text-sm text-slate-600">
              Embedding is blocked until allowed origins are saved. Use this URL as the iframe source on those origins.
            </p>
            <div className="mt-2">
              <AppButton
                intent="secondary"
                size="sm"
                onClick={() => {
                  if (typeof window === 'undefined' || !pageId) return;
                  const link = buildDashboardEmbedHref(
                    window.location.origin,
                    window.location.pathname,
                    window.location.search,
                    pageId,
                  );
                  void navigator.clipboard.writeText(link);
                  showAppFeedbackToast('Embed link copied.', { type: 'success' });
                }}
              >
                Copy embed link
              </AppButton>
            </div>
          </FormSection>
          <FormSection title="Frozen snapshot" divided>
            <p className="text-sm text-slate-600">Saves the current widget results as a frozen copy. The snapshot is visibly dated and does not stay live.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <AppButton
                intent="secondary"
                size="sm"
                disabled={snapshotSaving}
                onClick={() => {
                  if (!pageId) return;
                  setSnapshotSaving(true);
                  const results = Object.entries(resultsRef.current).map(([widgetId, result]) => ({
                    widgetId,
                    kind: personalization.userWidgets.find((widget) => widget.id === widgetId)?.kind,
                    result,
                  }));
                  void apiPost<{ snapshot?: { id: string; createdAt?: string } }>(
                    `/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/snapshots`,
                    { results },
                  ).then(({ data }) => {
                    if (!data.snapshot?.id) return;
                    const link = `${window.location.origin}${dashboardSnapshotViewerPath(data.snapshot.id)}`;
                    setSnapshotLink(link);
                    showAppFeedbackToast('Snapshot saved.', { type: 'success' });
                  }).catch(() => {
                    showAppFeedbackToast('Unable to save snapshot.', { type: 'error' });
                  }).finally(() => setSnapshotSaving(false));
                }}
              >
                Save snapshot
              </AppButton>
              {snapshotLink ? (
                <AppButton
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(snapshotLink);
                    showAppFeedbackToast('Snapshot link copied.', { type: 'success' });
                  }}
                >
                  Copy snapshot link
                </AppButton>
              ) : null}
            </div>
            {snapshotLink ? <p className="mt-2 break-all text-xs text-slate-500">{snapshotLink}</p> : null}
          </FormSection>
        </CreateEditModalShell>
      ) : null}

      <AccessControlModal
        open={aclOpen}
        titlePath="Dashboard sharing"
        accessControl={accessControl}
        isSaving={accessSaving}
        onClose={() => setAclOpen(false)}
        onChange={setAccessControl}
        onSave={() => setAclOpen(false)}
      />
    </div>
  );
};
