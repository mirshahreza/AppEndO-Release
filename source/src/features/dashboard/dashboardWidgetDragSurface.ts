import type { DashboardLayoutBlockId, DashboardWidgetId } from '../../shared/lib/userDashboardLayout';

export type DashboardWidgetDragSurface = 'header' | 'body';

/** Widgets without `DashboardWidgetShell` use body drag; shelled widgets drag from the header. */
export const DASHBOARD_WIDGET_DRAG_SURFACE: Record<DashboardLayoutBlockId, DashboardWidgetDragSurface> = {
  kpi: 'body',
  insights: 'header',
  'my-inbox': 'header',
  feedback: 'header',
  health: 'header',
  'quick-actions': 'header',
  'my-links': 'header',
  'my-shortcuts': 'header',
};

export const resolveDashboardWidgetDragSurface = (
  blockId: DashboardWidgetId,
): DashboardWidgetDragSurface => {
  if (blockId in DASHBOARD_WIDGET_DRAG_SURFACE) {
    return DASHBOARD_WIDGET_DRAG_SURFACE[blockId as DashboardLayoutBlockId];
  }
  return 'header';
};
