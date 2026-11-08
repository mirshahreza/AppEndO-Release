export const ADVANCED_CHART_TYPES = [
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

export type AdvancedChartType = (typeof ADVANCED_CHART_TYPES)[number];

export const isAdvancedChartType = (value: unknown): value is AdvancedChartType =>
  typeof value === 'string' && (ADVANCED_CHART_TYPES as readonly string[]).includes(value);
