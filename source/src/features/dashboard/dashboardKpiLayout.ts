import {
  DASHBOARD_KPI_FEATURED_SPAN_CLASS,
  DASHBOARD_KPI_GRID_CLASS,
  DASHBOARD_KPI_QUAD_GRID_CLASS,
  DASHBOARD_KPI_ROW3_GRID_CLASS,
  DASHBOARD_KPI_ROW4_GRID_CLASS,
  DASHBOARD_KPI_SECONDARY_SPAN_CLASS,
  DASHBOARD_KPI_STACK_GRID_CLASS,
  DASHBOARD_KPI_TERTIARY_SPAN_CLASS,
} from './dashboardDensity';
import type { DashboardWidgetFit } from './dashboardWidgetFit';

export type DashboardKpiPack = 'stack' | 'quad' | 'row' | 'mosaic';

/**
 * Four KPI cards must always fill a rectangle.
 * Never use a 3-column equal grid for 4 cards — that leaves a hole.
 */
export const resolveDashboardKpiPack = (
  count: number,
  fit?: Pick<DashboardWidgetFit, 'showFeaturedKpi' | 'columns'>,
): DashboardKpiPack => {
  if (count <= 1) {
    return 'stack';
  }
  if (fit && fit.columns >= 4 && count >= 2) {
    return 'row';
  }
  if (fit?.showFeaturedKpi && count >= 3) {
    return 'mosaic';
  }
  if (!fit || fit.columns <= 1) {
    return 'stack';
  }
  if (count === 2) {
    return 'row';
  }
  if (count === 3) {
    return fit.columns >= 3 ? 'row' : 'stack';
  }
  if (fit.columns >= 4) {
    return 'row';
  }
  return 'quad';
};

export const resolveDashboardKpiGridClass = (
  count: number,
  fit?: Pick<DashboardWidgetFit, 'showFeaturedKpi' | 'columns'>,
): string => {
  const pack = resolveDashboardKpiPack(count, fit);
  if (pack === 'mosaic') {
    return DASHBOARD_KPI_GRID_CLASS;
  }
  if (pack === 'quad') {
    return DASHBOARD_KPI_QUAD_GRID_CLASS;
  }
  if (pack === 'row') {
    if (count === 2) {
      return DASHBOARD_KPI_QUAD_GRID_CLASS;
    }
    if (count === 3) {
      return DASHBOARD_KPI_ROW3_GRID_CLASS;
    }
    return DASHBOARD_KPI_ROW4_GRID_CLASS;
  }
  return DASHBOARD_KPI_STACK_GRID_CLASS;
};

export const resolveDashboardKpiCardSpanClass = (
  index: number,
  count: number,
  fit?: Pick<DashboardWidgetFit, 'showFeaturedKpi' | 'columns'>,
): string => {
  if (resolveDashboardKpiPack(count, fit) !== 'mosaic') {
    return '';
  }

  if (count >= 4) {
    if (index === 0) {
      return DASHBOARD_KPI_FEATURED_SPAN_CLASS;
    }
    if (index === 1) {
      return DASHBOARD_KPI_SECONDARY_SPAN_CLASS;
    }
    return DASHBOARD_KPI_TERTIARY_SPAN_CLASS;
  }

  if (count === 3) {
    if (index === 0) {
      return DASHBOARD_KPI_FEATURED_SPAN_CLASS;
    }
    return DASHBOARD_KPI_SECONDARY_SPAN_CLASS;
  }

  return DASHBOARD_KPI_FEATURED_SPAN_CLASS;
};

export const isDashboardKpiFeaturedCard = (
  index: number,
  count: number,
  fit?: Pick<DashboardWidgetFit, 'showFeaturedKpi' | 'columns'>,
): boolean => resolveDashboardKpiPack(count, fit) === 'mosaic' && index === 0 && count >= 3;
