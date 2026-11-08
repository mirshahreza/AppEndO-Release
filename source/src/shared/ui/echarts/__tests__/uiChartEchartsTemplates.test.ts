import { describe, expect, it } from 'vitest';
import {
  UI_CHART_ECHARTS_TEMPLATES,
  UI_CHART_TEMPLATE_IDS,
  resolveUiChartEchartsTemplate,
} from '../uiChartEchartsTemplates';

describe('uiChartEchartsTemplates', () => {
  it('covers every template id with a unique label and a kind', () => {
    expect(UI_CHART_ECHARTS_TEMPLATES.map((entry) => entry.id)).toEqual([...UI_CHART_TEMPLATE_IDS]);
    const labels = UI_CHART_ECHARTS_TEMPLATES.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const entry of UI_CHART_ECHARTS_TEMPLATES) {
      expect(entry.config.kind).toBeTruthy();
      expect(entry.description.length).toBeGreaterThan(8);
    }
  });

  it('keeps custom as a chrome-only starting point and polar-bar as a standalone option', () => {
    expect(resolveUiChartEchartsTemplate('custom').option).toBeUndefined();
    expect(resolveUiChartEchartsTemplate('polar-bar').option?.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'bar', coordinateSystem: 'polar' })]),
    );
    expect(resolveUiChartEchartsTemplate('unknown').id).toBe('custom');
  });
});
