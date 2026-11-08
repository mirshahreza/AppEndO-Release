import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiAdvancedChart,
  UiBarChart,
  UiChartGauge,
  UiEchartsHost,
  UiInput,
  UiLineChart,
  UiPieChart,
  UiSelect,
  UiSparkline,
  composeUiChartOption,
  pickUiEchartsRuntimeProps,
  resolveUiChartEchartsPassthrough,
  resolveUiChartEchartsTemplate,
  UI_CHART_ANIMATION_DURATIONS,
  UI_CHART_ANIMATION_EASINGS,
  UI_CHART_AXIS_POINTERS,
  UI_CHART_BACKGROUNDS,
  UI_CHART_BAR_GAPS,
  UI_CHART_BLEND_MODES,
  UI_CHART_BOUNDARY_GAPS,
  UI_CHART_DATA_ZOOM_TYPES,
  UI_CHART_ECHARTS_TEMPLATES,
  UI_CHART_EMPHASIS_FOCUS,
  UI_CHART_LABEL_ROTATES,
  UI_CHART_LEGEND_POSITIONS,
  UI_CHART_LEGEND_TYPES,
  UI_CHART_LINE_STEPS,
  UI_CHART_ORIENTS,
  UI_CHART_RENDERERS,
  UI_CHART_ROSE_TYPES,
  UI_CHART_SELECTED_MODES,
  UI_CHART_TEMPLATE_GROUPS,
  UI_CHART_TITLE_ALIGNS,
  UI_CHART_TITLE_VERTICAL_ALIGNS,
  UI_CHART_TOOLTIP_ORDERS,
  UI_CHART_TOOLTIP_TRIGGER_ON,
  UI_CHART_TOOLTIP_TRIGGERS,
  UI_CHART_VISUAL_MAP_TYPES,
  DEFAULT_UI_CHART_ECHARTS_CHROME,
  type AdvancedChartType,
  type UiChartDataRow,
  type UiChartEchartsChrome,
  type UiChartPaletteId,
  type UiChartTemplateId,
} from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { useFillPreviewHeight } from '../hooks/useFillPreviewHeight';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

export const CHART_KIND_OPTIONS = [
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'sparkline',
  'gauge',
  'scatter',
  'radar',
  'heatmap',
  'funnel',
  'waterfall',
  'treemap',
  'sunburst',
  'sankey',
  'candlestick',
  'boxplot',
] as const;
export type ChartKind = (typeof CHART_KIND_OPTIONS)[number];
type ChartPurpose = 'comparison' | 'trend' | 'part-to-whole' | 'distribution' | 'relationship' | 'kpi';
type ChartState = 'default' | 'loading' | 'empty' | 'insufficient' | 'error' | 'filtered';
type ChartAlternative = 'table' | 'narrative' | 'both';

export const CHART_PURPOSE_KINDS: Record<ChartPurpose, readonly ChartKind[]> = {
  comparison: ['bar', 'radar', 'waterfall'],
  trend: ['line', 'area', 'sparkline', 'candlestick'],
  'part-to-whole': ['pie', 'donut', 'treemap', 'sunburst', 'funnel'],
  distribution: ['bar', 'boxplot', 'heatmap'],
  relationship: ['scatter', 'sankey'],
  kpi: ['gauge', 'sparkline'],
};

const ADVANCED_KINDS = new Set<string>([
  'scatter', 'radar', 'heatmap', 'funnel', 'waterfall', 'treemap', 'sunburst', 'sankey', 'candlestick', 'boxplot',
]);

export function applyChartPurpose(
  config: ChartBaseComponentsConfig,
  purpose: ChartPurpose,
): ChartBaseComponentsConfig {
  const kinds = CHART_PURPOSE_KINDS[purpose];
  const kind = kinds.includes(config.kind) ? config.kind : kinds[0];
  return { ...config, purpose, kind, template: 'custom' };
}

export function applyChartKind(
  config: ChartBaseComponentsConfig,
  kind: ChartKind,
): ChartBaseComponentsConfig {
  const purpose = CHART_PURPOSE_KINDS[config.purpose].includes(kind)
    ? config.purpose
    : (Object.keys(CHART_PURPOSE_KINDS) as ChartPurpose[]).find((entry) =>
      CHART_PURPOSE_KINDS[entry].includes(kind)
    ) ?? config.purpose;
  return { ...config, kind, purpose, template: 'custom' };
}

export function applyChartTemplate(
  config: ChartBaseComponentsConfig,
  templateId: UiChartTemplateId,
): ChartBaseComponentsConfig {
  const template = resolveUiChartEchartsTemplate(templateId);
  if (templateId === 'custom') {
    return { ...config, template: 'custom' };
  }
  const {
    kind,
    purpose,
    orientation,
    stacked,
    smooth,
    showLegend,
    showGrid,
    showTakeaway,
    ...chrome
  } = template.config;
  return {
    ...config,
    ...chrome,
    template: templateId,
    kind,
    purpose,
    orientation: orientation ?? 'vertical',
    stacked: stacked ?? false,
    smooth: smooth ?? true,
    showLegend: showLegend ?? (kind !== 'gauge' && kind !== 'sparkline'),
    showGrid: showGrid ?? true,
    showTakeaway: showTakeaway ?? true,
  };
}

export function resolveChartDisplayControls(kind: ChartKind) {
  const cartesian = kind === 'bar' || kind === 'line' || kind === 'area' || kind === 'scatter'
    || kind === 'heatmap' || kind === 'waterfall' || kind === 'candlestick' || kind === 'boxplot';
  const polarLike = kind === 'pie' || kind === 'donut' || kind === 'radar' || kind === 'funnel'
    || kind === 'treemap' || kind === 'sunburst' || kind === 'sankey' || kind === 'gauge';
  return {
    legend: kind !== 'gauge' && kind !== 'sparkline',
    grid: cartesian,
    takeaway: true,
    orientation: kind === 'bar',
    stacked: kind === 'bar' || kind === 'area',
    smooth: kind === 'line' || kind === 'area' || kind === 'sparkline',
    zoom: cartesian && kind !== 'boxplot' && kind !== 'waterfall',
    toolbox: kind !== 'sparkline' && kind !== 'gauge',
    labels: kind === 'pie' || kind === 'donut' || kind === 'funnel' || kind === 'bar' || kind === 'heatmap',
    sparklineVariant: kind === 'sparkline',
    tooltip: kind !== 'gauge',
    legendPosition: kind !== 'gauge' && kind !== 'sparkline',
    magicType: kind === 'bar' || kind === 'line' || kind === 'area',
    marks: kind === 'bar' || kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'candlestick',
    axisPointer: cartesian,
    animation: true,
    darkMode: true,
    renderer: kind !== 'gauge',
    title: true,
    axisNames: cartesian,
    visualMap: cartesian || kind === 'heatmap' || kind === 'treemap',
    brush: cartesian,
    rose: kind === 'pie' || kind === 'donut',
    step: kind === 'line' || kind === 'area',
    symbol: kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'sparkline',
    barGap: kind === 'bar',
    selectedMode: !polarLike || kind === 'pie' || kind === 'donut' || kind === 'funnel',
  };
}

export function resolveChartPreviewModel(config: ChartBaseComponentsConfig): { component: string; kind: ChartKind } {
  if (config.kind === 'bar') return { component: 'UiBarChart', kind: config.kind };
  if (config.kind === 'line' || config.kind === 'area') return { component: 'UiLineChart', kind: config.kind };
  if (config.kind === 'pie' || config.kind === 'donut') return { component: 'UiPieChart', kind: config.kind };
  if (config.kind === 'sparkline') return { component: 'UiSparkline', kind: config.kind };
  if (config.kind === 'gauge') return { component: 'UiChartGauge', kind: config.kind };
  return { component: 'UiAdvancedChart', kind: config.kind };
}

const SAMPLE_ROWS: UiChartDataRow[] = [
  { label: 'Jan', revenue: 4200, cost: 2800 },
  { label: 'Feb', revenue: 5100, cost: 3000 },
  { label: 'Mar', revenue: 4800, cost: 3100 },
  { label: 'Apr', revenue: 6200, cost: 3400 },
  { label: 'May', revenue: 7100, cost: 3600 },
];

const SAMPLE_SCATTER: UiChartDataRow[] = [
  { x: 12, y: 40, size: 80, label: 'A' },
  { x: 28, y: 55, size: 120, label: 'B' },
  { x: 45, y: 32, size: 60, label: 'C' },
  { x: 60, y: 70, size: 150, label: 'D' },
  { x: 75, y: 48, size: 90, label: 'E' },
];

const SAMPLE_RADAR: UiChartDataRow[] = [
  { label: 'Quality', alpha: 80, beta: 65 },
  { label: 'Speed', alpha: 70, beta: 85 },
  { label: 'Cost', alpha: 55, beta: 60 },
  { label: 'Support', alpha: 90, beta: 70 },
  { label: 'Reliability', alpha: 75, beta: 88 },
];

const SAMPLE_HEATMAP: UiChartDataRow[] = [
  { x: 'Mon', y: 'Morning', value: 12 },
  { x: 'Mon', y: 'Afternoon', value: 22 },
  { x: 'Tue', y: 'Morning', value: 18 },
  { x: 'Tue', y: 'Afternoon', value: 30 },
  { x: 'Wed', y: 'Morning', value: 9 },
  { x: 'Wed', y: 'Afternoon', value: 25 },
];

const SAMPLE_FUNNEL: UiChartDataRow[] = [
  { label: 'Visitors', value: 1000 },
  { label: 'Leads', value: 420 },
  { label: 'Trials', value: 180 },
  { label: 'Paid', value: 64 },
];

const SAMPLE_WATERFALL: UiChartDataRow[] = [
  { label: 'Start', value: 100, kind: 'total' },
  { label: 'Sales', value: 40 },
  { label: 'Refunds', value: -15 },
  { label: 'Fees', value: -8 },
  { label: 'End', value: 117, kind: 'total' },
];

const SAMPLE_TREEMAP: UiChartDataRow[] = [
  { label: 'Electronics', value: 420 },
  { label: 'Apparel', value: 260 },
  { label: 'Home', value: 180 },
  { label: 'Grocery', value: 140 },
];

const SAMPLE_SUNBURST: UiChartDataRow[] = [
  { id: 'electronics', label: 'Electronics', value: 420 },
  { id: 'phones', label: 'Phones', value: 200, parent: 'electronics' },
  { id: 'laptops', label: 'Laptops', value: 220, parent: 'electronics' },
  { id: 'apparel', label: 'Apparel', value: 260 },
  { id: 'shirts', label: 'Shirts', value: 140, parent: 'apparel' },
  { id: 'shoes', label: 'Shoes', value: 120, parent: 'apparel' },
];

const SAMPLE_SANKEY: UiChartDataRow[] = [
  { source: 'Traffic', target: 'Product', value: 120 },
  { source: 'Traffic', target: 'Blog', value: 80 },
  { source: 'Product', target: 'Checkout', value: 55 },
  { source: 'Blog', target: 'Checkout', value: 20 },
  { source: 'Checkout', target: 'Paid', value: 40 },
];

const SAMPLE_CANDLESTICK: UiChartDataRow[] = [
  { label: 'Mon', open: 100, high: 112, low: 95, close: 108, volume: 1200 },
  { label: 'Tue', open: 108, high: 118, low: 104, close: 110, volume: 980 },
  { label: 'Wed', open: 110, high: 115, low: 98, close: 101, volume: 1400 },
  { label: 'Thu', open: 101, high: 109, low: 99, close: 107, volume: 1100 },
];

const SAMPLE_BOXPLOT: UiChartDataRow[] = [
  { group: 'North', value: 12 },
  { group: 'North', value: 18 },
  { group: 'North', value: 22 },
  { group: 'North', value: 25 },
  { group: 'South', value: 8 },
  { group: 'South', value: 14 },
  { group: 'South', value: 16 },
  { group: 'South', value: 30 },
  { group: 'East', value: 20 },
  { group: 'East', value: 21 },
  { group: 'East', value: 23 },
  { group: 'East', value: 24 },
];

const applyState = <T,>(rows: T[], state: ChartState): T[] => {
  if (state === 'empty') return [];
  if (state === 'insufficient') return rows.slice(0, 1);
  if (state === 'filtered') return rows.slice(-Math.min(3, rows.length));
  return rows;
};

export function resolveChartRowsForState(state: ChartState): UiChartDataRow[] {
  return applyState(SAMPLE_ROWS, state);
}

const resolveKindRows = (kind: ChartKind, state: ChartState): UiChartDataRow[] => {
  if (kind === 'scatter') return applyState(SAMPLE_SCATTER, state);
  if (kind === 'radar') return applyState(SAMPLE_RADAR, state);
  if (kind === 'heatmap') return applyState(SAMPLE_HEATMAP, state);
  if (kind === 'funnel') return applyState(SAMPLE_FUNNEL, state);
  if (kind === 'waterfall') return applyState(SAMPLE_WATERFALL, state);
  if (kind === 'treemap') return applyState(SAMPLE_TREEMAP, state);
  if (kind === 'sunburst') return applyState(SAMPLE_SUNBURST, state);
  if (kind === 'sankey') return applyState(SAMPLE_SANKEY, state);
  if (kind === 'candlestick') return applyState(SAMPLE_CANDLESTICK, state);
  if (kind === 'boxplot') return applyState(SAMPLE_BOXPLOT, state);
  return resolveChartRowsForState(state);
};

export type ChartBaseComponentsConfig = Required<UiChartEchartsChrome> & {
  template: UiChartTemplateId;
  purpose: ChartPurpose;
  kind: ChartKind;
  height: 'sm' | 'md' | 'lg' | 'fill';
  showLegend: boolean;
  showGrid: boolean;
  showTakeaway: boolean;
  orientation: 'vertical' | 'horizontal';
  stacked: boolean;
  smooth: boolean;
  palette: UiChartPaletteId;
  sparklineVariant: 'line' | 'bar';
  interaction: 'tooltip' | 'select' | 'drilldown';
  state: ChartState;
  alternative: ChartAlternative;
  viewport: 'desktop' | 'tablet' | 'phone';
};

export const DEFAULT_CHART_BASE_COMPONENTS_CONFIG: ChartBaseComponentsConfig = {
  ...DEFAULT_UI_CHART_ECHARTS_CHROME,
  template: 'custom',
  purpose: 'comparison',
  kind: 'bar',
  height: 'md',
  showLegend: true,
  showGrid: true,
  showTakeaway: true,
  orientation: 'vertical',
  stacked: false,
  smooth: true,
  palette: 'categorical',
  sparklineVariant: 'line',
  interaction: 'tooltip',
  state: 'default',
  alternative: 'both',
  viewport: 'desktop',
};

const HEIGHT_PX = { sm: 180, md: 280, lg: 380, fill: 420 } as const;

const TAKEAWAY_BY_KIND: Partial<Record<ChartKind, string>> = {
  bar: 'Takeaway: revenue grew faster than cost across the period.',
  line: 'Takeaway: the upward trend holds after a March dip.',
  area: 'Takeaway: stacked volume shows revenue pulling away from cost.',
  pie: 'Takeaway: May is the largest slice of the period.',
  donut: 'Takeaway: later months dominate the mix.',
  sparkline: 'Takeaway: compact trend is still readable at a glance.',
  gauge: 'Takeaway: attainment is above the midpoint of the target range.',
  scatter: 'Takeaway: larger bubbles sit toward higher Y values.',
  radar: 'Takeaway: Support leads Alpha; Speed leads Beta.',
  heatmap: 'Takeaway: Tuesday afternoon is the hottest cell.',
  funnel: 'Takeaway: conversion from visitors to paid is 6.4%.',
  waterfall: 'Takeaway: sales gains outweigh refunds and fees.',
  treemap: 'Takeaway: Electronics is the largest category.',
  sunburst: 'Takeaway: Phones and Laptops split Electronics almost evenly.',
  sankey: 'Takeaway: most paid volume still flows through Product.',
  candlestick: 'Takeaway: Wednesday was the only down close.',
  boxplot: 'Takeaway: South has the widest spread and the high outlier.',
};

const ChartPreview: React.FC<{
  config: ChartBaseComponentsConfig;
  rows: UiChartDataRow[];
  height: number;
  onPointClick?: (detail: { category: string; seriesKey: string }) => void;
}> = ({ config, rows, height, onPointClick }) => {
  const template = resolveUiChartEchartsTemplate(config.template);
  const passthrough = resolveUiChartEchartsPassthrough(config);
  if (template.option) {
    return (
      <UiEchartsHost
        option={composeUiChartOption(template.option, {
          ...passthrough,
          legend: {
            ...(passthrough.legend && typeof passthrough.legend === 'object' ? passthrough.legend : {}),
            show: config.showLegend,
          },
        })}
        height={height}
        chartType={config.kind}
        ariaLabel={template.label}
        onDataPointClick={onPointClick}
        {...pickUiEchartsRuntimeProps(passthrough)}
      />
    );
  }
  const chrome = {
    showLegend: config.showLegend,
    showGrid: config.showGrid,
    palette: config.palette,
    height,
    onDataPointClick: onPointClick,
    ...passthrough,
  };
  if (config.kind === 'bar') {
    return <UiBarChart data={rows} seriesKeys={['revenue', 'cost']} orientation={config.orientation} grouped={!config.stacked} {...chrome} />;
  }
  if (config.kind === 'line' || config.kind === 'area') {
    return <UiLineChart data={rows} seriesKeys={['revenue', 'cost']} variant={config.kind} smooth={config.smooth} stacked={config.kind === 'area' && config.stacked} {...chrome} />;
  }
  if (config.kind === 'sparkline') {
    return (
      <UiSparkline
        data={rows}
        seriesKey="revenue"
        height={Math.min(height, 96)}
        variant={config.sparklineVariant}
        onDataPointClick={onPointClick}
        {...passthrough}
      />
    );
  }
  if (config.kind === 'gauge') {
    return (
      <UiChartGauge
        value={72}
        label="Target attainment"
        onClick={onPointClick ? () => onPointClick({ category: 'Target attainment', seriesKey: '72%' }) : undefined}
        {...passthrough}
      />
    );
  }
  if (config.kind === 'pie' || config.kind === 'donut') {
    return <UiPieChart data={rows} seriesKeys={['revenue']} variant={config.kind} {...chrome} />;
  }
  const chartType = config.kind as AdvancedChartType;
  const seriesKeys = config.kind === 'radar' ? ['alpha', 'beta'] : config.kind === 'scatter' ? ['y'] : ['value'];
  const xAxisKey = config.kind === 'scatter' || config.kind === 'heatmap'
    ? 'x'
    : config.kind === 'boxplot'
      ? 'group'
      : 'label';
  return (
    <UiAdvancedChart
      chartType={chartType}
      data={rows}
      seriesKeys={seriesKeys}
      xAxisKey={xAxisKey}
      yAxisKey="y"
      valueKey="value"
      sizeKey={config.kind === 'scatter' ? 'size' : undefined}
      showTrendline={config.kind === 'scatter'}
      {...chrome}
    />
  );
};

const ChartConfigSelect: React.FC<{
  label: string;
  hint?: string;
  value: string;
  options: readonly (string | number)[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}> = ({ label, hint, value, options, onChange, ariaLabel }) => (
  <FormField label={label} hint={hint} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={value}
      onChange={(event) => onChange(event.target.value)} ariaLabel={ariaLabel ?? label}>
      {options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
    </UiSelect>
  </FormField>
);

const ChartConfigToggle: React.FC<{
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
  ariaLabel?: string;
}> = ({ label, hint, value, onChange, yesLabel = 'on', noLabel = 'off', ariaLabel }) => (
  <FormField label={label} hint={hint} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={value ? 'yes' : 'no'}
      onChange={(event) => onChange(event.target.value === 'yes')} ariaLabel={ariaLabel ?? label}>
      <option value="yes">{yesLabel}</option>
      <option value="no">{noLabel}</option>
    </UiSelect>
  </FormField>
);

const ChartConfigText: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}> = ({ label, hint, value, onChange, ariaLabel }) => (
  <FormField label={label} hint={hint} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiInput size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={value}
      onChange={(event) => onChange(event.target.value)} ariaLabel={ariaLabel ?? label} />
  </FormField>
);

export const ChartBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ChartBaseComponentsConfig>(DEFAULT_CHART_BASE_COMPONENTS_CONFIG);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const displayControls = resolveChartDisplayControls(config.kind);
  React.useEffect(() => {
    setSelectedPoint(null);
  }, [config.interaction, config.kind, config.state]);
  const template = resolveUiChartEchartsTemplate(config.template);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      template: config.template,
      kind: config.kind,
      height: config.height,
      showLegend: config.showLegend,
      showGrid: config.showGrid,
      showLabels: config.showLabels,
      orientation: config.orientation,
      stacked: config.stacked,
      smooth: config.smooth,
      dataZoom: config.dataZoom,
      dataZoomType: config.dataZoomType,
      showToolbox: config.showToolbox,
      toolboxMagicType: config.toolboxMagicType,
      toolboxDataView: config.toolboxDataView,
      showTooltip: config.showTooltip,
      tooltipTrigger: config.tooltipTrigger,
      tooltipTriggerOn: config.tooltipTriggerOn,
      legendPosition: config.legendPosition,
      legendType: config.legendType,
      animation: config.animation,
      animationDuration: config.animationDuration,
      animationEasing: config.animationEasing,
      darkMode: config.darkMode,
      renderer: config.renderer,
      showMarkPoint: config.showMarkPoint,
      showMarkLine: config.showMarkLine,
      showMarkArea: config.showMarkArea,
      axisPointer: config.axisPointer,
      showTitle: config.showTitle,
      titleText: config.titleText,
      visualMap: config.visualMap,
      brush: config.brush,
      roseType: config.roseType,
      lineStep: config.lineStep,
      palette: config.palette,
      interaction: [config.interaction],
    },
    composition: {
      purpose: config.purpose,
      template: config.template,
      elements: ['axes', config.showGrid && 'grid', config.showLegend && 'legend', 'tooltip', config.showTakeaway && 'takeaway'].filter(Boolean),
      accessibleAlternative: config.alternative,
    },
    demo: { fixtures: { data: 'purpose-default' }, scenarios: { state: config.state, viewport: config.viewport } },
  }, null, 2), [config]);
  const rows = resolveKindRows(config.kind, config.state);
  const fillHeight = config.height === 'fill';
  const fillPreview = useFillPreviewHeight(fillHeight, HEIGHT_PX.fill);
  const height = fillHeight
    ? fillPreview.height
    : (config.viewport === 'phone' ? Math.min(HEIGHT_PX[config.height], 220) : HEIGHT_PX[config.height]);
  const onPointClick = config.interaction === 'tooltip' ? undefined : (detail: { category: string; seriesKey: string }) => {
    setSelectedPoint(`${detail.category} · ${detail.seriesKey}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="chart" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CHART_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Template" description="Ready Apache ECharts configs. Pick one, then tune options." tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField
                  label="Template"
                  hint="Official-style ECharts examples for a fast start. Custom keeps the current kind and options."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  reserveHintSlot={false}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.template}
                    onChange={(event) => setConfig((current) => applyChartTemplate(current, event.target.value as UiChartTemplateId))}
                    ariaLabel="Chart template"
                  >
                    {UI_CHART_TEMPLATE_GROUPS.flatMap((group) =>
                      UI_CHART_ECHARTS_TEMPLATES.filter((entry) => entry.group === group).map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      )),
                    )}
                  </UiSelect>
                </FormField>
                <p className="text-[11px] leading-4 text-slate-500">{template.description}</p>
              </div>
            </FormSection>
            <FormSection title="Chart" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <ChartConfigSelect label="Purpose" value={config.purpose} options={Object.keys(CHART_PURPOSE_KINDS)}
                  onChange={(value) => setConfig((current) => applyChartPurpose(current, value as ChartPurpose))} ariaLabel="Chart purpose" />
                <ChartConfigSelect label="Kind" value={config.kind} options={CHART_KIND_OPTIONS}
                  onChange={(value) => setConfig((current) => applyChartKind(current, value as ChartKind))} ariaLabel="Chart kind" />
                <ChartConfigSelect label="Height" value={config.height} options={['sm', 'md', 'lg', 'fill']}
                  onChange={(value) => setConfig((current) => ({ ...current, height: value as ChartBaseComponentsConfig['height'] }))} />
                <ChartConfigSelect label="State" value={config.state} options={['default', 'loading', 'empty', 'insufficient', 'error', 'filtered']}
                  onChange={(value) => setConfig((current) => ({ ...current, state: value as ChartState }))} />
                <ChartConfigSelect label="Alternative" value={config.alternative} options={['table', 'narrative', 'both']}
                  onChange={(value) => setConfig((current) => ({ ...current, alternative: value as ChartAlternative }))} />
                <ChartConfigSelect label="Interaction" value={config.interaction} options={['tooltip', 'select', 'drilldown']}
                  onChange={(value) => setConfig((current) => ({ ...current, interaction: value as ChartBaseComponentsConfig['interaction'] }))} />
                <ChartConfigSelect label="Viewport" value={config.viewport} options={['desktop', 'tablet', 'phone']}
                  onChange={(value) => setConfig((current) => ({ ...current, viewport: value as ChartBaseComponentsConfig['viewport'] }))} />
              </div>
            </FormSection>
            <FormSection title="Title" description="ECharts title component." tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.title ? (
                  <>
                    <ChartConfigToggle label="Title" hint="title.show" value={config.showTitle}
                      onChange={(value) => setConfig((current) => ({ ...current, showTitle: value }))} yesLabel="show" noLabel="hide" />
                    <ChartConfigText label="Text" hint="title.text" value={config.titleText}
                      onChange={(value) => setConfig((current) => ({ ...current, titleText: value, showTitle: value.trim().length > 0 ? true : current.showTitle }))} />
                    <ChartConfigText label="Subtext" hint="title.subtext" value={config.titleSubtext}
                      onChange={(value) => setConfig((current) => ({ ...current, titleSubtext: value }))} />
                    <ChartConfigSelect label="Left" hint="title.left" value={config.titleLeft} options={UI_CHART_TITLE_ALIGNS}
                      onChange={(value) => setConfig((current) => ({ ...current, titleLeft: value as ChartBaseComponentsConfig['titleLeft'] }))} />
                    <ChartConfigSelect label="Top" hint="title.top" value={config.titleTop} options={UI_CHART_TITLE_VERTICAL_ALIGNS}
                      onChange={(value) => setConfig((current) => ({ ...current, titleTop: value as ChartBaseComponentsConfig['titleTop'] }))} />
                  </>
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Legend & grid" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <ChartConfigSelect label="Palette" value={config.palette} options={['categorical', 'sequential', 'diverging', 'semantic']}
                  onChange={(value) => setConfig((current) => ({ ...current, palette: value as UiChartPaletteId }))} />
                {displayControls.legend ? (
                  <ChartConfigToggle label="Legend" hint="legend.show" value={config.showLegend}
                    onChange={(value) => setConfig((current) => ({ ...current, showLegend: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.legendPosition ? (
                  <ChartConfigSelect label="Legend position" hint="legend.left / top" value={config.legendPosition} options={UI_CHART_LEGEND_POSITIONS}
                    onChange={(value) => setConfig((current) => ({ ...current, legendPosition: value as ChartBaseComponentsConfig['legendPosition'] }))} />
                ) : null}
                {displayControls.legendPosition ? (
                  <ChartConfigSelect label="Legend type" hint="legend.type" value={config.legendType} options={UI_CHART_LEGEND_TYPES}
                    onChange={(value) => setConfig((current) => ({ ...current, legendType: value as ChartBaseComponentsConfig['legendType'] }))} />
                ) : null}
                {displayControls.legendPosition ? (
                  <ChartConfigSelect label="Legend select" hint="legend.selectedMode" value={config.legendSelectedMode} options={UI_CHART_SELECTED_MODES}
                    onChange={(value) => setConfig((current) => ({ ...current, legendSelectedMode: value as ChartBaseComponentsConfig['legendSelectedMode'] }))} />
                ) : null}
                {displayControls.grid ? (
                  <ChartConfigToggle label="Grid lines" hint="xAxis.splitLine" value={config.showGrid}
                    onChange={(value) => setConfig((current) => ({ ...current, showGrid: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.grid ? (
                  <ChartConfigToggle label="Contain label" hint="grid.containLabel" value={config.gridContainLabel}
                    onChange={(value) => setConfig((current) => ({ ...current, gridContainLabel: value }))} />
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Tooltip & axis" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.tooltip ? (
                  <ChartConfigToggle label="Tooltip" hint="tooltip.show" value={config.showTooltip}
                    onChange={(value) => setConfig((current) => ({ ...current, showTooltip: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.tooltip && config.showTooltip ? (
                  <ChartConfigSelect label="Trigger" hint="tooltip.trigger" value={config.tooltipTrigger} options={UI_CHART_TOOLTIP_TRIGGERS}
                    onChange={(value) => setConfig((current) => ({ ...current, tooltipTrigger: value as ChartBaseComponentsConfig['tooltipTrigger'] }))} />
                ) : null}
                {displayControls.tooltip && config.showTooltip ? (
                  <ChartConfigSelect label="Trigger on" hint="tooltip.triggerOn" value={config.tooltipTriggerOn} options={UI_CHART_TOOLTIP_TRIGGER_ON}
                    onChange={(value) => setConfig((current) => ({ ...current, tooltipTriggerOn: value as ChartBaseComponentsConfig['tooltipTriggerOn'] }))} />
                ) : null}
                {displayControls.tooltip && config.showTooltip ? (
                  <ChartConfigToggle label="Confine" hint="tooltip.confine" value={config.tooltipConfine}
                    onChange={(value) => setConfig((current) => ({ ...current, tooltipConfine: value }))} />
                ) : null}
                {displayControls.tooltip && config.showTooltip ? (
                  <ChartConfigSelect label="Order" hint="tooltip.order" value={config.tooltipOrder} options={UI_CHART_TOOLTIP_ORDERS}
                    onChange={(value) => setConfig((current) => ({ ...current, tooltipOrder: value as ChartBaseComponentsConfig['tooltipOrder'] }))} />
                ) : null}
                {displayControls.axisPointer ? (
                  <ChartConfigSelect label="Axis pointer" hint="axisPointer.type" value={config.axisPointer} options={UI_CHART_AXIS_POINTERS}
                    onChange={(value) => setConfig((current) => ({ ...current, axisPointer: value as ChartBaseComponentsConfig['axisPointer'] }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigText label="X axis name" hint="xAxis.name" value={config.xAxisName}
                    onChange={(value) => setConfig((current) => ({ ...current, xAxisName: value }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigText label="Y axis name" hint="yAxis.name" value={config.yAxisName}
                    onChange={(value) => setConfig((current) => ({ ...current, yAxisName: value }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigToggle label="Inverse axis" hint="xAxis.inverse" value={config.axisInverse}
                    onChange={(value) => setConfig((current) => ({ ...current, axisInverse: value }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigToggle label="Split area" hint="xAxis.splitArea" value={config.axisSplitArea}
                    onChange={(value) => setConfig((current) => ({ ...current, axisSplitArea: value }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigSelect label="Label rotate" hint="xAxis.axisLabel.rotate" value={String(config.axisLabelRotate)} options={UI_CHART_LABEL_ROTATES}
                    onChange={(value) => setConfig((current) => ({ ...current, axisLabelRotate: Number(value) as ChartBaseComponentsConfig['axisLabelRotate'] }))} />
                ) : null}
                {displayControls.axisNames ? (
                  <ChartConfigSelect label="Boundary gap" hint="xAxis.boundaryGap" value={config.boundaryGap} options={UI_CHART_BOUNDARY_GAPS}
                    onChange={(value) => setConfig((current) => ({ ...current, boundaryGap: value as ChartBaseComponentsConfig['boundaryGap'] }))} />
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Zoom & visualMap" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.zoom ? (
                  <ChartConfigToggle label="Data zoom" hint="dataZoom" value={config.dataZoom}
                    onChange={(value) => setConfig((current) => ({ ...current, dataZoom: value }))} yesLabel="on" noLabel="off" />
                ) : null}
                {displayControls.zoom && config.dataZoom ? (
                  <ChartConfigSelect label="Zoom type" hint="dataZoom.type" value={config.dataZoomType} options={UI_CHART_DATA_ZOOM_TYPES}
                    onChange={(value) => setConfig((current) => ({ ...current, dataZoomType: value as ChartBaseComponentsConfig['dataZoomType'] }))} />
                ) : null}
                {displayControls.zoom && config.dataZoom ? (
                  <ChartConfigSelect label="Start %" hint="dataZoom.start" value={String(config.dataZoomStart)} options={[0, 20, 40, 60]}
                    onChange={(value) => setConfig((current) => ({ ...current, dataZoomStart: Number(value) }))} />
                ) : null}
                {displayControls.zoom && config.dataZoom ? (
                  <ChartConfigSelect label="End %" hint="dataZoom.end" value={String(config.dataZoomEnd)} options={[40, 60, 80, 100]}
                    onChange={(value) => setConfig((current) => ({ ...current, dataZoomEnd: Number(value) }))} />
                ) : null}
                {displayControls.visualMap ? (
                  <ChartConfigToggle label="Visual map" hint="visualMap" value={config.visualMap}
                    onChange={(value) => setConfig((current) => ({ ...current, visualMap: value }))} />
                ) : null}
                {displayControls.visualMap && config.visualMap ? (
                  <ChartConfigSelect label="Map type" hint="visualMap.type" value={config.visualMapType} options={UI_CHART_VISUAL_MAP_TYPES}
                    onChange={(value) => setConfig((current) => ({ ...current, visualMapType: value as ChartBaseComponentsConfig['visualMapType'] }))} />
                ) : null}
                {displayControls.visualMap && config.visualMap ? (
                  <ChartConfigSelect label="Map orient" hint="visualMap.orient" value={config.visualMapOrient} options={UI_CHART_ORIENTS}
                    onChange={(value) => setConfig((current) => ({ ...current, visualMapOrient: value as ChartBaseComponentsConfig['visualMapOrient'] }))} />
                ) : null}
                {displayControls.brush ? (
                  <ChartConfigToggle label="Brush" hint="brush" value={config.brush}
                    onChange={(value) => setConfig((current) => ({ ...current, brush: value }))} />
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Toolbox & marks" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.toolbox ? (
                  <ChartConfigToggle label="Toolbox" hint="toolbox.show" value={config.showToolbox}
                    onChange={(value) => setConfig((current) => ({ ...current, showToolbox: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.toolbox && config.showToolbox ? (
                  <ChartConfigSelect label="Toolbox orient" hint="toolbox.orient" value={config.toolboxOrient} options={UI_CHART_ORIENTS}
                    onChange={(value) => setConfig((current) => ({ ...current, toolboxOrient: value as ChartBaseComponentsConfig['toolboxOrient'] }))} />
                ) : null}
                {displayControls.toolbox && config.showToolbox ? (
                  <ChartConfigToggle label="Data view" hint="toolbox.feature.dataView" value={config.toolboxDataView}
                    onChange={(value) => setConfig((current) => ({ ...current, toolboxDataView: value }))} />
                ) : null}
                {displayControls.toolbox && config.showToolbox && displayControls.magicType ? (
                  <ChartConfigToggle label="Magic type" hint="toolbox.feature.magicType" value={config.toolboxMagicType}
                    onChange={(value) => setConfig((current) => ({ ...current, toolboxMagicType: value }))} yesLabel="line / bar / stack" noLabel="off" />
                ) : null}
                {displayControls.marks ? (
                  <ChartConfigToggle label="Mark max / min" hint="series.markPoint" value={config.showMarkPoint}
                    onChange={(value) => setConfig((current) => ({ ...current, showMarkPoint: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.marks ? (
                  <ChartConfigToggle label="Mark average" hint="series.markLine" value={config.showMarkLine}
                    onChange={(value) => setConfig((current) => ({ ...current, showMarkLine: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.marks ? (
                  <ChartConfigToggle label="Mark area" hint="series.markArea" value={config.showMarkArea}
                    onChange={(value) => setConfig((current) => ({ ...current, showMarkArea: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Series" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.labels ? (
                  <ChartConfigToggle label="Labels" hint="series.label.show" value={config.showLabels}
                    onChange={(value) => setConfig((current) => ({ ...current, showLabels: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.orientation ? (
                  <ChartConfigSelect label="Orientation" value={config.orientation} options={['vertical', 'horizontal']}
                    onChange={(value) => setConfig((current) => ({ ...current, orientation: value as 'vertical' | 'horizontal' }))} />
                ) : null}
                {displayControls.stacked ? (
                  <ChartConfigToggle label="Stacked" value={config.stacked}
                    onChange={(value) => setConfig((current) => ({ ...current, stacked: value }))} yesLabel="stacked" noLabel="grouped" />
                ) : null}
                {displayControls.smooth ? (
                  <ChartConfigToggle label="Smooth" hint="series.smooth" value={config.smooth}
                    onChange={(value) => setConfig((current) => ({ ...current, smooth: value }))} yesLabel="smooth" noLabel="linear" />
                ) : null}
                {displayControls.sparklineVariant ? (
                  <ChartConfigSelect label="Sparkline" value={config.sparklineVariant} options={['line', 'bar']}
                    onChange={(value) => setConfig((current) => ({ ...current, sparklineVariant: value as 'line' | 'bar' }))} />
                ) : null}
                {displayControls.step ? (
                  <ChartConfigSelect label="Step" hint="series.step" value={config.lineStep} options={UI_CHART_LINE_STEPS}
                    onChange={(value) => setConfig((current) => ({ ...current, lineStep: value as ChartBaseComponentsConfig['lineStep'] }))} />
                ) : null}
                {displayControls.symbol ? (
                  <ChartConfigToggle label="Symbols" hint="series.showSymbol" value={config.showSymbol}
                    onChange={(value) => setConfig((current) => ({ ...current, showSymbol: value }))} yesLabel="show" noLabel="hide" />
                ) : null}
                {displayControls.symbol ? (
                  <ChartConfigToggle label="Connect nulls" hint="series.connectNulls" value={config.connectNulls}
                    onChange={(value) => setConfig((current) => ({ ...current, connectNulls: value }))} />
                ) : null}
                {displayControls.rose ? (
                  <ChartConfigSelect label="Rose type" hint="series.roseType" value={config.roseType} options={UI_CHART_ROSE_TYPES}
                    onChange={(value) => setConfig((current) => ({ ...current, roseType: value as ChartBaseComponentsConfig['roseType'] }))} />
                ) : null}
                {displayControls.barGap ? (
                  <ChartConfigSelect label="Bar gap" hint="series.barGap" value={config.barGap} options={UI_CHART_BAR_GAPS}
                    onChange={(value) => setConfig((current) => ({ ...current, barGap: value as ChartBaseComponentsConfig['barGap'] }))} />
                ) : null}
                {displayControls.selectedMode ? (
                  <ChartConfigSelect label="Select mode" hint="series.selectedMode" value={config.selectedMode} options={UI_CHART_SELECTED_MODES}
                    onChange={(value) => setConfig((current) => ({ ...current, selectedMode: value as ChartBaseComponentsConfig['selectedMode'] }))} />
                ) : null}
                <ChartConfigSelect label="Emphasis" hint="series.emphasis.focus" value={config.emphasisFocus} options={UI_CHART_EMPHASIS_FOCUS}
                  onChange={(value) => setConfig((current) => ({ ...current, emphasisFocus: value as ChartBaseComponentsConfig['emphasisFocus'] }))} />
                {displayControls.grid ? (
                  <ChartConfigToggle label="Large mode" hint="series.large" value={config.large}
                    onChange={(value) => setConfig((current) => ({ ...current, large: value }))} />
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Animation & global" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {displayControls.animation ? (
                  <ChartConfigToggle label="Animation" hint="animation" value={config.animation}
                    onChange={(value) => setConfig((current) => ({ ...current, animation: value }))} />
                ) : null}
                {displayControls.animation && config.animation ? (
                  <ChartConfigSelect label="Duration" hint="animationDuration" value={String(config.animationDuration)} options={UI_CHART_ANIMATION_DURATIONS}
                    onChange={(value) => setConfig((current) => ({ ...current, animationDuration: Number(value) as ChartBaseComponentsConfig['animationDuration'] }))} />
                ) : null}
                {displayControls.animation && config.animation ? (
                  <ChartConfigSelect label="Easing" hint="animationEasing" value={config.animationEasing} options={UI_CHART_ANIMATION_EASINGS}
                    onChange={(value) => setConfig((current) => ({ ...current, animationEasing: value as ChartBaseComponentsConfig['animationEasing'] }))} />
                ) : null}
                {displayControls.darkMode ? (
                  <ChartConfigToggle label="Dark mode" hint="darkMode" value={config.darkMode}
                    onChange={(value) => setConfig((current) => ({ ...current, darkMode: value }))} />
                ) : null}
                {displayControls.renderer ? (
                  <ChartConfigSelect label="Renderer" hint="init.renderer" value={config.renderer} options={UI_CHART_RENDERERS}
                    onChange={(value) => setConfig((current) => ({ ...current, renderer: value as ChartBaseComponentsConfig['renderer'] }))} />
                ) : null}
                <ChartConfigSelect label="Background" hint="backgroundColor" value={config.background} options={UI_CHART_BACKGROUNDS}
                  onChange={(value) => setConfig((current) => ({ ...current, background: value as ChartBaseComponentsConfig['background'] }))} />
                <ChartConfigSelect label="Blend" hint="blendMode" value={config.blendMode} options={UI_CHART_BLEND_MODES}
                  onChange={(value) => setConfig((current) => ({ ...current, blendMode: value as ChartBaseComponentsConfig['blendMode'] }))} />
                <ChartConfigToggle label="Use UTC" hint="useUTC" value={config.useUTC}
                  onChange={(value) => setConfig((current) => ({ ...current, useUTC: value }))} />
                <ChartConfigToggle label="Aria" hint="aria.enabled" value={config.ariaEnabled}
                  onChange={(value) => setConfig((current) => ({ ...current, ariaEnabled: value }))} />
                <ChartConfigToggle label="Aria decal" hint="aria.decal" value={config.ariaDecal}
                  onChange={(value) => setConfig((current) => ({ ...current, ariaDecal: value }))} />
                <ChartConfigToggle label="Takeaway" value={config.showTakeaway}
                  onChange={(value) => setConfig((current) => ({ ...current, showTakeaway: value }))} yesLabel="show" noLabel="hide" />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="chart" fill={fillHeight}>
          <div
            className={cn(
            BASE_COMPONENTS_PREVIEW_BODY_CLASS,
            fillHeight && 'min-h-0',
            config.viewport === 'phone' && 'mx-auto max-w-[390px]',
            config.viewport === 'tablet' && 'mx-auto max-w-[760px]',
          )}>
            <div className="mb-3 shrink-0">
              {config.showTitle || config.titleText.trim() ? null : (
                <h3 className="text-sm font-bold text-slate-800">Revenue performance</h3>
              )}
              {config.showTakeaway ? <p className="text-xs text-slate-600">{TAKEAWAY_BY_KIND[config.kind] ?? 'Takeaway: read the plot with the table or narrative below.'}</p> : null}
            </div>
            {config.state === 'loading' ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500" aria-busy="true">Loading chart…</div>
            ) : config.state === 'error' ? (
              <div className="flex h-48 items-center justify-center text-sm text-rose-700" role="alert">Chart data could not be loaded.</div>
            ) : config.state === 'empty' ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">No chart data is available.</div>
            ) : (
              <div ref={fillHeight ? fillPreview.hostRef : undefined} className={fillHeight ? 'min-h-0 flex-1' : undefined}>
                <ChartPreview config={config} rows={rows} height={height} onPointClick={onPointClick} />
              </div>
            )}
            {config.state === 'insufficient' ? <p className="mt-2 text-xs font-medium text-amber-700" role="status">Only one data point is available; trend confidence is limited.</p> : null}
            {config.state === 'filtered' ? <p className="mt-2 text-xs font-medium text-cyan-700" role="status">Filtered to the active three-month range.</p> : null}
            {selectedPoint ? <p className="mt-2 text-xs font-medium text-indigo-700" role="status">{config.interaction === 'drilldown' ? 'Drilled into' : 'Selected'}: {selectedPoint}</p> : null}
            {(config.alternative === 'narrative' || config.alternative === 'both') ? (
              <p className="mt-4 text-xs text-slate-600">Accessible summary: May revenue was 7,100, up 69% from January; costs rose 29%.</p>
            ) : null}
            {(config.alternative === 'table' || config.alternative === 'both') ? (
              <ChartDataTable kind={config.kind} rows={rows} />
            ) : null}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};

const ChartDataTable: React.FC<{ kind: ChartKind; rows: UiChartDataRow[] }> = ({ kind, rows }) => {
  if (kind === 'sankey') {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Sankey flow data used by the chart</caption>
          <thead><tr><th className="text-start">Source</th><th className="text-start">Target</th><th className="text-end">Value</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.source}-${row.target}-${index}`}><td>{row.source}</td><td>{row.target}</td><td className="text-end">{row.value}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (kind === 'heatmap') {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Heatmap cell data used by the chart</caption>
          <thead><tr><th className="text-start">X</th><th className="text-start">Y</th><th className="text-end">Value</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.x}-${row.y}-${index}`}><td>{row.x}</td><td>{row.y}</td><td className="text-end">{row.value}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (kind === 'scatter') {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Scatter data used by the chart</caption>
          <thead><tr><th className="text-start">Label</th><th className="text-end">X</th><th className="text-end">Y</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={String(row.label)}><td>{row.label}</td><td className="text-end">{row.x}</td><td className="text-end">{row.y}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (kind === 'candlestick') {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">OHLC data used by the chart</caption>
          <thead><tr><th className="text-start">Period</th><th className="text-end">Open</th><th className="text-end">High</th><th className="text-end">Low</th><th className="text-end">Close</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={String(row.label)}><td>{row.label}</td><td className="text-end">{row.open}</td><td className="text-end">{row.high}</td><td className="text-end">{row.low}</td><td className="text-end">{row.close}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  const valueColumn = ADVANCED_KINDS.has(kind) && kind !== 'radar' ? 'value' : 'revenue';
  const secondColumn = kind === 'radar' ? 'beta' : kind === 'bar' || kind === 'line' || kind === 'area' ? 'cost' : null;
  const firstColumn = kind === 'radar' ? 'alpha' : valueColumn;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Data used by the chart</caption>
        <thead>
          <tr>
            <th className="text-start">{kind === 'boxplot' ? 'Group' : 'Label'}</th>
            <th className="text-end">{firstColumn}</th>
            {secondColumn ? <th className="text-end">{secondColumn}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.label ?? row.group ?? index)}>
              <td>{row.label ?? row.group}</td>
              <td className="text-end">{row[firstColumn]}</td>
              {secondColumn ? <td className="text-end">{row[secondColumn]}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
