import { describe, expect, it } from 'vitest';
import {
  buildBoxStats,
  buildSankeyGraph,
  buildWaterfallBars,
  linearTrendline,
} from '../chartTransforms';

describe('chart data transforms', () => {
  it('builds waterfall placeholders from signed deltas and totals', () => {
    const bars = buildWaterfallBars([
      { label: 'Start', value: 100, kind: 'total' },
      { label: 'Sales', value: 40 },
      { label: 'Refunds', value: -15 },
      { label: 'End', value: 125, kind: 'total' },
    ], 'label', 'value');
    expect(bars.map((bar) => bar.delta)).toEqual([100, 40, -15, 125]);
    expect(bars[1]?.base).toBe(100);
    expect(bars[2]?.base).toBe(125);
    expect(bars[2]?.fill).toBe('#ef4444');
  });

  it('computes boxplot quartiles per group', () => {
    const stats = buildBoxStats([
      { group: 'A', value: 10 },
      { group: 'A', value: 20 },
      { group: 'A', value: 30 },
      { group: 'B', value: 4 },
      { group: 'B', value: 6 },
    ], 'group', 'value');
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ name: 'A', min: 10, median: 20, max: 30 });
  });

  it('builds sankey graphs from source/target rows', () => {
    const graph = buildSankeyGraph([
      { source: 'A', target: 'B', value: 5 },
      { source: 'B', target: 'C', value: 2 },
    ]);
    expect(graph.nodes.map((node) => node.name)).toEqual(['A', 'B', 'C']);
    expect(graph.links).toHaveLength(2);
  });

  it('fits a two-point trendline', () => {
    expect(linearTrendline([{ x: 0, y: 1 }, { x: 2, y: 5 }])).toEqual([
      { x: 0, y: 1 },
      { x: 2, y: 5 },
    ]);
  });
});
