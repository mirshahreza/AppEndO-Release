import { cacheManager, type CacheStatus } from '../../../core/cache/CacheManager';
import { listPackages } from '../../../core/packages/PackageArtifactService';
import { aiManager } from '../../../core/ai/AiManager';
import { countJobsByStatus, listRecentJobs } from '../../domain/jobs/jobRepository';
import { listAppLogsFiltered } from '../../domain/logs/appLogRepository';
import { countManagedFunctionCatalogRows } from '../../domain/functions/functionRepository';
import { countAllUsers } from '../../domain/users/userRepository';
import { getAgentStatsSummary } from '../../domain/ai/agentTraceRepository';
import { getControlPlanePool, isControlPlanePoolReady } from '../../db/controlPlane';
import { getPrismaControlPlane, isPrismaControlPlaneReady } from '../../db/prismaControlPlane';
import { getDataSourcesFromSettings, toApiDataSource } from '../../db/dataSourcesStore';
import { getSchedulerSettingsFromFile } from '../../db/schedulerSettingsStore';
import type { ScheduledTaskEntry, SchedulerSettings } from '../../../shared/api/contracts/scheduler/types';
import type { CacheStatusPayload } from '../../../shared/api/contracts/cache/types';
import type { DashboardSummaryPayload } from '../../../shared/api/contracts/dashboard/types';
import type { LogLevel } from '../../../shared/api/contracts/logs/types';
import { getNextCronRun, resolveSchedulerTimezone } from '../scheduler/cronUtils';
export type DashboardSummaryServiceDeps = {
  settingsPath: string;
};

const ACTIVITY_LOG_LIMIT = 8;
const ACTIVITY_JOB_LIMIT = 8;
const DASHBOARD_SUMMARY_TTL_MS = 30_000;

let cachedDashboardSummary: {
  body: { success: true; summary: DashboardSummaryPayload };
  expiresAt: number;
} | null = null;

export const invalidateDashboardSummaryCache = (): void => {
  cachedDashboardSummary = null;
};

const resolveNextSchedulerRun = (
  schedulerSettings: SchedulerSettings,
): { nextRunAt: string | null; nextRunTaskName: string | null } => {
  if (!schedulerSettings.enabled) {
    return { nextRunAt: null, nextRunTaskName: null };
  }

  const timezone = resolveSchedulerTimezone(schedulerSettings.defaultTimezone);
  const enabledTasks = schedulerSettings.tasks.filter((task) => task.enabled);
  if (enabledTasks.length === 0) {
    return { nextRunAt: null, nextRunTaskName: null };
  }

  let earliestTask: ScheduledTaskEntry | null = null;
  let earliestRun: Date | null = null;

  for (const task of enabledTasks) {
    const nextRun = getNextCronRun(task.cron, timezone);
    if (!earliestRun || nextRun.getTime() < earliestRun.getTime()) {
      earliestRun = nextRun;
      earliestTask = task;
    }
  }

  return {
    nextRunAt: earliestRun?.toISOString() ?? null,
    nextRunTaskName: earliestTask?.name ?? null,
  };
};

const toCacheStatusPayload = (status: CacheStatus): CacheStatusPayload => ({
  status: status.status.toLowerCase() as CacheStatusPayload['status'],
  driver: status.driver,
  keyCount: status.keyCount,
  lastError: status.lastError,
  isEnabled: status.isEnabled,
});

const toLogLevel = (value: string): LogLevel => {
  if (value === 'DEBUG' || value === 'INFO' || value === 'WARN' || value === 'ERROR') {
    return value;
  }
  return 'INFO';
};

export class DashboardSummaryService {
  constructor(private readonly deps: DashboardSummaryServiceDeps) {}

  async getSummary(): Promise<{ body: { success: true; summary: DashboardSummaryPayload } }> {
    if (cachedDashboardSummary && Date.now() < cachedDashboardSummary.expiresAt) {
      return { body: cachedDashboardSummary.body };
    }

    const [
      ready,
      users,
      pendingJobs,
      runningJobs,
      recentJobs,
      cacheStatus,
      dataSources,
      plugins,
      aiSettings,
      schedulerSettings,
      recentLogs,
      serverFunctionCount,
      agentStats,
    ] = await Promise.all([
      this.resolveReadyStatus(),
      countAllUsers(),
      countJobsByStatus('pending'),
      countJobsByStatus('running'),
      listRecentJobs(ACTIVITY_JOB_LIMIT, ['running', 'failed']),
      cacheManager.getCacheStatus(),
      Promise.resolve(getDataSourcesFromSettings(this.deps.settingsPath).map(toApiDataSource)),
      Promise.resolve(listPackages()),
      Promise.resolve(aiManager.getSettings()),
      Promise.resolve(getSchedulerSettingsFromFile(this.deps.settingsPath)),
      listAppLogsFiltered({
        limit: ACTIVITY_LOG_LIMIT,
        level: ['ERROR', 'WARN'],
        sortBy: 'timestamp',
        sortDir: 'desc',
      }).then((result) => result.items),
      countManagedFunctionCatalogRows(),
      getAgentStatsSummary(),
    ]);

    const connectedSources = dataSources.filter((item) => item.status === 'connected').length;
    const activePlugins = plugins.filter((item) => item.activeInstalledVersion).length;
    const enabledModels = aiSettings?.models.filter((model) => model.enabled) ?? [];
    const defaultModel = enabledModels.find((model) => model.id === aiSettings?.defaultModelId)
      ?? enabledModels.find((model) => model.isDefault)
      ?? enabledModels[0]
      ?? null;

    const activityLogs = recentLogs
      .slice(0, ACTIVITY_LOG_LIMIT)
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        level: toLogLevel(item.level),
        context: item.context,
        message: item.message,
      }));

    const activityJobs = recentJobs
      .slice(0, ACTIVITY_JOB_LIMIT)
      .map((item) => ({
        id: item.id,
        status: item.status,
        job_type: item.job_type,
        started_at: item.started_at,
        queued_at: item.queued_at,
        created_at: item.created_at,
        error_message: item.error_message,
        progress_message: item.progress_message,
      }));

    const nextSchedulerRun = resolveNextSchedulerRun(schedulerSettings);

    const cachePayload = toCacheStatusPayload(cacheStatus);
    const health: DashboardSummaryPayload['health'] = ready !== 'ready'
      ? 'unknown'
      : cachePayload.isEnabled && cachePayload.status === 'error'
        ? 'unknown'
        : cachePayload.isEnabled && cachePayload.status === 'disconnected'
          ? 'unknown'
          : 'ok';

    const result = {
      body: {
        success: true as const,
        summary: {
          generatedAt: new Date().toISOString(),
          health,
          ready,
          users: {
            count: users,
          },
          jobs: {
            pending: pendingJobs,
            running: runningJobs,
          },
          scheduler: {
            enabled: schedulerSettings.enabled,
            activeTaskCount: schedulerSettings.tasks.filter((task) => task.enabled).length,
            nextRunAt: nextSchedulerRun.nextRunAt,
            nextRunTaskName: nextSchedulerRun.nextRunTaskName,
          },
          serverFunctions: {
            count: serverFunctionCount,
          },
          cache: cachePayload,
          dataSources: {
            total: dataSources.length,
            connected: connectedSources,
          },
          plugins: {
            total: plugins.length,
            active: activePlugins,
          },
          ai: {
            enabled: aiSettings?.enabled ?? false,
            enabledModelCount: enabledModels.length,
            providerCount: aiSettings?.providers.length ?? 0,
            defaultModelId: aiSettings?.defaultModelId ?? '',
            defaultModelName: defaultModel?.name ?? null,
          },
          agentStats,
          activity: {
            logs: activityLogs,
            jobs: activityJobs,
          },
        },
      },
    };

    cachedDashboardSummary = {
      body: result.body,
      expiresAt: Date.now() + DASHBOARD_SUMMARY_TTL_MS,
    };

    return result;
  }

  private async resolveReadyStatus(): Promise<DashboardSummaryPayload['ready']> {
    try {
      if (isControlPlanePoolReady()) {
        await getControlPlanePool().query('SELECT 1');
        return 'ready';
      }

      if (!isPrismaControlPlaneReady()) {
        return 'not_ready';
      }

      await getPrismaControlPlane().$queryRaw`SELECT 1`;
      return 'ready';
    } catch {
      return 'not_ready';
    }
  }
}
