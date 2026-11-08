import { logger } from '../../../core/logging/Logger';
import {
  enqueueServerFunctionJob,
  findActiveJobByCronSlot,
  findLastJobForScheduledTask,
} from '../../domain/jobs/jobRepository';
import {
  getSchedulerSettingsFromFile,
  saveSchedulerSettingsToFile,
  SchedulerValidationError,
} from '../../db/schedulerSettingsStore';
import { findManagedFunctionById } from '../../domain/functions/functionRepository';
import type { ScheduledTaskEntry, SchedulerSettings, SchedulerSnapshot } from '../../../shared/api/contracts/scheduler/types';
import {
  normalizeSchedulerSettings,
  previewCronRuns,
  validateScheduledTaskPayload,
} from '../../../shared/api/contracts/scheduler/validators';
import { getNextCronRun, getCatchUpCronSlot, isCronDue, resolveSchedulerTimezone } from './cronUtils';

export type SchedulerServiceDeps = {
  settingsPath: string;
};

const taskLastEvaluated = new Map<string, Date>();
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

const parsePayload = (task: ScheduledTaskEntry) => (
  task.payload && typeof task.payload === 'object' ? task.payload : {}
);

const enrichTaskRow = async (
  task: ScheduledTaskEntry,
  settings: SchedulerSettings,
): Promise<SchedulerSnapshot['tasks'][number]> => {
  const timezone = resolveSchedulerTimezone(settings.defaultTimezone);
  const managed = await findManagedFunctionById(task.functionId);
  const lastJob = await findLastJobForScheduledTask(task.id);
  const nextRunAt = getNextCronRun(task.cron, timezone).toISOString();

  return {
    ...task,
    lastRunAt: lastJob?.finished_at || lastJob?.started_at || lastJob?.created_at || null,
    lastRunStatus: lastJob?.status || null,
    nextRunAt,
    functionMissing: !managed,
  };
};

export class SchedulerService {
  constructor(private readonly deps: SchedulerServiceDeps) {}

  private readSettings(): SchedulerSettings {
    return getSchedulerSettingsFromFile(this.deps.settingsPath);
  }

  private writeSettings(settings: SchedulerSettings): SchedulerSettings {
    return saveSchedulerSettingsToFile(this.deps.settingsPath, settings);
  }

  async getSnapshot() {
    const settings = this.readSettings();
    const tasks = await Promise.all(settings.tasks.map((task) => enrichTaskRow(task, settings)));

    return {
      body: {
        success: true as const,
        scheduler: {
          ...settings,
          tasks,
        } satisfies SchedulerSnapshot,
      },
    };
  }

  replaceSettings(payload: unknown) {
    const normalized = normalizeSchedulerSettings(payload);
    const saved = this.writeSettings(normalized);
    return {
      body: {
        success: true as const,
        scheduler: saved,
      },
    };
  }

  addTask(payload: unknown) {
    const current = this.readSettings();
    const task = validateScheduledTaskPayload(payload, current.defaultTimezone);
    if (current.tasks.some((item) => item.id === task.id)) {
      throw new SchedulerValidationError(`Task id "${task.id}" already exists.`);
    }
    const saved = this.writeSettings({ ...current, tasks: [...current.tasks, task] });
    return {
      statusCode: 201,
      body: {
        success: true as const,
        task,
        scheduler: saved,
      },
    };
  }

  updateTask(taskId: string, payload: unknown) {
    const current = this.readSettings();
    const task = validateScheduledTaskPayload({ ...(payload as object), id: taskId }, current.defaultTimezone);
    if (!current.tasks.some((item) => item.id === taskId)) {
      throw new SchedulerValidationError(`Task "${taskId}" was not found.`);
    }
    const tasks = current.tasks.map((item) => (item.id === taskId ? task : item));
    const saved = this.writeSettings({ ...current, tasks });
    return {
      body: {
        success: true as const,
        task,
        scheduler: saved,
      },
    };
  }

  removeTask(taskId: string) {
    const current = this.readSettings();
    const tasks = current.tasks.filter((item) => item.id !== taskId);
    if (tasks.length === current.tasks.length) {
      throw new SchedulerValidationError(`Task "${taskId}" was not found.`);
    }
    const saved = this.writeSettings({ ...current, tasks });
    return {
      body: {
        success: true as const,
        scheduler: saved,
      },
    };
  }

  async runTaskNow(taskId: string) {
    const current = this.readSettings();
    const task = current.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new SchedulerValidationError(`Task "${taskId}" was not found.`);
    }

    const managed = await findManagedFunctionById(task.functionId);
    if (!managed) {
      throw new SchedulerValidationError(`Function "${task.functionId}" was not found.`);
    }

    const jobId = await enqueueServerFunctionJob({
      functionId: task.functionId,
      title: task.name,
      payload: parsePayload(task),
      metadata: {
        source: 'scheduled',
        scheduledTaskId: task.id,
        cron: task.cron,
        triggeredAt: new Date().toISOString(),
        trigger: 'manual',
      },
      createdBy: null,
    });

    return {
      statusCode: 201,
      body: {
        success: true as const,
        jobId,
      },
    };
  }

  previewCron(cron: string, timezone: string, count = 5) {
    const nextRuns = previewCronRuns(cron, timezone, count);
    return {
      body: {
        success: true as const,
        cron,
        timezone,
        nextRuns,
      },
    };
  }

  async evaluateDueTasks(now = new Date()) {
    const settings = this.readSettings();
    if (!settings.enabled) return;

    for (const task of settings.tasks) {
      if (!task.enabled) continue;

      const managed = await findManagedFunctionById(task.functionId);
      if (!managed) {
        logger.warn('Scheduler', `Skipping task "${task.id}" — function "${task.functionId}" is missing.`);
        continue;
      }

      const timezone = resolveSchedulerTimezone(settings.defaultTimezone);
      const lastEvaluatedAt = taskLastEvaluated.get(task.id) ?? null;
      const dueState = isCronDue(task.cron, timezone, lastEvaluatedAt, now);
      taskLastEvaluated.set(task.id, now);

      const slotsToEnqueue: string[] = [];

      if (dueState.due) {
        slotsToEnqueue.push(dueState.cronSlot);
      } else if (settings.missedRunPolicy === 'catch_up_once') {
        const catchUpSlot = getCatchUpCronSlot(task.cron, timezone, lastEvaluatedAt, now);
        if (catchUpSlot && catchUpSlot !== dueState.cronSlot) {
          slotsToEnqueue.push(catchUpSlot);
        }
      }

      for (const cronSlot of slotsToEnqueue) {
        const existing = await findActiveJobByCronSlot(task.id, cronSlot);
        if (existing) continue;

        const jobId = await enqueueServerFunctionJob({
          functionId: task.functionId,
          title: task.name,
          payload: parsePayload(task),
          metadata: {
            source: 'scheduled',
            scheduledTaskId: task.id,
            cron: task.cron,
            cronSlot,
            triggeredAt: now.toISOString(),
            trigger: cronSlot === dueState.cronSlot ? 'cron' : 'catch_up',
          },
          createdBy: null,
        });

        logger.info('Scheduler', `Enqueued scheduled task "${task.id}" as job #${jobId}.`, {
          taskId: task.id,
          functionId: task.functionId,
          cronSlot,
        });
      }
    }
  }
}

export const startSchedulerTicker = (service: SchedulerService, tickIntervalSec: number): void => {
  if (schedulerTimer) return;

  const intervalMs = Math.max(10, tickIntervalSec) * 1000;

  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await service.evaluateDueTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Scheduler', `Tick failed: ${message}`);
    } finally {
      schedulerRunning = false;
    }
  };

  void tick();
  schedulerTimer = setInterval(() => {
    void tick();
  }, intervalMs);

  logger.info('Scheduler', 'Scheduler ticker started.', { tickIntervalSec, intervalMs });
};

export const stopSchedulerTicker = (): void => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

export const reloadSchedulerTicker = (
  service: SchedulerService,
  tickIntervalSec: number,
): void => {
  stopSchedulerTicker();
  startSchedulerTicker(service, tickIntervalSec);
};
