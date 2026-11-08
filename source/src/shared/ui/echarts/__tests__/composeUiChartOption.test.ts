import { describe, expect, it } from 'vitest';
import { composeUiChartOption, pickEchartsOptionProps } from '../uiEchartsApi';
import { mergeEchartsOption } from '../mergeEchartsOption';

describe('mergeEchartsOption', () => {
  it('deep-merges objects and replaces arrays', () => {
    expect(mergeEchartsOption(
      { title: { text: 'A', left: 8 }, series: [{ type: 'bar' }] },
      { title: { text: 'B' }, series: [{ type: 'line' }] },
    )).toEqual({
      title: { text: 'B', left: 8 },
      series: [{ type: 'line' }],
    });
  });

  it('skips undefined overlay keys', () => {
    expect(mergeEchartsOption({ animation: true }, { animation: undefined })).toEqual({ animation: true });
  });
});

describe('composeUiChartOption', () => {
  it('lets a full option overlay win', () => {
    const composed = composeUiChartOption(
      { title: { text: 'Built' }, legend: { show: true } },
      { title: { left: 'center' }, option: { title: { text: 'Overlay' } } },
    );
    expect(composed.title).toMatchObject({ text: 'Overlay', left: 'center' });
  });

  it('patches every built series via seriesOption', () => {
    const composed = composeUiChartOption(
      { series: [{ type: 'bar', name: 'A' }, { type: 'bar', name: 'B' }] },
      { seriesOption: { markLine: { data: [{ type: 'average' }] } } },
    );
    const series = composed.series as Array<{ markLine?: { data: unknown[] } }>;
    expect(series).toHaveLength(2);
    expect(series[0]?.markLine?.data).toEqual([{ type: 'average' }]);
    expect(series[1]?.markLine?.data).toEqual([{ type: 'average' }]);
  });

  it('does not treat boolean dataZoom as an ECharts option', () => {
    expect(pickEchartsOptionProps({ dataZoom: true })).toEqual({});
    expect(pickEchartsOptionProps({ dataZoom: [{ type: 'inside' }] }).dataZoom).toEqual([{ type: 'inside' }]);
  });
});
