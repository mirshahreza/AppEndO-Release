import {
  DASHBOARD_WIDGET_MAX_SPAN,
  DASHBOARD_WIDGET_MIN_SPAN,
} from '../../shared/lib/userDashboardLayout';

export const snapDashboardWidgetSpan = (
  startWidth: number,
  startSpan: number,
  deltaX: number,
  gap = 16,
  maxSpan = DASHBOARD_WIDGET_MAX_SPAN,
): number => {
  const safeMaxSpan = Math.min(
    DASHBOARD_WIDGET_MAX_SPAN,
    Math.max(DASHBOARD_WIDGET_MIN_SPAN, maxSpan),
  );
  const safeStartSpan = Math.min(
    safeMaxSpan,
    Math.max(DASHBOARD_WIDGET_MIN_SPAN, startSpan),
  );
  const pitch = (Math.max(0, startWidth) + gap) / safeStartSpan;
  if (!Number.isFinite(pitch) || pitch <= 0) {
    return safeStartSpan;
  }

  const next = Math.round((startWidth + deltaX + gap) / pitch);
  return Math.min(safeMaxSpan, Math.max(DASHBOARD_WIDGET_MIN_SPAN, next));
};
