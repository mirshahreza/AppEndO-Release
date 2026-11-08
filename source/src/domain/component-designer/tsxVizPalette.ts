import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { resolveBoundAttributeForNodeProp } from './bindingCodegen';
import {
  CHART_DATA_SOURCES_PROP,
  CHART_FIELD_MAPPING_PROP,
  combineChartFieldMappings,
  getNodeChartDataResourceRef,
  isNodeChartDataBound,
  parseDesignerChartFieldMapping,
  resolveChartSeriesColorsFromMapping,
  resolveChartSeriesLabelsFromMapping,
  resolveNodeChartDataSourceEntries,
} from './bindingChartEngine';
import { getNodeVizDataResourceRef } from './bindingVizEngine';
import { readNumber, readString } from './runtimeShared';
import { DEFAULT_CHART_X_AXIS_KEY } from './visualizationDataModel';
import { MOCK_CHART_SALES_Q1_JSON, MOCK_KANBAN_BOARD_JSON, MOCK_MAP_CHOROPLETH_JSON, MOCK_MAP_PINS_JSON, MOCK_ORG_TREE_JSON, MOCK_PROJECT_TIMELINE_JSON, MOCK_SHEET_DATA_JSON, MOCK_ADVANCED_CHART_DATA_BY_TYPE } from './visualizationMockFixtures';
import { buildNodeJsxAttributesWithBindings, jsxAttributeStringValue, renderNodeJsxAttributes } from './tsxPropMapper';
import { DESIGNER_STORE_PATCH_VAR, DESIGNER_STORE_VAR } from './bindingStoreCodegen';
import {
  DASHBOARD_FILTER_BAR_CONFIG_PROP,
  parseDashboardFilterBarConfig,
} from './designerDashboardFilterBarConfig';
import {
  DASHBOARD_CANVAS_CONFIG_PROP,
  DASHBOARD_PERSONALIZABLE_PROP,
} from '../../shared/api/contracts/dashboard-canvas';
import { documentHasDashboardFilterBar } from './bindingFilterBindingsEngine';
import { isAdvancedChartType } from '../../shared/ui/advancedChartTypes';
import {
  renderDesignerChartEchartsJsxAttrs,
  UI_CHART_ECHARTS_CHROME_KEYS,
} from '../../shared/ui/echarts/uiChartEchartsChrome';

const VIZ_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimeCharts';
const VIZ_ADVANCED_CHART_IMPORT = '@/domain/component-designer/DesignerRuntimeAdvancedCharts';
const VIZ_MAP_IMPORT = '@/domain/component-designer/DesignerRuntimeMaps';
const VIZ_TREE_IMPORT = '@/domain/component-designer/DesignerRuntimeTreeWidgets';
const VIZ_TIMELINE_IMPORT = '@/domain/component-designer/DesignerRuntimeTimelineWidgets';
const VIZ_SHEET_IMPORT = '@/domain/component-designer/DesignerRuntimeSheet';
const VIZ_KANBAN_IMPORT = '@/domain/component-designer/DesignerRuntimeKanban';
export const CHART_TOOLBAR_IMPORT_SOURCE = '@/domain/component-designer/DesignerChartRuntimeToolbar';
export const FILTER_BAR_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimeFilterBar';
export const DASHBOARD_CANVAS_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimeDashboardCanvas';

const toJsxAttr = (value: string): string => jsxAttributeStringValue(value);

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  excludeKeys: ReadonlySet<string>,
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, { excludeKeys })
  : renderNodeJsxAttributes(node, { excludeKeys }));

/**
 * True when any chart OR non-chart viz widget (tree-view/tree-select/cascader/tree-combobox/
 * timeline/gantt/sheet/kanban) in the document has a Filters-step toolbar (search/dropdown/
 * date-range/refresh) enabled — controls whether the `DesignerChartRuntimeToolbar` import gets
 * emitted.
 *
 * Bug found (parity audit item 6): this only checked `chartPlan.chartListFetches`, never
 * `vizPlan.vizListFetches` — so a document with a bound toolbar on a non-chart viz widget but no
 * chart at all never even imported `DesignerChartRuntimeToolbar`, on top of `renderVizPaletteJsx`
 * never emitting a `toolbar={...}` attribute for any of those 8 widgets in the first place (see
 * `renderVizToolbarAttr` below).
 */
export const documentUsesChartToolbar = (bindingContext: TsxBindingRenderContext | undefined): boolean =>
  Boolean(bindingContext?.plan.chartPlan.chartListFetches.some((entry) => entry.toolbarConfig.enabled === true))
  || Boolean(bindingContext?.plan.vizPlan.vizListFetches.some((entry) => entry.toolbarConfig.enabled === true));

export const documentUsesDashboardFilterBar = (
  bindingContext: TsxBindingRenderContext | undefined,
): boolean => Boolean(bindingContext?.document && documentHasDashboardFilterBar(bindingContext.document));

/**
 * Bug found: the "Connect to API" wizard's Filters step (Search filter / Dropdown filters /
 * date range / Refresh button) was fully authorable and worked correctly in the live canvas and
 * interactive Preview (`designerVizRuntime.tsx`'s `resolveChartRenderProps` builds a real
 * `<DesignerChartRuntimeToolbar>`), but the exported/published TSX never rendered any toolbar at
 * all — `renderChartJsx` below never referenced `chartToolbarConfig`, so a published chart had no
 * way for an end user to filter/search it, even though the underlying `useDataFetch(url, {})`
 * call (`renderChartListFetchHookLines`, bindingCodegen.ts) already reactively re-fetches when the
 * URL template literal it embeds (built from `designerStore` values) changes — the fetch mechanism
 * was correctly reactive, but nothing in the exported page could ever change those store values.
 */
const renderChartToolbarAttr = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const chartFetches = bindingContext?.plan.chartPlan.chartListFetches.filter((entry) => entry.nodeId === node.id) ?? [];
  const chartFetch = chartFetches[0];
  if (!chartFetch || chartFetch.toolbarConfig.enabled !== true) {
    return '';
  }

  const configJson = JSON.stringify(chartFetch.toolbarConfig);
  const refreshBody = chartFetches.length > 1
    ? chartFetches.map((fetch) => `void refresh_${fetch.dataVar}();`).join(' ')
    : `void refresh_${chartFetch.dataVar}();`;
  const loadingExpression = chartFetches.length > 1
    ? `{${chartFetches.map((fetch) => `isLoading_${fetch.dataVar}`).join(' || ')}}`
    : `{isLoading_${chartFetch.dataVar}}`;
  return ` toolbar={<DesignerChartRuntimeToolbar nodeId={${JSON.stringify(node.id)}} config={${configJson}} designerStore={${DESIGNER_STORE_VAR}} mode="runtime" isLoading=${loadingExpression} onRefresh={() => { ${refreshBody} }} onStorePathChange={${DESIGNER_STORE_PATCH_VAR}} onFilterApplied={() => { ${refreshBody} }} />}`;
};

const renderChartFetchStateAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const chartFetches = bindingContext?.plan.chartPlan.chartListFetches.filter((entry) => entry.nodeId === node.id) ?? [];
  const chartFetch = chartFetches[0];
  if (!chartFetch) {
    return '';
  }
  const loadingExpression = chartFetches.length > 1
    ? `{${chartFetches.map((fetch) => `isLoading_${fetch.dataVar}`).join(' || ')}}`
    : `{isLoading_${chartFetch.dataVar}}`;
  const errorExpression = chartFetches.length > 1
    ? `{${chartFetches.map((fetch) => `Boolean(error_${fetch.dataVar})`).join(' || ')}}`
    : `{Boolean(error_${chartFetch.dataVar})}`;
  return ` chartListLoading=${loadingExpression} chartListError=${errorExpression}`;
};

const renderChartJsx = (
  componentName: string,
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  extraExclude: string[] = [],
): string => {
  const chartBound = isNodeChartDataBound(node);
  const excludeKeys = new Set([
    'title', 'data', 'seriesKeys', 'xAxisKey', 'showLegend', 'showGrid', 'height',
    'orientation', 'grouped', 'chartVariant', 'valueKey',
    'gaugeMin', 'gaugeMax', 'gaugeThresholds',
    'chartType', 'yAxisKey', 'sizeKey', 'colorKey',
    'showTrendline', 'showConversionRate', 'showConnectors', 'showVolume', 'maxValue',
    // Bug found: these two raw JSON bookkeeping props (read separately above via
    // parseDesignerChartFieldMapping/parseDesignerChartToolbarConfig, never as literal component
    // props) were never excluded from the generic attrs pass — they leaked onto
    // <DesignerVizBarChart chartFieldMapping="..." chartToolbarConfig="..." /> as unknown,
    // untyped JSX attributes the component doesn't declare at all.
    'chartFieldMapping', 'chartToolbarConfig', CHART_DATA_SOURCES_PROP,
    ...UI_CHART_ECHARTS_CHROME_KEYS,
    ...extraExclude,
  ]);
  const attrs = renderAttrs(node, bindingContext, excludeKeys);
  const title = readString(node.props.title);
  const data = readString(node.props.data, MOCK_CHART_SALES_Q1_JSON);
  const seriesKeys = readString(node.props.seriesKeys, 'revenue,cost');
  const xAxisKey = readString(node.props.xAxisKey, DEFAULT_CHART_X_AXIS_KEY);
  const showLegend = node.props.showLegend !== false;
  const showGrid = node.props.showGrid !== false;
  const height = readNumber(node.props.height, 280);
  const orientation = readString(node.props.orientation, 'vertical');
  const grouped = node.props.grouped !== false;
  const chartVariant = readString(node.props.chartVariant, 'line');
  const valueKey = readString(node.props.valueKey);
  const gaugeMin = typeof node.props.gaugeMin === 'number' ? node.props.gaugeMin : undefined;
  const gaugeMax = typeof node.props.gaugeMax === 'number' ? node.props.gaugeMax : undefined;
  const gaugeThresholdsRaw = typeof node.props.gaugeThresholds === 'string'
    ? node.props.gaugeThresholds.trim()
    : '';

  // Bug found (parity audit item 9 follow-up — root-cause dig): this passed the whole `node`
  // object where `resolveBoundAttributeForNodeProp` expects `node.id` (a string). At runtime,
  // its internal `item.nodeId === nodeId` lookups (bindingCodegen.ts) then compare a string to
  // an object — always false — so the bound-data lookup silently found nothing and returned
  // `''`. Since `''` is not null/undefined, `boundDataAttr ?? fallback` kept the empty string
  // instead of falling back to the static mock — meaning a BOUND chart exported with NO `data`
  // attribute at all (neither the real bound expression nor the static fallback), so every
  // published chart bound to a real API silently rendered with zero data.
  const boundDataAttr = chartBound && bindingContext
    ? resolveBoundAttributeForNodeProp(node.id, 'data', bindingContext)
    : null;
  const dataAttr = boundDataAttr ?? ` data={${JSON.stringify(data)}}`;
  const toolbarAttr = renderChartToolbarAttr(node, bindingContext);
  const fetchStateAttrs = renderChartFetchStateAttrs(node, bindingContext);

  // Bug found (parity audit item 10): the Chart wizard's per-series "Legend label"/"Color"
  // editors are real, work correctly in the live canvas/interactive Preview (resolved from the
  // same field mapping via resolveChartSeriesColorsFromMapping/resolveChartSeriesLabelsFromMapping
  // in DesignerRuntimeCharts.tsx), but Export never read node.props.chartFieldMapping at all for
  // this — a published chart always fell back to default index-based colors and raw field-name
  // labels, even when the user configured custom ones. Since the field mapping is fully known at
  // codegen time, resolve these the same way and emit them as real literal props (no runtime
  // re-derivation needed, unlike `data` which depends on live API rows).
  const chartEntries = resolveNodeChartDataSourceEntries(node);
  const fieldMapping = chartEntries.length > 1
    ? combineChartFieldMappings(chartEntries)
    : parseDesignerChartFieldMapping(node.props[CHART_FIELD_MAPPING_PROP]);
  const seriesColors = fieldMapping ? resolveChartSeriesColorsFromMapping(fieldMapping) : {};
  const seriesLabels = fieldMapping ? resolveChartSeriesLabelsFromMapping(fieldMapping) : {};
  const seriesColorsAttr = Object.keys(seriesColors).length > 0
    ? ` seriesColors={${JSON.stringify(seriesColors)}}`
    : '';
  const seriesLabelsAttr = Object.keys(seriesLabels).length > 0
    ? ` seriesLabels={${JSON.stringify(seriesLabels)}}`
    : '';
  const gaugeMinAttr = gaugeMin !== undefined ? ` gaugeMin={${gaugeMin}}` : '';
  const gaugeMaxAttr = gaugeMax !== undefined ? ` gaugeMax={${gaugeMax}}` : '';
  const gaugeThresholdsAttr = gaugeThresholdsRaw.length > 0
    ? ` gaugeThresholds={${gaugeThresholdsRaw}}`
    : fieldMapping && fieldMapping.chartType === 'gauge' && fieldMapping.gaugeThresholds
      ? ` gaugeThresholds={${JSON.stringify(fieldMapping.gaugeThresholds)}}`
      : '';
  const gaugeFromMappingMin = fieldMapping && fieldMapping.chartType === 'gauge' && typeof fieldMapping.gaugeMin === 'number' && gaugeMin === undefined
    ? ` gaugeMin={${fieldMapping.gaugeMin}}`
    : '';
  const gaugeFromMappingMax = fieldMapping && fieldMapping.chartType === 'gauge' && typeof fieldMapping.gaugeMax === 'number' && gaugeMax === undefined
    ? ` gaugeMax={${fieldMapping.gaugeMax}}`
    : '';

  return `<${componentName}${attrs}${dataAttr} seriesKeys=${toJsxAttr(seriesKeys)} xAxisKey=${toJsxAttr(xAxisKey)} showLegend={${showLegend}} showGrid={${showGrid}} height={${height}} orientation=${toJsxAttr(orientation)} grouped={${grouped}} chartVariant=${toJsxAttr(chartVariant)}${valueKey ? ` valueKey=${toJsxAttr(valueKey)}` : ''}${gaugeMinAttr}${gaugeFromMappingMin}${gaugeMaxAttr}${gaugeFromMappingMax}${gaugeThresholdsAttr} title=${toJsxAttr(title)}${seriesColorsAttr}${seriesLabelsAttr}${fetchStateAttrs}${toolbarAttr}${renderDesignerChartEchartsJsxAttrs(node.props)} />`;
};

const renderAdvancedChartJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const chartTypeRaw = readString(node.props.chartType, 'scatter');
  const chartType = isAdvancedChartType(chartTypeRaw) ? chartTypeRaw : 'scatter';
  const fixture = MOCK_ADVANCED_CHART_DATA_BY_TYPE[chartType] ?? MOCK_CHART_SALES_Q1_JSON;
  const excludeKeys = new Set([
    'title', 'data', 'seriesKeys', 'xAxisKey', 'yAxisKey', 'valueKey', 'sizeKey', 'colorKey',
    'showLegend', 'showGrid', 'height', 'chartType',
    'showTrendline', 'showConversionRate', 'showConnectors', 'showVolume', 'maxValue',
    'chartFieldMapping', 'chartToolbarConfig', CHART_DATA_SOURCES_PROP,
    'orientation', 'grouped', 'chartVariant', 'gaugeMin', 'gaugeMax', 'gaugeThresholds',
    ...UI_CHART_ECHARTS_CHROME_KEYS,
  ]);
  const attrs = renderAttrs(node, bindingContext, excludeKeys);
  const title = readString(node.props.title);
  const data = readString(node.props.data, fixture);
  const seriesKeys = readString(node.props.seriesKeys, chartType === 'radar' ? 'alpha,beta' : 'value');
  const xAxisKey = readString(node.props.xAxisKey, chartType === 'scatter' ? 'x' : 'label');
  const yAxisKey = readString(node.props.yAxisKey, 'y');
  const valueKey = readString(node.props.valueKey, 'value');
  const sizeKey = readString(node.props.sizeKey);
  const colorKey = readString(node.props.colorKey);
  const showLegend = node.props.showLegend !== false;
  const showGrid = node.props.showGrid !== false;
  const height = readNumber(node.props.height, 280);
  const showTrendline = node.props.showTrendline === true;
  const showConversionRate = node.props.showConversionRate !== false;
  const showConnectors = node.props.showConnectors !== false;
  const showVolume = node.props.showVolume !== false;
  const maxValue = typeof node.props.maxValue === 'number' ? node.props.maxValue : undefined;
  const chartBound = isNodeChartDataBound(node);
  const boundDataAttr = chartBound && bindingContext
    ? resolveBoundAttributeForNodeProp(node.id, 'data', bindingContext)
    : null;
  const dataAttr = boundDataAttr ?? ` data={${JSON.stringify(data)}}`;
  const toolbarAttr = renderChartToolbarAttr(node, bindingContext);
  const fetchStateAttrs = renderChartFetchStateAttrs(node, bindingContext);
  const sizeAttr = sizeKey ? ` sizeKey=${toJsxAttr(sizeKey)}` : '';
  const colorAttr = colorKey ? ` colorKey=${toJsxAttr(colorKey)}` : '';
  const maxAttr = maxValue !== undefined ? ` maxValue={${maxValue}}` : '';

  return `<DesignerVizAdvancedChart${attrs}${dataAttr} chartType=${toJsxAttr(chartType)} seriesKeys=${toJsxAttr(seriesKeys)} xAxisKey=${toJsxAttr(xAxisKey)} yAxisKey=${toJsxAttr(yAxisKey)} valueKey=${toJsxAttr(valueKey)}${sizeAttr}${colorAttr} showLegend={${showLegend}} showGrid={${showGrid}} height={${height}} showTrendline={${showTrendline}} showConversionRate={${showConversionRate}} showConnectors={${showConnectors}} showVolume={${showVolume}}${maxAttr} title=${toJsxAttr(title)}${fetchStateAttrs}${toolbarAttr}${renderDesignerChartEchartsJsxAttrs(node.props)} />`;
};

const renderMapPinJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const excludeKeys = new Set([
    'title', 'data', 'defaultCenter', 'defaultZoom', 'clusterMarkers',
    'tileProvider', 'mapboxAccessToken', 'height',
  ]);
  const attrs = renderAttrs(node, bindingContext, excludeKeys);
  const title = readString(node.props.title);
  const data = readString(node.props.data, MOCK_MAP_PINS_JSON);
  const defaultCenter = readString(node.props.defaultCenter, '[32.4279,53.688]');
  const defaultZoom = readNumber(node.props.defaultZoom, 5);
  const clusterMarkers = node.props.clusterMarkers === true;
  const tileProvider = readString(node.props.tileProvider, 'osm');
  const mapboxAccessToken = readString(node.props.mapboxAccessToken);
  const height = readNumber(node.props.height, 320);
  const tokenAttr = mapboxAccessToken ? ` mapboxAccessToken=${toJsxAttr(mapboxAccessToken)}` : '';
  return `<DesignerVizMapPin${attrs} data={${JSON.stringify(data)}} defaultCenter=${toJsxAttr(defaultCenter)} defaultZoom={${defaultZoom}} clusterMarkers={${clusterMarkers}} tileProvider=${toJsxAttr(tileProvider)}${tokenAttr} height={${height}} title=${toJsxAttr(title)} />`;
};

const renderMapChoroplethJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const excludeKeys = new Set([
    'title', 'data', 'regionLevel', 'colorScale', 'geoJsonSource',
    'defaultCenter', 'defaultZoom', 'tileProvider', 'mapboxAccessToken', 'height',
  ]);
  const attrs = renderAttrs(node, bindingContext, excludeKeys);
  const title = readString(node.props.title);
  const data = readString(node.props.data, MOCK_MAP_CHOROPLETH_JSON);
  const regionLevel = readString(node.props.regionLevel, 'province');
  const colorScale = readString(node.props.colorScale, '["#dbeafe","#1d4ed8"]');
  const geoJsonSource = readString(node.props.geoJsonSource);
  const defaultCenter = readString(node.props.defaultCenter, '[32.4279,53.688]');
  const defaultZoom = readNumber(node.props.defaultZoom, 5);
  const tileProvider = readString(node.props.tileProvider, 'osm');
  const mapboxAccessToken = readString(node.props.mapboxAccessToken);
  const height = readNumber(node.props.height, 320);
  const geoAttr = geoJsonSource ? ` geoJsonSource=${toJsxAttr(geoJsonSource)}` : '';
  const tokenAttr = mapboxAccessToken ? ` mapboxAccessToken=${toJsxAttr(mapboxAccessToken)}` : '';
  return `<DesignerVizMapChoropleth${attrs} data={${JSON.stringify(data)}} regionLevel=${toJsxAttr(regionLevel)} colorScale=${toJsxAttr(colorScale)}${geoAttr} defaultCenter=${toJsxAttr(defaultCenter)} defaultZoom={${defaultZoom}} tileProvider=${toJsxAttr(tileProvider)}${tokenAttr} height={${height}} title=${toJsxAttr(title)} />`;
};

/**
 * Bug found (parity audit item 6): the "Connect to API" wizard's Filters-step toolbar
 * (search/dropdown/date-range/refresh) is fully authorable for all 8 non-chart viz widgets
 * (tree-view/tree-select/cascader/tree-combobox/timeline/gantt/sheet/kanban) and works correctly
 * in the live canvas and interactive Preview (`buildVizWidgetToolbar` in
 * `designerVizRuntimeResolve.tsx` builds a real `<DesignerChartRuntimeToolbar>` and passes it as
 * the `toolbar` prop every one of these runtime components already accepts and renders). But
 * `renderVizPaletteJsx` never emitted a `toolbar={...}` attribute for any of them — only the
 * Chart branch (`renderChartToolbarAttr` above) did. Mirrors that function exactly, reading from
 * `plan.vizPlan.vizListFetches` instead of `plan.chartPlan.chartListFetches`.
 */
const renderVizToolbarAttr = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const vizFetch = bindingContext?.plan.vizPlan.vizListFetches.find((entry) => entry.nodeId === node.id);
  if (!vizFetch || vizFetch.toolbarConfig.enabled !== true) {
    return '';
  }

  const configJson = JSON.stringify(vizFetch.toolbarConfig);
  const dataVar = vizFetch.dataVar;
  return ` toolbar={<DesignerChartRuntimeToolbar nodeId={${JSON.stringify(node.id)}} config={${configJson}} designerStore={${DESIGNER_STORE_VAR}} mode="runtime" isLoading={isLoading_${dataVar}} onRefresh={() => { void refresh_${dataVar}(); }} onStorePathChange={${DESIGNER_STORE_PATCH_VAR}} onFilterApplied={() => { void refresh_${dataVar}(); }} />}`;
};

const renderVizFetchStateAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const vizFetch = bindingContext?.plan.vizPlan.vizListFetches.find((entry) => entry.nodeId === node.id);
  if (!vizFetch) {
    return '';
  }
  return ` vizListLoading={isLoading_${vizFetch.dataVar}} vizListError={Boolean(error_${vizFetch.dataVar})}`;
};

const renderBoundVizDataAttr = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  fallbackData: string,
): string => {
  const vizBound = Boolean(getNodeVizDataResourceRef(node));
  // Bug found (parity audit item 9 follow-up — same root cause as renderChartJsx above): passed
  // `node` instead of `node.id`, so bound-data lookups always failed to match and every bound
  // non-chart viz widget (tree-view/tree-select/cascader/tree-combobox/timeline/gantt/sheet/
  // kanban) exported with NO `data` attribute at all, not even the static fallback.
  const boundDataAttr = vizBound && bindingContext
    ? resolveBoundAttributeForNodeProp(node.id, 'data', bindingContext)
    : null;
  return boundDataAttr ?? ` data={${JSON.stringify(fallbackData)}}`;
};

export const renderVizPaletteJsx = (
  paletteItemId: string,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
  renderedChildren?: string,
): string | null => {
  switch (paletteItemId) {
    case 'dashboard.filter-bar': {
      const filterBarConfig = parseDashboardFilterBarConfig(node.props[DASHBOARD_FILTER_BAR_CONFIG_PROP]);
      const attrs = renderAttrs(node, bindingContext, new Set([DASHBOARD_FILTER_BAR_CONFIG_PROP]));
      const configJson = JSON.stringify(filterBarConfig);
      return `<DesignerRuntimeFilterBar${attrs} config={${configJson}} designerStore={${DESIGNER_STORE_VAR}} mode="runtime" onStorePathChange={${DESIGNER_STORE_PATCH_VAR}} />`;
    }
    case 'viz.dashboard-canvas': {
      const attrs = renderAttrs(node, bindingContext, new Set([
        DASHBOARD_CANVAS_CONFIG_PROP,
        DASHBOARD_PERSONALIZABLE_PROP,
      ]));
      const body = renderedChildren?.trim() ? renderedChildren : '  <div />';
      return `<DesignerRuntimeDashboardCanvas${attrs}>\n${body}\n</DesignerRuntimeDashboardCanvas>`;
    }
    case 'viz.chart-bar':
      return renderChartJsx('DesignerVizBarChart', node, bindingContext);
    case 'viz.chart-line':
      return renderChartJsx('DesignerVizLineChart', node, bindingContext);
    case 'viz.chart-pie':
      return renderChartJsx('DesignerVizPieChart', node, bindingContext);
    case 'viz.chart-sparkline':
      return renderChartJsx('DesignerVizSparkline', node, bindingContext, ['title', 'showLegend', 'showGrid', 'orientation', 'grouped']);
    case 'viz.chart':
      return renderAdvancedChartJsx(node, bindingContext);
    case 'viz.map-pin':
      return renderMapPinJsx(node, bindingContext);
    case 'viz.map-choropleth':
      return renderMapChoroplethJsx(node, bindingContext);
    case 'viz.tree-view': {
      const attrs = renderAttrs(node, bindingContext, new Set(['data', 'vizFieldMapping', 'vizToolbarConfig']));
      const data = readString(node.props.data, MOCK_ORG_TREE_JSON);
      return `<DesignerVizTreeView${attrs}${renderBoundVizDataAttr(node, bindingContext, data)}${renderVizFetchStateAttrs(node, bindingContext)}${renderVizToolbarAttr(node, bindingContext)} />`;
    }
    case 'viz.tree-select':
    case 'viz.cascader':
    case 'viz.tree-combobox': {
      const componentName = paletteItemId === 'viz.tree-select'
        ? 'DesignerVizTreeSelect'
        : paletteItemId === 'viz.cascader'
          ? 'DesignerVizCascader'
          : 'DesignerVizTreeCombobox';
      const attrs = renderAttrs(node, bindingContext, new Set(['label', 'placeholder', 'data', 'vizFieldMapping', 'vizToolbarConfig']));
      const label = readString(node.props.label, 'Field');
      const placeholder = readString(node.props.placeholder, 'Select…');
      const data = readString(node.props.data, MOCK_ORG_TREE_JSON);
      return `<${componentName}${attrs} label=${toJsxAttr(label)} placeholder=${toJsxAttr(placeholder)}${renderBoundVizDataAttr(node, bindingContext, data)}${renderVizFetchStateAttrs(node, bindingContext)}${renderVizToolbarAttr(node, bindingContext)} />`;
    }
    case 'viz.timeline':
    case 'viz.gantt': {
      const componentName = paletteItemId === 'viz.timeline' ? 'DesignerVizTimeline' : 'DesignerVizGantt';
      const attrs = renderAttrs(node, bindingContext, new Set(['title', 'data', 'vizFieldMapping', 'vizToolbarConfig']));
      const title = readString(node.props.title, paletteItemId === 'viz.timeline' ? 'Timeline' : 'Gantt');
      const data = readString(node.props.data, MOCK_PROJECT_TIMELINE_JSON);
      return `<${componentName}${attrs} title=${toJsxAttr(title)}${renderBoundVizDataAttr(node, bindingContext, data)}${renderVizFetchStateAttrs(node, bindingContext)}${renderVizToolbarAttr(node, bindingContext)} />`;
    }
    case 'viz.sheet': {
      const attrs = renderAttrs(node, bindingContext, new Set(['title', 'data', 'vizFieldMapping', 'vizToolbarConfig']));
      const title = readString(node.props.title, 'Spreadsheet');
      const data = readString(node.props.data, MOCK_SHEET_DATA_JSON);
      return `<DesignerVizSheet${attrs} title=${toJsxAttr(title)}${renderBoundVizDataAttr(node, bindingContext, data)}${renderVizFetchStateAttrs(node, bindingContext)}${renderVizToolbarAttr(node, bindingContext)} />`;
    }
    case 'viz.kanban': {
      const attrs = renderAttrs(node, bindingContext, new Set(['title', 'data', 'vizFieldMapping', 'vizToolbarConfig']));
      const title = readString(node.props.title, 'Kanban');
      const data = readString(node.props.data, MOCK_KANBAN_BOARD_JSON);
      const hasCardMoveBinding = bindingContext?.plan.eventBindings.some(
        (item) => item.nodeId === node.id && item.targetEvent === 'onCardMove',
      );
      const interactiveAttr = hasCardMoveBinding ? ' interactive' : '';
      return `<DesignerVizKanban${attrs}${interactiveAttr} title=${toJsxAttr(title)}${renderBoundVizDataAttr(node, bindingContext, data)}${renderVizFetchStateAttrs(node, bindingContext)}${renderVizToolbarAttr(node, bindingContext)} />`;
    }
    default:
      return null;
  }
};

export const resolveVizImportSource = (paletteItemId: string): string | null => {
  if (paletteItemId === 'dashboard.filter-bar') return FILTER_BAR_IMPORT_SOURCE;
  if (paletteItemId === 'viz.dashboard-canvas') return DASHBOARD_CANVAS_IMPORT_SOURCE;
  if (paletteItemId === 'viz.chart') return VIZ_ADVANCED_CHART_IMPORT;
  if (paletteItemId.startsWith('viz.chart-')) return VIZ_IMPORT_SOURCE;
  if (paletteItemId === 'viz.map-pin' || paletteItemId === 'viz.map-choropleth') return VIZ_MAP_IMPORT;
  if (paletteItemId === 'viz.tree-view' || paletteItemId === 'viz.tree-select' || paletteItemId === 'viz.cascader' || paletteItemId === 'viz.tree-combobox') {
    return VIZ_TREE_IMPORT;
  }
  if (paletteItemId === 'viz.timeline' || paletteItemId === 'viz.gantt') return VIZ_TIMELINE_IMPORT;
  if (paletteItemId === 'viz.sheet') return VIZ_SHEET_IMPORT;
  if (paletteItemId === 'viz.kanban') return VIZ_KANBAN_IMPORT;
  return null;
};

export const resolveVizImportSymbol = (paletteItemId: string): string | null => {
  const map: Record<string, string> = {
    'dashboard.filter-bar': 'DesignerRuntimeFilterBar',
    'viz.dashboard-canvas': 'DesignerRuntimeDashboardCanvas',
    'viz.chart-bar': 'DesignerVizBarChart',
    'viz.chart-line': 'DesignerVizLineChart',
    'viz.chart-pie': 'DesignerVizPieChart',
    'viz.chart-sparkline': 'DesignerVizSparkline',
    'viz.chart': 'DesignerVizAdvancedChart',
    'viz.map-pin': 'DesignerVizMapPin',
    'viz.map-choropleth': 'DesignerVizMapChoropleth',
    'viz.tree-view': 'DesignerVizTreeView',
    'viz.tree-select': 'DesignerVizTreeSelect',
    'viz.cascader': 'DesignerVizCascader',
    'viz.tree-combobox': 'DesignerVizTreeCombobox',
    'viz.timeline': 'DesignerVizTimeline',
    'viz.gantt': 'DesignerVizGantt',
    'viz.sheet': 'DesignerVizSheet',
    'viz.kanban': 'DesignerVizKanban',
  };
  return map[paletteItemId] ?? null;
};
