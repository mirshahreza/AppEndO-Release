import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Inbox } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildBindingNavAbsolutePath, getBindingsForMount } from '../../../app/platform/platformConfigHelpers';
import {
  DASHBOARD_BADGE_CLASS,
  DASHBOARD_COUNT_BADGE_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  DASHBOARD_INLINE_ICON_CLASS,
  DASHBOARD_LIST_DIVIDER_CLASS,
  DASHBOARD_LIST_ROW_CLASS,
  DASHBOARD_LIST_ROW_HOVER_CLASS,
  DASHBOARD_META_LINK_CLASS,
} from '../dashboardDensity';
import { useMyInboxWidget } from '../hooks/useMyInboxWidget';
import { DashboardEmptyState } from './DashboardEmptyState';
import { DashboardWidgetShell } from './DashboardWidgetShell';

const priorityLabelKey = (priority: number): string =>
  priority >= 2 ? 'dashboard.myInbox.priorityHigh' : priority === 1 ? 'dashboard.myInbox.priorityMedium' : 'dashboard.myInbox.priorityNormal';

export const DashboardMyInbox: React.FC<{ className?: string }> = ({ className }) => {
  const t = useCultureT();
  const { config } = usePlatformConfig();
  const { mountId, pathPrefix } = usePlatformMount();
  const { items, assignedCount, claimableCount, claimedCount, isLoading, isError } = useMyInboxWidget();
  const totalCount = assignedCount + claimableCount + claimedCount;
  const showList = !isLoading && !isError && items.length > 0;
  const showHeaderMeta = showList || totalCount > 0;

  const binding = getBindingsForMount(config, mountId).find((b) => b.pageKey === 'my-inbox');
  const viewAllPath = binding ? buildBindingNavAbsolutePath(pathPrefix, binding) : pathPrefix;

  return (
    <DashboardWidgetShell
      title={t('dashboard.myInbox.title')}
      headerIcon={<Inbox className={DASHBOARD_HEADER_ICON_CLASS} />}
      className={className}
      titleExtra={showHeaderMeta ? (
        <span className={`rounded-full bg-slate-100 text-slate-700 ${DASHBOARD_COUNT_BADGE_CLASS}`}>
          {totalCount}
        </span>
      ) : null}
      headerExtra={showHeaderMeta ? (
        <Link to={viewAllPath} className={`flex shrink-0 items-center gap-0.5 ${DASHBOARD_META_LINK_CLASS}`}>
          {t('dashboard.myInbox.viewAll')}
          <ChevronRight className={`${DASHBOARD_INLINE_ICON_CLASS} rtl:rotate-180`} />
        </Link>
      ) : null}
      bodyClassName={showList ? DASHBOARD_LIST_DIVIDER_CLASS : undefined}
    >
      {isLoading ? (
        <DashboardEmptyState>{t('dashboard.myInbox.loading')}</DashboardEmptyState>
      ) : isError ? (
        <DashboardEmptyState tone="error">{t('dashboard.myInbox.loadError')}</DashboardEmptyState>
      ) : items.length === 0 ? (
        <DashboardEmptyState>{t('dashboard.myInbox.empty')}</DashboardEmptyState>
      ) : (
        items.map((item) => (
          <Link
            key={`${item.bucket}-${item.id}`}
            to={`${viewAllPath}${viewAllPath.includes('?') ? '&' : '?'}workItemId=${item.id}`}
            className={`${DASHBOARD_LIST_ROW_CLASS} ${DASHBOARD_LIST_ROW_HOVER_CLASS} flex items-center justify-between gap-2`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-800">{item.titleText}</span>
              <span className="mt-0.5 inline-flex items-center">
                <span className={`rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-700 ${DASHBOARD_BADGE_CLASS}`}>
                  {item.bucket === 'MINE_ASSIGNED'
                    ? t('dashboard.myInbox.badgeAssigned')
                    : item.bucket === 'AVAILABLE_TO_CLAIM'
                      ? t('dashboard.myInbox.badgeAvailable')
                      : t('dashboard.myInbox.badgeClaimed')}
                </span>
              </span>
            </span>
            {item.priority > 0 ? (
              <span className={`shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-800 ${DASHBOARD_BADGE_CLASS}`}>
                {t(priorityLabelKey(item.priority))}
              </span>
            ) : null}
          </Link>
        ))
      )}
    </DashboardWidgetShell>
  );
};
