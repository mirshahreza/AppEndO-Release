import { describe, expect, it } from 'vitest';
import {
  buildDashboardUniformLayoutRows,
  resolveDashboardSpanUnits,
  resolveDashboardWidgetLayoutSpan,
} from '../dashboardWidgetLayoutSpan';

describe('dashboardWidgetLayoutSpan', () => {
  it('assigns half width to core platform widgets by default', () => {
    expect(resolveDashboardWidgetLayoutSpan('kpi')).toBe('half');
    expect(resolveDashboardWidgetLayoutSpan('my-inbox')).toBe('half');
    expect(resolveDashboardWidgetLayoutSpan('health')).toBe('half');
    expect(resolveDashboardSpanUnits('health')).toBe(6);
  });

  it('packs a narrow tile beside a half-width tile after overview', () => {
    expect(buildDashboardUniformLayoutRows([
      'kpi',
      'insights',
      'my-inbox',
    ])).toEqual([
      { type: 'band', ids: ['kpi', 'insights'] },
      { type: 'band', ids: ['my-inbox'] },
    ]);
  });

  it('packs half-width tiles on multiple bands', () => {
    expect(buildDashboardUniformLayoutRows([
      'health',
      'my-links',
      'quick-actions',
      'feedback',
    ])).toEqual([
      { type: 'band', ids: ['health', 'my-links'] },
      { type: 'band', ids: ['quick-actions', 'feedback'] },
    ]);
  });

  it('packs operator-resized spans instead of the default widths', () => {
    expect(buildDashboardUniformLayoutRows(
      ['health', 'my-links'],
      { health: { span: 8 }, 'my-links': { span: 4 } },
    )).toEqual([
      { type: 'band', ids: ['health', 'my-links'] },
    ]);
    expect(resolveDashboardSpanUnits('health', { health: { span: 8 } })).toBe(8);
  });

  it('starts a new band when the next tile does not fit', () => {
    expect(buildDashboardUniformLayoutRows(['health', 'my-links', 'quick-actions'])).toEqual([
      { type: 'band', ids: ['health', 'my-links'] },
      { type: 'band', ids: ['quick-actions'] },
    ]);
  });
});
