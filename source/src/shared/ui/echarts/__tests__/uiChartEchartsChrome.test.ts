import { describe, expect, it } from 'vitest';
import {
  readUiChartEchartsChrome,
  renderDesignerChartEchartsJsxAttrs,
  resolveUiChartEchartsPassthrough,
} from '../uiChartEchartsChrome';

describe('uiChartEchartsChrome', () => {
  it('maps operator switches onto ECharts passthrough', () => {
    const chrome = readUiChartEchartsChrome({
      showLabels: true,
      dataZoom: true,
      showToolbox: true,
      toolboxMagicType: true,
      showTooltip: true,
      tooltipTrigger: 'item',
      legendPosition: 'right',
      animation: false,
      darkMode: true,
      renderer: 'svg',
      showMarkPoint: true,
      showMarkLine: true,
      axisPointer: 'cross',
    });
    const pass = resolveUiChartEchartsPassthrough(chrome);
    expect(pass.showLabels).toBe(true);
    expect(pass.dataZoom).toEqual([
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 16, start: 0, end: 100 },
    ]);
    expect(pass.animation).toBe(false);
    expect(pass.theme).toBe('dark');
    expect(pass.renderer).toBe('svg');
    expect(pass.tooltip).toMatchObject({ show: true, trigger: 'item' });
    expect(pass.legend).toMatchObject({ right: 0, orient: 'vertical' });
    expect(pass.toolbox).toMatchObject({
      feature: {
        magicType: { type: ['line', 'bar', 'stack'] },
      },
    });
    expect(pass.seriesOption).toMatchObject({
      markPoint: { data: [{ type: 'max', name: 'Max' }, { type: 'min', name: 'Min' }] },
      markLine: { data: [{ type: 'average', name: 'Avg' }] },
    });
  });

  it('maps title, zoom type, visualMap, and series extras', () => {
    const pass = resolveUiChartEchartsPassthrough({
      showTitle: true,
      titleText: 'Revenue',
      titleLeft: 'center',
      dataZoom: true,
      dataZoomType: 'slider',
      dataZoomStart: 20,
      dataZoomEnd: 80,
      visualMap: true,
      visualMapType: 'piecewise',
      lineStep: 'middle',
      roseType: 'radius',
      ariaDecal: false,
    });
    expect(pass.title).toMatchObject({ show: true, text: 'Revenue', left: 'center' });
    expect(pass.dataZoom).toEqual([{ type: 'slider', height: 16, start: 20, end: 80 }]);
    expect(pass.visualMap).toMatchObject({ type: 'piecewise' });
    expect(pass.seriesOption).toMatchObject({ step: 'middle', roseType: 'radius' });
    expect(pass.aria).toMatchObject({ decal: { show: false } });
  });

  it('does not hide an inherited title when title chrome is still default', () => {
    const pass = resolveUiChartEchartsPassthrough({});
    expect(pass.title).toBeUndefined();
  });

  it('emits designer JSX attributes from node props', () => {
    const attrs = renderDesignerChartEchartsJsxAttrs({
      showTooltip: false,
      legendPosition: 'top',
      renderer: 'svg',
    });
    expect(attrs).toContain('showTooltip={false}');
    expect(attrs).toContain('legendPosition="top"');
    expect(attrs).toContain('renderer="svg"');
    expect(attrs).toContain('animation={true}');
  });
});
