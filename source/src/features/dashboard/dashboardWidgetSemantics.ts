import type { DashboardKpiTone } from './types';

/** Status dots — fixed semantic hues, never the operator accent. */
export const DASHBOARD_TONE_DOT_CLASS: Record<DashboardKpiTone, string> = {
  ok: 'bg-status-success',
  warn: 'bg-status-warning',
  error: 'bg-status-danger',
  neutral: 'bg-slate-400',
};

export const DASHBOARD_KPI_TONE_VALUE_CLASS: Record<DashboardKpiTone, string> = {
  ok: 'text-emerald-800',
  warn: 'text-amber-800',
  error: 'text-rose-800',
  neutral: 'text-slate-800',
};

export const DASHBOARD_HEALTH_STATUS_BADGE_CLASS: Record<DashboardKpiTone, string> = {
  ok: 'border border-emerald-300 bg-emerald-100 text-emerald-950',
  warn: 'border border-amber-300 bg-amber-100 text-amber-950',
  error: 'border border-rose-300 bg-rose-100 text-rose-950',
  neutral: 'border border-slate-300 bg-slate-200 text-slate-900',
};
