import React from 'react';
import { Link } from 'react-router-dom';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useCmsHomeReviewQueueQuery } from '../../../shared/api/queries/cms-home';
import type { CoreHomeWidgetProps } from '../components/homeWidgetResolvers';
import { DashboardWidgetShell } from '../components/DashboardWidgetShell';
import { HomeWidgetOpenLink } from './useHomeWidgetDeepLink';
import { DASHBOARD_BODY_PAD_STRIP_CLASS } from '../dashboardDensity';
import { formatDashboardDateTime } from '../formatDashboardDateTime';
import { useCmsContentEditorHomePath } from './useCmsContentEditorHomePath';

const CmsReviewQueueRow: React.FC<{
  id: string;
  title: string;
  statusLabel: string | null;
  updatedAt: string | null;
}> = ({ id, title, statusLabel, updatedAt }) => {
  const path = useCmsContentEditorHomePath(id);
  const meta = [statusLabel, updatedAt ? formatDashboardDateTime(updatedAt) : null].filter(Boolean).join(' · ');
  if (!path) {
    return (
      <li className="px-2 py-1.5 text-xs text-slate-700">
        <span className="font-medium text-slate-900">{title}</span>
        {meta ? <span className="text-slate-500">{` — ${meta}`}</span> : null}
      </li>
    );
  }
  return (
    <li>
      <Link
        to={path}
        className="block px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md"
      >
        <span className="font-medium text-violet-800">{title}</span>
        {meta ? <span className="text-slate-500">{` — ${meta}`}</span> : null}
      </Link>
    </li>
  );
};

export const CmsReviewQueueHomeWidget: React.FC<CoreHomeWidgetProps> = ({ entry, headerIcon }) => {
  const t = useCultureT();
  const query = useCmsHomeReviewQueueQuery();
  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  const showQueueMeta = !query.isLoading && !query.isError;

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={showQueueMeta ? t(entry.catalog.descriptionKey) : undefined}
      headerIcon={headerIcon}
      titleExtra={showQueueMeta ? (
        <span className="text-sm font-semibold tabular-nums text-slate-600">{totalCount}</span>
      ) : null}
      headerExtra={showQueueMeta ? (
        <HomeWidgetOpenLink
          deepLink={entry.deepLink}
          className="text-xs font-semibold text-primary-700 hover:text-primary-800"
        />
      ) : null}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      {query.isLoading ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.cmsContentsList.reviewQueue.loading')}</p>
      ) : query.isError ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.cmsContentsList.reviewQueue.unavailable')}</p>
      ) : items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.cmsContentsList.reviewQueue.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-1">
          {items.map((item) => (
            <CmsReviewQueueRow
              key={item.id}
              id={item.id}
              title={item.title}
              statusLabel={item.statusLabel}
              updatedAt={item.updatedAt}
            />
          ))}
        </ul>
      )}
    </DashboardWidgetShell>
  );
};
