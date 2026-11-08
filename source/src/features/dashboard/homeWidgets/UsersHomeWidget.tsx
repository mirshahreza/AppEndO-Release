import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCultureT } from '../../../core/culture/CultureContext';
import { dashboardQueryKeys, fetchDashboardSummary } from '../../../shared/api/queries/dashboard';
import type { CoreHomeWidgetProps } from '../components/homeWidgetResolvers';
import { DashboardWidgetShell } from '../components/DashboardWidgetShell';
import { HomeWidgetOpenLink } from './useHomeWidgetDeepLink';
import { DASHBOARD_BODY_PAD_STRIP_CLASS } from '../dashboardDensity';

export const UsersHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });
  const count = query.data?.users.count;

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      headerExtra={(
        <HomeWidgetOpenLink
          deepLink={entry.deepLink}
          className="text-xs font-semibold text-primary-700 hover:text-primary-800"
        />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      <p className="px-3 py-2 text-2xl font-semibold tabular-nums text-slate-900">
        {query.isLoading ? '…' : count ?? '—'}
      </p>
      <p className="px-3 pb-2 text-xs text-slate-500">{t('homeWidget.users.activeHint')}</p>
    </DashboardWidgetShell>
  );
};
