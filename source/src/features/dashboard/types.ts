import type { LucideIcon } from 'lucide-react';

export type DashboardKpiTone = 'ok' | 'warn' | 'error' | 'neutral';

export type DashboardKpiCard = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone: DashboardKpiTone;
};

export type DashboardHealthRow = {
  id: string;
  label: string;
  statusLabel: string;
  tone: DashboardKpiTone;
  detail?: string;
  href?: string;
  /** When false, omit the leading status dot (counts / inventory rows). */
  showLeadingDot?: boolean;
};

export type DashboardInsightLink = {
  pageKey: string;
  path: string;
  labelKey: string;
  descriptionKey: string;
};

export type DashboardQuickAction = {
  path: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  colorClass: string;
};
