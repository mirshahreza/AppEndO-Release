import { describe, expect, it } from 'vitest';
import { resolveDashboardWidgetFit } from '../dashboardWidgetFit';
import { snapDashboardWidgetSpan } from '../dashboardWidgetResize';

describe('dashboardWidgetResize', () => {
  it('snaps width drags to whole column spans', () => {
    expect(snapDashboardWidgetSpan(600, 6, 0)).toBe(6);
    expect(snapDashboardWidgetSpan(600, 6, 120)).toBe(7);
    expect(snapDashboardWidgetSpan(600, 6, -400)).toBe(3);
    expect(snapDashboardWidgetSpan(600, 6, 2000)).toBe(12);
    expect(snapDashboardWidgetSpan(600, 6, 2000, 16, 6)).toBe(6);
  });
});

describe('dashboardWidgetFit', () => {
  it('uses one inner column when the tile is narrow', () => {
    const fit = resolveDashboardWidgetFit({ width: 220, height: 160, span: 3 });
    expect(fit.columns).toBe(1);
    expect(fit.density).toBe('compact');
    expect(fit.showLabels).toBe(false);
    expect(fit.showDescriptions).toBe(false);
    expect(fit.iconColumns).toBe(4);
    expect(fit.showFeaturedKpi).toBe(false);
  });

  it('hides labels when a two-column cell cannot fit Change Password', () => {
    const fit = resolveDashboardWidgetFit({ width: 400, height: 220, span: 6 });
    expect(fit.columns).toBe(2);
    expect(fit.showLabels).toBe(false);
    expect(fit.iconColumns).toBe(5);
  });

  it('opens a featured KPI mosaic when the tile is wide enough for a filled rectangle', () => {
    const short = resolveDashboardWidgetFit({ width: 720, height: 140, span: 12 });
    expect(short.columns).toBe(3);
    expect(short.showFeaturedKpi).toBe(true);

    const fit = resolveDashboardWidgetFit({ width: 720, height: 200, span: 12 });
    expect(fit.columns).toBe(3);
    expect(fit.showLabels).toBe(true);
    expect(fit.showFeaturedKpi).toBe(true);
    expect(fit.showDescriptions).toBe(true);
  });

  it('keeps the featured mosaic off on a mid-width tile that cannot fill 12 mosaic columns', () => {
    const fit = resolveDashboardWidgetFit({ width: 400, height: 280, span: 6 });
    expect(fit.columns).toBe(2);
    expect(fit.showFeaturedKpi).toBe(false);
  });
});
