import { describe, expect, it } from 'vitest';
import {
  isDashboardKpiFeaturedCard,
  resolveDashboardKpiCardSpanClass,
  resolveDashboardKpiGridClass,
  resolveDashboardKpiPack,
} from '../dashboardKpiLayout';
import {
  DASHBOARD_KPI_FEATURED_SPAN_CLASS,
  DASHBOARD_KPI_GRID_CLASS,
  DASHBOARD_KPI_QUAD_GRID_CLASS,
  DASHBOARD_KPI_ROW3_GRID_CLASS,
  DASHBOARD_KPI_ROW4_GRID_CLASS,
  DASHBOARD_KPI_SECONDARY_SPAN_CLASS,
  DASHBOARD_KPI_STACK_GRID_CLASS,
  DASHBOARD_KPI_TERTIARY_SPAN_CLASS,
} from '../dashboardDensity';

describe('dashboardKpiLayout', () => {
  it('makes the first of four cards a tall featured tile when the widget is wide', () => {
    const fit = { showFeaturedKpi: true, columns: 3 as const };
    expect(resolveDashboardKpiPack(4, fit)).toBe('mosaic');
    expect(isDashboardKpiFeaturedCard(0, 4, fit)).toBe(true);
    expect(isDashboardKpiFeaturedCard(1, 4, fit)).toBe(false);
    expect(resolveDashboardKpiCardSpanClass(0, 4, fit)).toBe(DASHBOARD_KPI_FEATURED_SPAN_CLASS);
    expect(resolveDashboardKpiCardSpanClass(1, 4, fit)).toBe(DASHBOARD_KPI_SECONDARY_SPAN_CLASS);
    expect(resolveDashboardKpiCardSpanClass(2, 4, fit)).toBe(DASHBOARD_KPI_TERTIARY_SPAN_CLASS);
    expect(resolveDashboardKpiCardSpanClass(3, 4, fit)).toBe(DASHBOARD_KPI_TERTIARY_SPAN_CLASS);
    expect(resolveDashboardKpiGridClass(4, fit)).toBe(DASHBOARD_KPI_GRID_CLASS);
  });

  it('uses a single row when four cards fit across the tile', () => {
    const wide = { showFeaturedKpi: true, columns: 4 as const };
    expect(resolveDashboardKpiPack(4, wide)).toBe('row');
    expect(resolveDashboardKpiGridClass(4, wide)).toBe(DASHBOARD_KPI_ROW4_GRID_CLASS);
    expect(isDashboardKpiFeaturedCard(0, 4, wide)).toBe(false);
  });

  it('never leaves a 3-plus-1 hole for four equal cards', () => {
    const mid = { showFeaturedKpi: false, columns: 3 as const };
    expect(resolveDashboardKpiPack(4, mid)).toBe('quad');
    expect(resolveDashboardKpiGridClass(4, mid)).toBe(DASHBOARD_KPI_QUAD_GRID_CLASS);
    expect(resolveDashboardKpiCardSpanClass(0, 4, mid)).toBe('');

    const wide = { showFeaturedKpi: false, columns: 4 as const };
    expect(resolveDashboardKpiPack(4, wide)).toBe('row');
    expect(resolveDashboardKpiGridClass(4, wide)).toBe(DASHBOARD_KPI_ROW4_GRID_CLASS);
  });

  it('stacks on a narrow tile and uses a filled row for three cards', () => {
    const narrow = { showFeaturedKpi: false, columns: 1 as const };
    expect(resolveDashboardKpiPack(4, narrow)).toBe('stack');
    expect(isDashboardKpiFeaturedCard(0, 4, narrow)).toBe(false);
    expect(resolveDashboardKpiCardSpanClass(0, 4, narrow)).toBe('');
    expect(resolveDashboardKpiGridClass(4, narrow)).toBe(DASHBOARD_KPI_STACK_GRID_CLASS);

    const three = { showFeaturedKpi: false, columns: 3 as const };
    expect(resolveDashboardKpiPack(3, three)).toBe('row');
    expect(resolveDashboardKpiGridClass(3, three)).toBe(DASHBOARD_KPI_ROW3_GRID_CLASS);
  });
});
