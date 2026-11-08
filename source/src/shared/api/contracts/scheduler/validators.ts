import type { ScheduledTaskEntry, SchedulerSettings } from './types';
import { DEFAULT_SCHEDULER_SETTINGS } from './constants';
import { parseCronIterator, previewCronRunTimes } from '../../../lib/cronSchedule';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/i;

export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const parseCronExpression = (cron: string, timezone: string) => {
  const expression = String(cron || '').trim();
  if (!expression) {
    throw new SchedulerValidationError('Cron expression is required.');
  }

  const fields = expression.split(/\s+/);
  if (fields.length !== 5) {
    throw new SchedulerValidationError('Cron must use exactly 5 whitespace-separated fields (Linux/Vixie format).');
  }

  try {
    return parseCronIterator(expression, {
      currentDate: new Date(),
      tz: timezone || 'UTC',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid cron expression.';
    throw new SchedulerValidationError(message);
  }
};

export const previewCronRuns = (cron: string, timezone: string, count = 5): string[] => {
  parseCronExpression(cron, timezone);
  return previewCronRunTimes(cron, timezone, count);
};

const normalizeTaskEntry = (input: unknown, index: number, defaultTimezone: string): ScheduledTaskEntry => {
  if (!isRecord(input)) {
    throw new SchedulerValidationError(`Task at index ${index} must be an object.`);
  }

  const id = String(input.id ?? '').trim();
  const name = String(input.name ?? '').trim();
  const functionId = String(input.functionId ?? '').trim();
  const cron = String(input.cron ?? '').trim();

  if (!id || !SLUG_PATTERN.test(id)) {
    throw new SchedulerValidationError(`Task id "${id || '(empty)'}" is invalid. Use letters, numbers, dots, dashes, or underscores.`);
  }
  if (!name) {
    throw new SchedulerValidationError(`Task "${id}" requires a name.`);
  }
  if (!functionId) {
    throw new SchedulerValidationError(`Task "${id}" requires functionId.`);
  }
  if (!cron) {
    throw new SchedulerValidationError(`Task "${id}" requires a cron expression.`);
  }

  parseCronExpression(cron, defaultTimezone);

  let payload: Record<string, unknown> | undefined;
  if (input.payload !== undefined && input.payload !== null) {
    if (!isRecord(input.payload)) {
      throw new SchedulerValidationError(`Task "${id}" payload must be a JSON object.`);
    }
    payload = input.payload;
  }

  const note = input.note !== undefined && input.note !== null
    ? String(input.note)
    : undefined;

  return {
    id,
    name,
    enabled: Boolean(input.enabled),
    functionId,
    cron,
    payload,
    note,
  };
};

export const normalizeSchedulerSettings = (raw: unknown): SchedulerSettings => {
  const defaults = DEFAULT_SCHEDULER_SETTINGS;
  const input = isRecord(raw) ? raw : {};

  const tickIntervalSec = Number(input.tickIntervalSec ?? defaults.tickIntervalSec);
  if (!Number.isFinite(tickIntervalSec) || tickIntervalSec < 10 || tickIntervalSec > 3600) {
    throw new SchedulerValidationError('tickIntervalSec must be between 10 and 3600 seconds.');
  }

  const defaultTimezone = String(input.defaultTimezone ?? defaults.defaultTimezone).trim() || 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: defaultTimezone });
  } catch {
    throw new SchedulerValidationError(`defaultTimezone "${defaultTimezone}" is invalid.`);
  }

  const rawTasks = Array.isArray(input.tasks) ? input.tasks : defaults.tasks;
  const tasks = rawTasks.map((task, index) => normalizeTaskEntry(task, index, defaultTimezone));

  const seenIds = new Set<string>();
  tasks.forEach((task) => {
    if (seenIds.has(task.id)) {
      throw new SchedulerValidationError(`Duplicate task id "${task.id}".`);
    }
    seenIds.add(task.id);
  });

  const missedRunPolicyRaw = String(input.missedRunPolicy ?? defaults.missedRunPolicy).trim();
  const missedRunPolicy = missedRunPolicyRaw === 'catch_up_once' ? 'catch_up_once' : 'skip';

  return {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : defaults.enabled,
    tickIntervalSec: Math.floor(tickIntervalSec),
    defaultTimezone,
    missedRunPolicy,
    tasks,
  };
};

export const validateScheduledTaskPayload = (
  payload: unknown,
  defaultTimezone = DEFAULT_SCHEDULER_SETTINGS.defaultTimezone,
): ScheduledTaskEntry => (
  normalizeTaskEntry(payload, 0, defaultTimezone)
);
