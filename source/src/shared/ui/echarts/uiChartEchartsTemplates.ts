import type { EChartsOption } from 'echarts';
import { UI_CHART_SERIES_COLORS } from '../uiChartModel';
import {
  DEFAULT_UI_CHART_ECHARTS_CHROME,
  type UiChartEchartsChrome,
} from './uiChartEchartsChrome';
import { echartsTextStyle } from './echartsTheme';

export const UI_CHART_TEMPLATE_GROUPS = [
  'bar',
  'line',
  'pie',
  'scatter',
  'statistical',
  'hierarchical',
  'flow',
  'kpi',
  'special',
] as const;
export type UiChartTemplateGroup = (typeof UI_CHART_TEMPLATE_GROUPS)[number];

export const UI_CHART_TEMPLATE_IDS = [
  'custom',
  'grouped-bar',
  'stacked-bar',
  'horizontal-bar',
  'mixed-line-bar',
  'bar-marks',
  'polar-bar',
  'pictorial-bar',
  'smooth-line',
  'stacked-area',
  'step-line',
  'line-zoom',
  'pie',
  'donut',
  'nightingale',
  'nested-pie',
  'scatter-bubble',
  'effect-scatter',
  'radar',
  'heatmap',
  'calendar-heatmap',
  'boxplot',
  'funnel',
  'waterfall',
  'treemap',
  'sunburst',
  'sankey',
  'candlestick',
  'gauge',
  'sparkline',
  'graph-force',
  'tree',
  'theme-river',
  'visual-map',
  'brush-select',
  'scroll-legend',
  'dark-dashboard',
  'crosshair',
] as const;
export type UiChartTemplateId = (typeof UI_CHART_TEMPLATE_IDS)[number];

export type UiChartTemplateKind =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'sparkline'
  | 'gauge'
  | 'scatter'
  | 'radar'
  | 'heatmap'
  | 'funnel'
  | 'waterfall'
  | 'treemap'
  | 'sunburst'
  | 'sankey'
  | 'candlestick'
  | 'boxplot';

export type UiChartTemplatePurpose =
  | 'comparison'
  | 'trend'
  | 'part-to-whole'
  | 'distribution'
  | 'relationship'
  | 'kpi';

export type UiChartTemplateConfig = UiChartEchartsChrome & {
  kind: UiChartTemplateKind;
  purpose: UiChartTemplatePurpose;
  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  smooth?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  showTakeaway?: boolean;
};

export type UiChartEchartsTemplate = {
  id: UiChartTemplateId;
  label: string;
  group: UiChartTemplateGroup;
  description: string;
  config: UiChartTemplateConfig;
  option?: EChartsOption;
};

const C = UI_CHART_SERIES_COLORS;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May'] as const;
const revenue = [4200, 5100, 4800, 6200, 7100];
const cost = [2800, 3000, 3100, 3400, 3600];

const base = (
  kind: UiChartTemplateKind,
  purpose: UiChartTemplatePurpose,
  patch: UiChartEchartsChrome & Partial<Pick<UiChartTemplateConfig, 'orientation' | 'stacked' | 'smooth' | 'showLegend' | 'showGrid' | 'showTakeaway'>> = {},
): UiChartTemplateConfig => ({
  ...DEFAULT_UI_CHART_ECHARTS_CHROME,
  kind,
  purpose,
  showLegend: kind !== 'gauge' && kind !== 'sparkline',
  showGrid: kind === 'bar' || kind === 'line' || kind === 'area' || kind === 'scatter'
    || kind === 'heatmap' || kind === 'waterfall' || kind === 'candlestick' || kind === 'boxplot',
  showTakeaway: true,
  orientation: 'vertical',
  stacked: false,
  smooth: true,
  ...patch,
});

const cartesianChrome = (): Pick<EChartsOption, 'textStyle' | 'tooltip' | 'legend' | 'grid'> => ({
  textStyle: echartsTextStyle,
  tooltip: { trigger: 'axis', confine: true },
  legend: { bottom: 0, textStyle: echartsTextStyle },
  grid: { left: 48, right: 20, top: 36, bottom: 48 },
});

export const UI_CHART_ECHARTS_TEMPLATES: readonly UiChartEchartsTemplate[] = [
  {
    id: 'custom',
    label: 'Custom',
    group: 'bar',
    description: 'Start from the current kind and tune ECharts options directly.',
    config: base('bar', 'comparison'),
  },
  {
    id: 'grouped-bar',
    label: 'Grouped bar',
    group: 'bar',
    description: 'Side-by-side categories for comparison.',
    config: base('bar', 'comparison', { showTitle: true, titleText: 'Grouped bar', titleLeft: 'center' }),
  },
  {
    id: 'stacked-bar',
    label: 'Stacked bar',
    group: 'bar',
    description: 'Parts of a total across categories.',
    config: base('bar', 'comparison', { stacked: true, showTitle: true, titleText: 'Stacked bar', titleLeft: 'center' }),
  },
  {
    id: 'horizontal-bar',
    label: 'Horizontal bar',
    group: 'bar',
    description: 'Category labels stay readable on the axis.',
    config: base('bar', 'comparison', {
      orientation: 'horizontal',
      gridContainLabel: true,
      showTitle: true,
      titleText: 'Horizontal bar',
      titleLeft: 'center',
    }),
  },
  {
    id: 'mixed-line-bar',
    label: 'Mixed line and bar',
    group: 'bar',
    description: 'Bars for volume with a line overlay for a second series.',
    config: base('bar', 'comparison', { showTitle: true, titleText: 'Mixed line and bar', titleLeft: 'center' }),
    option: {
      color: [...C],
      ...cartesianChrome(),
      title: { text: 'Mixed line and bar', left: 'center' },
      xAxis: { type: 'category', data: [...months] },
      yAxis: [
        { type: 'value', name: 'Revenue' },
        { type: 'value', name: 'Cost' },
      ],
      series: [
        { type: 'bar', name: 'Revenue', data: revenue },
        { type: 'line', name: 'Cost', yAxisIndex: 1, smooth: true, data: cost },
      ],
    },
  },
  {
    id: 'bar-marks',
    label: 'Bar with marks',
    group: 'bar',
    description: 'Max, min, and average markers on a comparison plot.',
    config: base('bar', 'comparison', {
      showMarkPoint: true,
      showMarkLine: true,
      showTitle: true,
      titleText: 'Bar with marks',
      titleLeft: 'center',
    }),
  },
  {
    id: 'polar-bar',
    label: 'Polar bar',
    group: 'bar',
    description: 'Bar series on a polar coordinate system.',
    config: base('bar', 'comparison', { showLegend: false, showTitle: true, titleText: 'Polar bar', titleLeft: 'center' }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Polar bar', left: 'center' },
      tooltip: { trigger: 'axis', confine: true },
      polar: { radius: [16, '72%'] },
      angleAxis: { type: 'category', data: [...months] },
      radiusAxis: {},
      series: [{ type: 'bar', coordinateSystem: 'polar', name: 'Revenue', data: revenue }],
    },
  },
  {
    id: 'pictorial-bar',
    label: 'Pictorial bar',
    group: 'bar',
    description: 'Symbolic bars for a compact KPI comparison.',
    config: base('bar', 'comparison', { showLegend: false, showTitle: true, titleText: 'Pictorial bar', titleLeft: 'center' }),
    option: {
      color: [...C],
      ...cartesianChrome(),
      title: { text: 'Pictorial bar', left: 'center' },
      xAxis: { type: 'category', data: ['Alpha', 'Beta', 'Gamma', 'Delta'], splitLine: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      series: [{
        type: 'pictorialBar',
        symbol: 'roundRect',
        symbolRepeat: true,
        symbolMargin: 2,
        symbolClip: true,
        symbolSize: [18, 8],
        data: [42, 58, 36, 71],
      }],
    },
  },
  {
    id: 'smooth-line',
    label: 'Smooth line',
    group: 'line',
    description: 'Smoothed trend with axis tooltip.',
    config: base('line', 'trend', { smooth: true, showTitle: true, titleText: 'Smooth line', titleLeft: 'center' }),
  },
  {
    id: 'stacked-area',
    label: 'Stacked area',
    group: 'line',
    description: 'Filled series that add to a total over time.',
    config: base('area', 'trend', { stacked: true, smooth: true, showTitle: true, titleText: 'Stacked area', titleLeft: 'center' }),
  },
  {
    id: 'step-line',
    label: 'Step line',
    group: 'line',
    description: 'Values hold until the next category.',
    config: base('line', 'trend', {
      smooth: false,
      lineStep: 'middle',
      showSymbol: false,
      showTitle: true,
      titleText: 'Step line',
      titleLeft: 'center',
    }),
  },
  {
    id: 'line-zoom',
    label: 'Zoomable line',
    group: 'line',
    description: 'Inside plus slider dataZoom for long series.',
    config: base('line', 'trend', {
      dataZoom: true,
      dataZoomType: 'both',
      showToolbox: true,
      showTitle: true,
      titleText: 'Zoomable line',
      titleLeft: 'center',
    }),
  },
  {
    id: 'pie',
    label: 'Pie',
    group: 'pie',
    description: 'Part-to-whole slices with item tooltip.',
    config: base('pie', 'part-to-whole', {
      showLabels: true,
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Pie',
      titleLeft: 'center',
    }),
  },
  {
    id: 'donut',
    label: 'Donut',
    group: 'pie',
    description: 'Hollow pie that leaves room for a center label.',
    config: base('donut', 'part-to-whole', {
      showLabels: true,
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Donut',
      titleLeft: 'center',
    }),
  },
  {
    id: 'nightingale',
    label: 'Nightingale rose',
    group: 'pie',
    description: 'Radius encodes value on a rose pie.',
    config: base('pie', 'part-to-whole', {
      roseType: 'radius',
      showLabels: true,
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Nightingale rose',
      titleLeft: 'center',
    }),
  },
  {
    id: 'nested-pie',
    label: 'Nested pie',
    group: 'pie',
    description: 'Two rings for parent and child mix.',
    config: base('pie', 'part-to-whole', { tooltipTrigger: 'item', showTitle: true, titleText: 'Nested pie', titleLeft: 'center' }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Nested pie', left: 'center' },
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: 0, textStyle: echartsTextStyle },
      series: [
        {
          type: 'pie',
          radius: [0, '42%'],
          label: { position: 'inner', fontSize: 10 },
          data: [
            { name: 'Electronics', value: 420 },
            { name: 'Apparel', value: 260 },
          ],
        },
        {
          type: 'pie',
          radius: ['52%', '72%'],
          data: [
            { name: 'Phones', value: 200 },
            { name: 'Laptops', value: 220 },
            { name: 'Shirts', value: 140 },
            { name: 'Shoes', value: 120 },
          ],
        },
      ],
    },
  },
  {
    id: 'scatter-bubble',
    label: 'Bubble scatter',
    group: 'scatter',
    description: 'X, Y, and size encoded together.',
    config: base('scatter', 'relationship', { showTitle: true, titleText: 'Bubble scatter', titleLeft: 'center' }),
  },
  {
    id: 'effect-scatter',
    label: 'Effect scatter',
    group: 'scatter',
    description: 'Ripple emphasis on notable points.',
    config: base('scatter', 'relationship', { showTitle: true, titleText: 'Effect scatter', titleLeft: 'center' }),
    option: {
      color: [...C],
      ...cartesianChrome(),
      title: { text: 'Effect scatter', left: 'center' },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      series: [{
        type: 'effectScatter',
        symbolSize: (value: number[]) => Math.max(12, Number(value[2] ?? 20) / 6),
        data: [
          [12, 40, 80],
          [28, 55, 120],
          [45, 32, 60],
          [60, 70, 150],
          [75, 48, 90],
        ],
      }],
    },
  },
  {
    id: 'radar',
    label: 'Radar',
    group: 'statistical',
    description: 'Multi-axis profile comparison.',
    config: base('radar', 'comparison', { showTitle: true, titleText: 'Radar', titleLeft: 'center' }),
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    group: 'statistical',
    description: 'Intensity across two categories.',
    config: base('heatmap', 'distribution', {
      visualMap: true,
      visualMapOrient: 'vertical',
      showTitle: true,
      titleText: 'Heatmap',
      titleLeft: 'center',
    }),
  },
  {
    id: 'calendar-heatmap',
    label: 'Calendar heatmap',
    group: 'statistical',
    description: 'Daily intensity on a calendar component.',
    config: base('heatmap', 'distribution', {
      visualMap: true,
      visualMapOrient: 'horizontal',
      showLegend: false,
      showTitle: true,
      titleText: 'Calendar heatmap',
      titleLeft: 'center',
    }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Calendar heatmap', left: 'center' },
      tooltip: { trigger: 'item', confine: true },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: 30,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        inRange: { color: ['#e0f2fe', '#0ea5e9', '#0c4a6e'] },
      },
      calendar: {
        top: 56,
        left: 36,
        right: 16,
        cellSize: [18, 18],
        range: '2026-01',
        itemStyle: { borderWidth: 1, borderColor: '#e2e8f0' },
        yearLabel: { show: false },
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: Array.from({ length: 31 }, (_, index) => [
          `2026-01-${String(index + 1).padStart(2, '0')}`,
          Math.round((Math.sin(index / 3) + 1) * 12),
        ]),
      }],
    },
  },
  {
    id: 'boxplot',
    label: 'Boxplot',
    group: 'statistical',
    description: 'Spread, median, and outliers by group.',
    config: base('boxplot', 'distribution', { showTitle: true, titleText: 'Boxplot', titleLeft: 'center' }),
  },
  {
    id: 'funnel',
    label: 'Funnel',
    group: 'flow',
    description: 'Conversion stages from wide to narrow.',
    config: base('funnel', 'part-to-whole', {
      showLabels: true,
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Funnel',
      titleLeft: 'center',
    }),
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    group: 'bar',
    description: 'Gains and losses that build to a total.',
    config: base('waterfall', 'comparison', { showTitle: true, titleText: 'Waterfall', titleLeft: 'center' }),
  },
  {
    id: 'treemap',
    label: 'Treemap',
    group: 'hierarchical',
    description: 'Nested rectangles sized by value.',
    config: base('treemap', 'part-to-whole', {
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Treemap',
      titleLeft: 'center',
    }),
  },
  {
    id: 'sunburst',
    label: 'Sunburst',
    group: 'hierarchical',
    description: 'Hierarchy as concentric rings.',
    config: base('sunburst', 'part-to-whole', {
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Sunburst',
      titleLeft: 'center',
    }),
  },
  {
    id: 'sankey',
    label: 'Sankey',
    group: 'flow',
    description: 'Weighted flows between nodes.',
    config: base('sankey', 'relationship', {
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Sankey',
      titleLeft: 'center',
    }),
  },
  {
    id: 'candlestick',
    label: 'Candlestick',
    group: 'statistical',
    description: 'Open-high-low-close with volume context.',
    config: base('candlestick', 'trend', {
      dataZoom: true,
      showTitle: true,
      titleText: 'Candlestick',
      titleLeft: 'center',
    }),
  },
  {
    id: 'gauge',
    label: 'Gauge',
    group: 'kpi',
    description: 'Single attainment against a target range.',
    config: base('gauge', 'kpi', { showLegend: false, showTitle: true, titleText: 'Gauge', titleLeft: 'center' }),
  },
  {
    id: 'sparkline',
    label: 'Sparkline',
    group: 'kpi',
    description: 'Compact trend without chrome.',
    config: base('sparkline', 'kpi', { showLegend: false, showGrid: false, showTakeaway: false }),
  },
  {
    id: 'graph-force',
    label: 'Force graph',
    group: 'special',
    description: 'Nodes and links with force layout.',
    config: base('sankey', 'relationship', {
      tooltipTrigger: 'item',
      showTitle: true,
      titleText: 'Force graph',
      titleLeft: 'center',
    }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Force graph', left: 'center' },
      tooltip: { trigger: 'item', confine: true },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        label: { show: true, fontSize: 10 },
        force: { repulsion: 180, edgeLength: 80 },
        data: [
          { name: 'Traffic', symbolSize: 48 },
          { name: 'Product', symbolSize: 36 },
          { name: 'Blog', symbolSize: 28 },
          { name: 'Checkout', symbolSize: 32 },
          { name: 'Paid', symbolSize: 24 },
        ],
        links: [
          { source: 'Traffic', target: 'Product', value: 120 },
          { source: 'Traffic', target: 'Blog', value: 80 },
          { source: 'Product', target: 'Checkout', value: 55 },
          { source: 'Blog', target: 'Checkout', value: 20 },
          { source: 'Checkout', target: 'Paid', value: 40 },
        ],
        lineStyle: { curveness: 0.16, opacity: 0.7 },
      }],
    },
  },
  {
    id: 'tree',
    label: 'Radial tree',
    group: 'hierarchical',
    description: 'Hierarchy laid out as a radial tree.',
    config: base('sunburst', 'part-to-whole', {
      tooltipTrigger: 'item',
      showLegend: false,
      showTitle: true,
      titleText: 'Radial tree',
      titleLeft: 'center',
    }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Radial tree', left: 'center' },
      tooltip: { trigger: 'item', confine: true },
      series: [{
        type: 'tree',
        layout: 'radial',
        orient: 'LR',
        symbolSize: 10,
        label: { fontSize: 10 },
        expandAndCollapse: true,
        data: [{
          name: 'Catalog',
          children: [
            {
              name: 'Electronics',
              children: [{ name: 'Phones' }, { name: 'Laptops' }],
            },
            {
              name: 'Apparel',
              children: [{ name: 'Shirts' }, { name: 'Shoes' }],
            },
          ],
        }],
      }],
    },
  },
  {
    id: 'theme-river',
    label: 'Theme river',
    group: 'special',
    description: 'Stacked bands over time on a single axis.',
    config: base('area', 'trend', { showTitle: true, titleText: 'Theme river', titleLeft: 'center' }),
    option: {
      color: [...C],
      textStyle: echartsTextStyle,
      title: { text: 'Theme river', left: 'center' },
      tooltip: { trigger: 'axis', confine: true },
      singleAxis: {
        type: 'time',
        bottom: 36,
        axisLabel: { fontSize: 10 },
      },
      series: [{
        type: 'themeRiver',
        data: [
          ['2026-01-01', 12, 'Organic'],
          ['2026-02-01', 18, 'Organic'],
          ['2026-03-01', 16, 'Organic'],
          ['2026-04-01', 22, 'Organic'],
          ['2026-05-01', 28, 'Organic'],
          ['2026-01-01', 8, 'Paid'],
          ['2026-02-01', 11, 'Paid'],
          ['2026-03-01', 9, 'Paid'],
          ['2026-04-01', 14, 'Paid'],
          ['2026-05-01', 17, 'Paid'],
          ['2026-01-01', 5, 'Referral'],
          ['2026-02-01', 6, 'Referral'],
          ['2026-03-01', 8, 'Referral'],
          ['2026-04-01', 7, 'Referral'],
          ['2026-05-01', 10, 'Referral'],
        ],
      }],
    },
  },
  {
    id: 'visual-map',
    label: 'Visual map bar',
    group: 'bar',
    description: 'Continuous visualMap colors bars by value.',
    config: base('bar', 'comparison', {
      visualMap: true,
      visualMapType: 'continuous',
      showLegend: false,
      showTitle: true,
      titleText: 'Visual map',
      titleLeft: 'center',
    }),
  },
  {
    id: 'brush-select',
    label: 'Brush select',
    group: 'bar',
    description: 'Rect and axis brush for selecting ranges.',
    config: base('bar', 'comparison', {
      brush: true,
      showToolbox: true,
      showTitle: true,
      titleText: 'Brush select',
      titleLeft: 'center',
    }),
  },
  {
    id: 'scroll-legend',
    label: 'Scroll legend',
    group: 'line',
    description: 'Many series with a scrollable legend.',
    config: base('line', 'trend', {
      legendType: 'scroll',
      legendPosition: 'bottom',
      showTitle: true,
      titleText: 'Scroll legend',
      titleLeft: 'center',
    }),
    option: {
      color: [...C],
      ...cartesianChrome(),
      title: { text: 'Scroll legend', left: 'center' },
      legend: { type: 'scroll', bottom: 0, textStyle: echartsTextStyle },
      xAxis: { type: 'category', data: [...months] },
      yAxis: { type: 'value' },
      series: ['North', 'South', 'East', 'West', 'Central', 'Export', 'Retail', 'Online'].map((name, index) => ({
        type: 'line' as const,
        name,
        smooth: true,
        data: revenue.map((value, pointIndex) => value - index * 180 + pointIndex * 40),
      })),
    },
  },
  {
    id: 'dark-dashboard',
    label: 'Dark dashboard',
    group: 'line',
    description: 'Dark theme stacked area for night dashboards.',
    config: base('area', 'trend', {
      stacked: true,
      darkMode: true,
      background: 'slate',
      showTitle: true,
      titleText: 'Dark dashboard',
      titleLeft: 'center',
    }),
  },
  {
    id: 'crosshair',
    label: 'Crosshair tooltip',
    group: 'line',
    description: 'Axis pointer cross with confined tooltip.',
    config: base('line', 'trend', {
      axisPointer: 'cross',
      tooltipConfine: true,
      showTitle: true,
      titleText: 'Crosshair',
      titleLeft: 'center',
    }),
  },
];

export const UI_CHART_ECHARTS_TEMPLATE_BY_ID: Record<UiChartTemplateId, UiChartEchartsTemplate> =
  Object.fromEntries(UI_CHART_ECHARTS_TEMPLATES.map((entry) => [entry.id, entry])) as Record<
    UiChartTemplateId,
    UiChartEchartsTemplate
  >;

export const isUiChartTemplateId = (value: unknown): value is UiChartTemplateId =>
  typeof value === 'string' && (UI_CHART_TEMPLATE_IDS as readonly string[]).includes(value);

export const resolveUiChartEchartsTemplate = (id: unknown): UiChartEchartsTemplate =>
  UI_CHART_ECHARTS_TEMPLATE_BY_ID[isUiChartTemplateId(id) ? id : 'custom'];
