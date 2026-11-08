import { APP_SURFACE_BOX_TONE_CLASS } from '../../shared/ui/surfaceClasses';
import type {
  DashboardLayoutBlockId,
  DashboardWidgetAccent,
  DashboardWidgetChrome,
  DashboardWidgetChromes,
  DashboardWidgetHeaderStyle,
} from '../../shared/lib/userDashboardLayout';
import { resolveDashboardWidgetDragSurface } from './dashboardWidgetDragSurface';

const BODY_SURFACE_IDS = new Set<DashboardLayoutBlockId>(
  (['kpi'] as const).filter((id) => resolveDashboardWidgetDragSurface(id) === 'body'),
);

export const resolveDashboardWidgetDefaultShowHeader = (widgetId: DashboardLayoutBlockId): boolean =>
  !BODY_SURFACE_IDS.has(widgetId);

export const resolveDashboardWidgetDefaultHeaderStyle = (
  widgetId: DashboardLayoutBlockId,
): DashboardWidgetHeaderStyle => (BODY_SURFACE_IDS.has(widgetId) ? 'inline' : 'bar');

export const resolveDashboardWidgetChrome = (
  widgetId: DashboardLayoutBlockId,
  chromes?: DashboardWidgetChromes,
): Required<Pick<DashboardWidgetChrome, 'showHeader' | 'headerStyle' | 'lockSize' | 'hideWhenEmpty'>> & {
  accent?: DashboardWidgetAccent;
} => {
  const stored = chromes?.[widgetId];
  return {
    accent: stored?.accent,
    showHeader: stored?.showHeader ?? resolveDashboardWidgetDefaultShowHeader(widgetId),
    headerStyle: stored?.headerStyle ?? resolveDashboardWidgetDefaultHeaderStyle(widgetId),
    lockSize: stored?.lockSize === true,
    hideWhenEmpty: stored?.hideWhenEmpty === true,
  };
};

export const DASHBOARD_WIDGET_ACCENT_SWATCH_CLASS: Record<DashboardWidgetAccent, string> = {
  slate: 'bg-slate-300',
  violet: 'bg-violet-300',
  cyan: 'bg-cyan-300',
  indigo: 'bg-indigo-300',
  emerald: 'bg-emerald-300',
  amber: 'bg-amber-300',
  rose: 'bg-rose-300',
};

export const DASHBOARD_WIDGET_ACCENT_ARTICLE_CLASS: Record<DashboardWidgetAccent, string> = {
  slate: '[&_article]:!border-slate-200',
  violet: '[&_article]:!border-violet-200',
  cyan: '[&_article]:!border-cyan-200',
  indigo: '[&_article]:!border-indigo-200',
  emerald: '[&_article]:!border-emerald-200',
  amber: '[&_article]:!border-amber-200',
  rose: '[&_article]:!border-rose-200',
};

export const resolveDashboardWidgetAccentTokens = (accent?: DashboardWidgetAccent) =>
  accent ? APP_SURFACE_BOX_TONE_CLASS[accent] : null;
