import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { canSelfDeleteAccount, isAdminUser } from '../../../app/guards/roleAccess';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';
import {
  dashboardQueryKeys,
  fetchDashboardSummary,
} from '../../../shared/api/queries/dashboard';
import { useVisibilityAwareRefetchInterval } from '../../../shared/lib/useDocumentVisibility';
import {
  buildDashboardQuickActions,
  interpolateCultureTemplate,
  resolveDashboardPagePath,
  resolveStudioPagePath,
} from '../constants';
import { buildDashboardMyLinks, type DashboardMyLink } from '../dashboardMyLinks';
import { formatDashboardDateTime } from '../formatDashboardDateTime';
import { formatDashboardRoleLabel } from '../formatDashboardRoleLabel';
import type {
  DashboardHealthRow,
  DashboardInsightLink,
  DashboardKpiCard,
  DashboardQuickAction,
} from '../types';

const DASHBOARD_POLL_MS = 60_000;

function resolvePlatformTone(health: string | undefined, ready: string | undefined) {
  if (health === 'ok' && ready === 'ready') return 'ok' as const;
  if (health === 'ok' || ready === 'ready') return 'warn' as const;
  return 'error' as const;
}

export function useDashboardPage() {
  const t = useCultureT();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { config } = usePlatformConfig();
  const { mountId, pathPrefix } = usePlatformMount();
  const { pathname } = useLocation();
  const { displayName, primaryRole: rawPrimaryRole } = useCurrentUserDisplay();
  const primaryRole = formatDashboardRoleLabel(rawPrimaryRole);
  const isAdmin = isAdminUser(currentUser);
  const dashboardPollInterval = useVisibilityAwareRefetchInterval(DASHBOARD_POLL_MS);

  const summaryQuery = useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    enabled: isAdmin,
    refetchInterval: dashboardPollInterval,
    staleTime: 30_000,
  });

  const summary = summaryQuery.data;

  const lastUpdatedTimestamp = summaryQuery.dataUpdatedAt ?? Date.now();

  const isRefreshing = isAdmin && summaryQuery.isFetching;

  const scheduledTasksPath = useMemo(
    () => resolveDashboardPagePath(config, mountId, pathPrefix, currentUser, 'scheduled-tasks'),
    [config, currentUser, mountId, pathPrefix],
  );

  const insightLinks = useMemo((): DashboardInsightLink[] => {
    if (!isAdmin) {
      return [];
    }

    const pages: Array<{ pageKey: string; labelKey: string; descriptionKey: string }> = [
      {
        pageKey: 'studio-insights-ops',
        labelKey: 'dashboard.insights.operations',
        descriptionKey: 'dashboard.insights.operations.description',
      },
      {
        pageKey: 'studio-insights-work',
        labelKey: 'dashboard.insights.work',
        descriptionKey: 'dashboard.insights.work.description',
      },
      {
        pageKey: 'studio-insights-people',
        labelKey: 'dashboard.insights.people',
        descriptionKey: 'dashboard.insights.people.description',
      },
    ];

    return pages.flatMap((page) => {
      const path = resolveStudioPagePath(config, mountId, pathPrefix, currentUser, page.pageKey);
      return path ? [{ ...page, path }] : [];
    });
  }, [config, currentUser, isAdmin, mountId, pathPrefix]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
  }, [queryClient]);

  const kpiCards = useMemo((): DashboardKpiCard[] => {
    if (!isAdmin || !summary) return [];

    const platformTone = resolvePlatformTone(summary.health, summary.ready);

    return [
      {
        id: 'platform',
        label: t('dashboard.kpi.platform'),
        value: summary.health === 'ok' && summary.ready === 'ready'
          ? t('dashboard.kpi.platformOk')
          : summary.ready === 'not_ready'
            ? t('dashboard.kpi.databaseNotReady')
            : summary.health !== 'ok'
              ? t('dashboard.kpi.healthCheckFailed')
              : t('dashboard.kpi.degraded'),
        hint: summary.health === 'ok' && summary.ready === 'ready'
          ? t('dashboard.kpi.healthAndDbReady')
          : t('dashboard.kpi.checkSystemHealth'),
        tone: platformTone,
      },
    ];
  }, [isAdmin, summary, t]);

  const healthRows = useMemo((): DashboardHealthRow[] => {
    if (!isAdmin || !summary) return [];

    const cache = summary.cache;
    let cacheLabel = t('dashboard.health.cacheUnknown');
    let cacheTone: DashboardHealthRow['tone'] = 'neutral';
    if (cache) {
      if (!cache.isEnabled) {
        cacheLabel = t('dashboard.health.cacheDisabled');
        cacheTone = 'warn';
      } else if (cache.status === 'connected') {
        const driver = cache.driver === 'redis' ? 'Redis' : 'Memory';
        cacheLabel = interpolateCultureTemplate(t('dashboard.health.cacheConnected'), { driver });
        cacheTone = 'ok';
      } else {
        cacheLabel = cache.status === 'disconnected'
          ? t('dashboard.health.cacheDisconnected')
          : t('dashboard.health.cacheError');
        cacheTone = 'error';
      }
    }

    return [
      {
        id: 'database',
        label: t('dashboard.health.database'),
        statusLabel: summary.ready === 'ready'
          ? t('dashboard.health.ready')
          : summary.ready === 'not_ready'
            ? t('dashboard.health.notReady')
            : t('dashboard.health.checking'),
        tone: summary.ready === 'ready' ? 'ok' : summary.ready === 'not_ready' ? 'error' : 'neutral',
      },
      {
        id: 'cache',
        label: t('dashboard.health.cache'),
        statusLabel: cacheLabel,
        tone: cacheTone,
        detail: cache?.lastError ?? undefined,
      },
      {
        id: 'sources',
        label: t('dashboard.health.dataSources'),
        statusLabel: summary.dataSources.total === 0
          ? t('dashboard.health.noDataSources')
          : interpolateCultureTemplate(t('dashboard.health.dataSourcesConnected'), {
            connected: summary.dataSources.connected,
            total: summary.dataSources.total,
          }),
        tone: summary.dataSources.total === 0
          ? 'neutral'
          : summary.dataSources.connected === summary.dataSources.total
            ? 'ok'
            : 'warn',
      },
      {
        id: 'plugins',
        label: t('dashboard.health.plugins'),
        statusLabel: interpolateCultureTemplate(t('dashboard.health.pluginsActive'), {
          count: summary.plugins.active,
        }),
        tone: summary.plugins.total === 0
          ? 'neutral'
          : summary.plugins.active === summary.plugins.total
            ? 'ok'
            : 'warn',
        detail: interpolateCultureTemplate(t('dashboard.health.pluginsRegistered'), {
          count: summary.plugins.total,
        }),
      },
      {
        id: 'ai',
        label: t('dashboard.health.aiModels'),
        statusLabel: summary.ai.enabled
          ? interpolateCultureTemplate(t('dashboard.health.aiEnabledCount'), {
            count: summary.ai.enabledModelCount,
          })
          : t('dashboard.health.aiDisabled'),
        tone: !summary.ai.enabled
          ? 'warn'
          : summary.ai.enabledModelCount > 0
            ? 'ok'
            : 'warn',
        detail: summary.ai.enabled
          ? interpolateCultureTemplate(t('dashboard.health.aiProviders'), {
            count: summary.ai.providerCount,
            model: summary.ai.defaultModelName || summary.ai.defaultModelId || '—',
          })
          : t('dashboard.health.aiEnableHint'),
      },
      {
        id: 'server-functions',
        label: t('dashboard.health.serverFunctions'),
        statusLabel: String(summary.serverFunctions.count),
        tone: 'neutral',
        detail: t('dashboard.health.serverFunctionsDetail'),
      },
      {
        id: 'scheduler-next',
        label: t('dashboard.health.nextCronRun'),
        statusLabel: summary.scheduler.nextRunAt
          ? formatDashboardDateTime(summary.scheduler.nextRunAt)
          : summary.scheduler.enabled
            ? t('dashboard.health.noEnabledTasks')
            : t('dashboard.kpi.schedulerDisabled'),
        tone: !summary.scheduler.enabled
          ? 'warn'
          : summary.scheduler.nextRunAt
            ? 'ok'
            : 'neutral',
        detail: summary.scheduler.nextRunTaskName ?? undefined,
        href: scheduledTasksPath,
      },
    ];
  }, [isAdmin, scheduledTasksPath, summary, t]);

  const quickActions = useMemo(
    (): DashboardQuickAction[] => buildDashboardQuickActions(config, mountId, pathPrefix, currentUser, t),
    [config, currentUser, mountId, pathPrefix, t],
  );

  const myLinks = useMemo(
    (): DashboardMyLink[] => buildDashboardMyLinks({
      config,
      pathname,
      mountId,
      currentUser,
      canDeleteAccount: canSelfDeleteAccount(currentUser),
    }),
    [config, currentUser, mountId, pathname],
  );

  const isLoadingAdminData = isAdmin && summaryQuery.isLoading;

  return {
    isAdmin,
    displayName,
    primaryRole,
    kpiCards,
    insightLinks,
    healthRows,
    quickActions,
    myLinks,
    isLoadingAdminData,
    isRefreshing,
    refresh,
    lastUpdatedTimestamp,
    dashboardPollMs: DASHBOARD_POLL_MS,
  };
}
