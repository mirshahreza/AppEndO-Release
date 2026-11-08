import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCultureT } from '../../../core/culture/CultureContext';
import { dashboardQueryKeys, fetchDashboardSummary } from '../../../shared/api/queries/dashboard';
import type { CoreHomeWidgetProps } from '../components/homeWidgetResolvers';
import { DashboardWidgetShell } from '../components/DashboardWidgetShell';
import { HomeWidgetOpenLink } from './useHomeWidgetDeepLink';
import { interpolateCultureTemplate } from '../constants';
import { DASHBOARD_BODY_PAD_STRIP_CLASS } from '../dashboardDensity';
import { formatDashboardDateTime } from '../formatDashboardDateTime';

export const JobsHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });
  const summary = query.data;
  const queued = (summary?.jobs.pending ?? 0) + (summary?.jobs.running ?? 0);
  const lastJob = summary?.activity.jobs[0];

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      titleExtra={query.isLoading ? null : (
        <span className="text-sm font-semibold tabular-nums text-slate-600">{queued}</span>
      )}
      headerExtra={(
        <HomeWidgetOpenLink deepLink={entry.deepLink} className="text-xs font-semibold text-primary-700 hover:text-primary-800" />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      {lastJob ? (
        <p className="px-3 py-2 text-xs text-slate-600">
          {lastJob.job_type}
          {' · '}
          {formatDashboardDateTime(lastJob.started_at ?? lastJob.queued_at ?? lastJob.created_at)}
        </p>
      ) : (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.jobs.empty')}</p>
      )}
    </DashboardWidgetShell>
  );
};

export const ScheduledTasksHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });
  const scheduler = query.data?.scheduler;

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      headerExtra={(
        <HomeWidgetOpenLink deepLink={entry.deepLink} className="text-xs font-semibold text-primary-700 hover:text-primary-800" />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      <div className="space-y-1 px-3 py-2 text-xs text-slate-600">
        <p>{interpolateCultureTemplate(t('homeWidget.scheduled.activeTasks'), {
          count: scheduler?.activeTaskCount ?? 0,
        })}
        </p>
        {scheduler?.nextRunAt ? (
          <p>{interpolateCultureTemplate(t('homeWidget.scheduled.nextRun'), {
            name: scheduler.nextRunTaskName ?? '—',
            time: formatDashboardDateTime(scheduler.nextRunAt),
          })}
          </p>
        ) : (
          <p className="text-slate-500">{t('homeWidget.scheduled.noNextRun')}</p>
        )}
      </div>
    </DashboardWidgetShell>
  );
};

export const ServerFunctionsHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      headerExtra={(
        <HomeWidgetOpenLink deepLink={entry.deepLink} className="text-xs font-semibold text-primary-700 hover:text-primary-800" />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      <p className="px-3 py-2 text-2xl font-semibold tabular-nums text-slate-900">
        {query.isLoading ? '…' : query.data?.serverFunctions.count ?? '—'}
      </p>
    </DashboardWidgetShell>
  );
};

export const LogsHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });
  const errors = (query.data?.activity.logs ?? []).filter((log) => log.level === 'ERROR').slice(0, 5);

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      headerExtra={(
        <HomeWidgetOpenLink deepLink={entry.deepLink} className="text-xs font-semibold text-primary-700 hover:text-primary-800" />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      {errors.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.logs.noRecentErrors')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-1">
          {errors.map((log) => (
            <li key={log.id} className="px-2 py-1.5 text-xs text-slate-700">
              <span className="font-medium text-rose-700">{log.context}</span>
              {' · '}
              {formatDashboardDateTime(log.timestamp)}
              {log.message ? (
                <>
                  {' — '}
                  <span className="text-slate-600">{log.message}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardWidgetShell>
  );
};
