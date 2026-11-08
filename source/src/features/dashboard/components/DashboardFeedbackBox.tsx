import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessagesSquare } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildBindingNavAbsolutePath, getBindingsForMount } from '../../../app/platform/platformConfigHelpers';
import {
  DASHBOARD_COUNT_BADGE_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  DASHBOARD_INLINE_ICON_CLASS,
  DASHBOARD_LIST_DIVIDER_CLASS,
  DASHBOARD_LIST_ROW_CLASS,
  DASHBOARD_LIST_ROW_HOVER_CLASS,
  DASHBOARD_META_LINK_CLASS,
} from '../dashboardDensity';
import { buildFeedbackTicketHref } from '../../feedback/feedbackTicketDeepLink';
import { useFeedbackDashboardWidget } from '../hooks/useFeedbackDashboardWidget';
import { formatDashboardDateTime } from '../formatDashboardDateTime';
import { DashboardEmptyState } from './DashboardEmptyState';
import { DashboardWidgetShell } from './DashboardWidgetShell';

const STATUS_CHIP_CLASS =
  'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none';

export const DashboardFeedbackBox: React.FC<{ className?: string }> = ({ className }) => {
  const t = useCultureT();
  const { config } = usePlatformConfig();
  const { mountId, pathPrefix } = usePlatformMount();
  const { rows = [], attentionCount, isLoading, isError, enabled } = useFeedbackDashboardWidget();

  const paths = useMemo(() => {
    const personalInboxBinding = getBindingsForMount(config, mountId).find((binding) => binding.pageKey === 'my-inbox');
    const staffInboxBinding = getBindingsForMount(config, mountId).find((binding) => binding.pageKey === 'feedback-inbox');
    const personalInboxBase = personalInboxBinding
      ? buildBindingNavAbsolutePath(pathPrefix, personalInboxBinding)
      : pathPrefix;
    const viewAllPath = `${personalInboxBase}${personalInboxBase.includes('?') ? '&' : '?'}kind=feedback`;
    const inboxPath = staffInboxBinding
      ? buildBindingNavAbsolutePath(pathPrefix, staffInboxBinding)
      : viewAllPath;
    return { viewAllPath, inboxPath };
  }, [config, mountId, pathPrefix]);

  if (!enabled) {
    return null;
  }

  const hasBody = rows.length > 0;

  return (
    <DashboardWidgetShell
      title={t('dashboard.feedback.title')}
      headerIcon={<MessagesSquare className={DASHBOARD_HEADER_ICON_CLASS} />}
      className={className}
      titleExtra={attentionCount > 0 ? (
        <span className={`rounded-full bg-rose-100 text-rose-800 ${DASHBOARD_COUNT_BADGE_CLASS}`}>
          {t('dashboard.feedback.unreadTotal').replace('{count}', String(attentionCount))}
        </span>
      ) : null}
      headerExtra={(
        <Link to={paths.viewAllPath} className={`flex shrink-0 items-center gap-0.5 ${DASHBOARD_META_LINK_CLASS}`}>
          {t('dashboard.feedback.viewAll')}
          <ChevronRight className={`${DASHBOARD_INLINE_ICON_CLASS} rtl:rotate-180`} />
        </Link>
      )}
      bodyClassName={hasBody ? DASHBOARD_LIST_DIVIDER_CLASS : undefined}
    >
      {isLoading ? (
        <DashboardEmptyState>{t('dashboard.feedback.loading')}</DashboardEmptyState>
      ) : isError ? (
        <DashboardEmptyState tone="error">{t('dashboard.feedback.loadError')}</DashboardEmptyState>
      ) : !hasBody ? (
        <DashboardEmptyState>{t('dashboard.feedback.empty')}</DashboardEmptyState>
      ) : (
        rows.map((row) => {
          const { item, inMine, inInbox } = row;
          const hasUnreadReply = inMine && item.unreadCount > 0;
          const needsInboxReview = inInbox && (item.status === 'NEW' || item.status === 'TRIAGED');
          const baseHref = hasUnreadReply || (inMine && !needsInboxReview)
            ? paths.viewAllPath
            : paths.inboxPath;
          const href = buildFeedbackTicketHref(baseHref, item.id);
          const when = item.lastMessageAt ?? item.submittedAt;

          return (
            <Link
              key={item.id}
              to={href}
              className={`${DASHBOARD_LIST_ROW_CLASS} ${DASHBOARD_LIST_ROW_HOVER_CLASS} flex min-w-0 items-center gap-2`}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {hasUnreadReply ? (
                  <span className={`${STATUS_CHIP_CLASS} border-rose-200 bg-rose-50 text-rose-800`}>
                    {t('dashboard.feedback.newReply')}
                  </span>
                ) : null}
                {!hasUnreadReply && needsInboxReview ? (
                  <span className={`${STATUS_CHIP_CLASS} border-violet-200 bg-violet-50 text-violet-800`}>
                    {t('dashboard.feedback.inboxNew')}
                  </span>
                ) : null}
                <span className="min-w-0 truncate text-xs font-semibold text-slate-900">{item.title}</span>
                <time dateTime={when} className="ms-auto shrink-0 text-[10px] text-slate-500">
                  {formatDashboardDateTime(when)}
                </time>
              </span>
            </Link>
          );
        })
      )}
    </DashboardWidgetShell>
  );
};
