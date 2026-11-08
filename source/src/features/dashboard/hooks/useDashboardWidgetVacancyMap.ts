import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAdminUser } from '../../../app/guards/roleAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import {
  dashboardQueryKeys,
  fetchDashboardSummary,
} from '../../../shared/api/queries/dashboard';
import { useCmsHomeReviewQueueQuery } from '../../../shared/api/queries/cms-home';
import { useFileHubConnectionsQuery } from '../../../shared/api/queries/file-hub';
import { useRdpHubConnectionsQuery } from '../../../shared/api/queries/rdp-hub';
import { useSshHubConnectionsQuery } from '../../../shared/api/queries/ssh-hub';
import {
  isDashboardLayoutBlockId,
  type DashboardWidgetId,
} from '../../../shared/lib/userDashboardLayout';
import type { useDashboardPage } from './useDashboardPage';
import { useFeedbackDashboardWidget } from './useFeedbackDashboardWidget';
import { useMyInboxWidget } from './useMyInboxWidget';

type DashboardPageModel = ReturnType<typeof useDashboardPage>;

/**
 * Maps widget ids to `true` when content is loaded and empty. Missing/false entries mean the widget stays visible.
 */
export function useDashboardWidgetVacancyMap(page: DashboardPageModel): Partial<Record<DashboardWidgetId, boolean>> {
  const { homeShortcuts, homeWidgetRegistry } = useDashboardLayout();
  const { currentUser } = useAuth();
  const isAdmin = isAdminUser(currentUser);
  const workItems = useMyInboxWidget();
  const feedback = useFeedbackDashboardWidget();
  const cmsQueue = useCmsHomeReviewQueueQuery();
  const summaryQuery = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    enabled: isAdmin,
  });

  const sshQuery = useSshHubConnectionsQuery();
  const fileQuery = useFileHubConnectionsQuery();
  const rdpQuery = useRdpHubConnectionsQuery();

  return useMemo(() => {
    const empty: Partial<Record<DashboardWidgetId, boolean>> = {};

    if (!workItems.isLoading && !workItems.isError) {
      const total = workItems.assignedCount + workItems.claimableCount + workItems.claimedCount;
      if (total === 0) {
        empty['my-inbox'] = true;
      }
    }

    if (!feedback.enabled) {
      empty.feedback = true;
    } else if (!feedback.isLoading && !feedback.isError && feedback.rows.length === 0) {
      empty.feedback = true;
    }

    if (homeShortcuts.length === 0) {
      empty['my-shortcuts'] = true;
    }

    if (page.myLinks.length === 0) {
      empty['my-links'] = true;
    }

    if (page.quickActions.length === 0) {
      empty['quick-actions'] = true;
    }

    if (page.insightLinks.length === 0) {
      empty.insights = true;
    }

    if (!page.isLoadingAdminData) {
      if (page.kpiCards.length === 0) {
        empty.kpi = true;
      }
      if (page.healthRows.length === 0) {
        empty.health = true;
      }
    }

    if (!cmsQueue.isLoading && !cmsQueue.isError && (cmsQueue.data?.items?.length ?? 0) === 0) {
      for (const entry of homeWidgetRegistry) {
        if (entry.componentRef === 'core:CmsReviewQueueHomeWidget') {
          empty[entry.layoutId] = true;
        }
      }
    }

    if (!summaryQuery.isLoading && !summaryQuery.isError) {
      const summary = summaryQuery.data;
      const jobsEmpty = !summary?.activity.jobs[0];
      const logsEmpty = (summary?.activity.logs ?? []).filter((log) => log.level === 'ERROR').length === 0;

      for (const entry of homeWidgetRegistry) {
        if (isDashboardLayoutBlockId(entry.layoutId)) {
          continue;
        }
        switch (entry.componentRef) {
          case 'core:JobsHomeWidget':
            if (jobsEmpty) {
              empty[entry.layoutId] = true;
            }
            break;
          case 'core:LogsHomeWidget':
            if (logsEmpty) {
              empty[entry.layoutId] = true;
            }
            break;
          default:
            break;
        }
      }
    }

    const markHubEmpty = (
      query: { isLoading: boolean; isError: boolean; data?: unknown[] | null },
      componentRef: string,
    ) => {
      if (query.isLoading || query.isError) {
        return;
      }
      if ((query.data?.length ?? 0) > 0) {
        return;
      }
      for (const entry of homeWidgetRegistry) {
        if (entry.componentRef === componentRef) {
          empty[entry.layoutId] = true;
        }
      }
    };

    markHubEmpty(sshQuery, 'core:SshHubHomeWidget');
    markHubEmpty(fileQuery, 'core:FileHubHomeWidget');
    markHubEmpty(rdpQuery, 'core:RdpHubHomeWidget');

    return empty;
  }, [
    cmsQueue.data?.items?.length,
    cmsQueue.isError,
    cmsQueue.isLoading,
    feedback.enabled,
    feedback.isError,
    feedback.isLoading,
    feedback.rows.length,
    fileQuery.data,
    fileQuery.isError,
    fileQuery.isLoading,
    homeShortcuts.length,
    homeWidgetRegistry,
    page.healthRows.length,
    page.insightLinks.length,
    page.isLoadingAdminData,
    page.kpiCards.length,
    page.myLinks.length,
    page.quickActions.length,
    rdpQuery.data,
    rdpQuery.isError,
    rdpQuery.isLoading,
    sshQuery.data,
    sshQuery.isError,
    sshQuery.isLoading,
    summaryQuery.data,
    summaryQuery.isError,
    summaryQuery.isLoading,
    workItems.assignedCount,
    workItems.claimableCount,
    workItems.claimedCount,
    workItems.isError,
    workItems.isLoading,
  ]);
}
