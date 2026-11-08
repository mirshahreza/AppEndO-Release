import React from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import {
  DASHBOARD_BADGE_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  DASHBOARD_LIST_DIVIDER_CLASS,
  DASHBOARD_LIST_ROW_CLASS,
  DASHBOARD_LIST_ROW_HOVER_CLASS,
} from '../dashboardDensity';
import { DASHBOARD_HEALTH_STATUS_BADGE_CLASS, DASHBOARD_TONE_DOT_CLASS } from '../dashboardWidgetSemantics';
import type { DashboardHealthRow } from '../types';
import { DashboardWidgetShell } from './DashboardWidgetShell';

type DashboardSystemHealthProps = {
  rows: DashboardHealthRow[];
  className?: string;
};

export const DashboardSystemHealth: React.FC<DashboardSystemHealthProps> = ({ rows, className }) => {
  const t = useCultureT();

  return (
    <DashboardWidgetShell
      title={t('dashboard.health.title')}
      headerIcon={<Activity className={DASHBOARD_HEADER_ICON_CLASS} />}
      className={className}
      bodyClassName={DASHBOARD_LIST_DIVIDER_CLASS}
    >
      {rows.map((row) => {
        const rowClassName = cn(
          DASHBOARD_LIST_ROW_CLASS,
          'flex items-center justify-between gap-3',
          row.href && DASHBOARD_LIST_ROW_HOVER_CLASS,
        );

        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2">
              {row.showLeadingDot !== false ? (
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DASHBOARD_TONE_DOT_CLASS[row.tone]}`} />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full invisible" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                {row.detail ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{row.detail}</p>
                ) : null}
              </div>
            </div>
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 ${DASHBOARD_BADGE_CLASS} ${DASHBOARD_HEALTH_STATUS_BADGE_CLASS[row.tone]}`}
            >
              {row.statusLabel}
            </span>
          </>
        );

        return row.href ? (
          <Link key={row.id} to={row.href} className={rowClassName}>
            {content}
          </Link>
        ) : (
          <div key={row.id} className={rowClassName}>
            {content}
          </div>
        );
      })}
    </DashboardWidgetShell>
  );
};
