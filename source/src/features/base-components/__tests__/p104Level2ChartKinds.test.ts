import { describe, expect, it } from 'vitest';
import { ADVANCED_CHART_TYPES } from '../../../shared/ui/UiAdvancedCharts';
import { getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { CHART_KIND_OPTIONS } from '../chart/ChartBaseComponentsWorkspace';

const LEVEL_2_KINDS = [
  'radar',
  'heatmap',
  'treemap',
  'sankey',
  'funnel',
  'boxplot',
  'candlestick',
] as const;

describe('p-104 level 2 chart kinds', () => {
  it('exposes the echarts kinds on the existing chart section', () => {
    const kindOption = getBaseComponentOptions('chart').find((option) => option.id === 'chart.kind');
    expect(kindOption?.values).toEqual(expect.arrayContaining([...LEVEL_2_KINDS]));
  });

  it('renders those kinds in the chart lab and advanced chart runtime', () => {
    expect(CHART_KIND_OPTIONS).toEqual(expect.arrayContaining([...LEVEL_2_KINDS]));
    expect(ADVANCED_CHART_TYPES).toEqual(expect.arrayContaining([
      'radar',
      'heatmap',
      'treemap',
      'sankey',
      'funnel',
      'boxplot',
      'candlestick',
    ]));
  });
});
