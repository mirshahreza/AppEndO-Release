import { describe, expect, it } from 'vitest';
import { resolveDashboardWidgetChrome } from '../dashboardWidgetChrome';

describe('dashboardWidgetChrome', () => {
  it('hides the header on body-surface widgets until the operator turns it on', () => {
    expect(resolveDashboardWidgetChrome('kpi')).toEqual({
      accent: undefined,
      showHeader: false,
      headerStyle: 'inline',
      lockSize: false,
      hideWhenEmpty: false,
    });
    expect(resolveDashboardWidgetChrome('health')).toEqual({
      accent: undefined,
      showHeader: true,
      headerStyle: 'bar',
      lockSize: false,
      hideWhenEmpty: false,
    });
  });

  it('honors stored chrome overrides', () => {
    expect(resolveDashboardWidgetChrome('kpi', {
      kpi: { accent: 'cyan', showHeader: true, headerStyle: 'bar', lockSize: true },
    })).toEqual({
      accent: 'cyan',
      showHeader: true,
      headerStyle: 'bar',
      lockSize: true,
      hideWhenEmpty: false,
    });
  });
});
