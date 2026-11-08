import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import {
  DEFAULT_SCHEDULER_SETTINGS,
  SAMPLE_SCHEDULER_FUNCTION_ID,
  SAMPLE_SCHEDULER_TASK_ID,
} from '../../shared/api/contracts/scheduler/constants';
import {
  normalizeSchedulerSettings,
  SchedulerValidationError,
} from '../../shared/api/contracts/scheduler/validators';
import type { ScheduledTaskEntry, SchedulerSettings } from '../../shared/api/contracts/scheduler/types';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';

const SCHEDULER_SETTINGS_KEY = 'scheduler';

export { SchedulerValidationError };

export const getSchedulerSettingsFromFile = (settingsPath: string): SchedulerSettings => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[SCHEDULER_SETTINGS_KEY];
  try {
    return normalizeSchedulerSettings(raw);
  } catch {
    return { ...DEFAULT_SCHEDULER_SETTINGS, tasks: [...DEFAULT_SCHEDULER_SETTINGS.tasks] };
  }
};

export const saveSchedulerSettingsToFile = (
  settingsPath: string,
  scheduler: SchedulerSettings,
): SchedulerSettings => {
  const normalized = normalizeSchedulerSettings(scheduler);
  const settings = readSettingsObject(settingsPath);
  settings[SCHEDULER_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

const normalizeSchedulerBlob = (raw: Record<string, unknown>): SchedulerSettings => {
  try {
    return normalizeSchedulerSettings(raw);
  } catch {
    return { ...DEFAULT_SCHEDULER_SETTINGS, tasks: [...DEFAULT_SCHEDULER_SETTINGS.tasks] };
  }
};

export const getSchedulerSettings = (settingsPath: string): SchedulerSettings =>
  readPlatformBlob(settingsPath, 'scheduler', getSchedulerSettingsFromFile, normalizeSchedulerBlob);

export const saveSchedulerSettings = (
  settingsPath: string,
  scheduler: SchedulerSettings,
): SchedulerSettings => {
  const normalized = normalizeSchedulerSettings(scheduler);
  return writePlatformBlob(
    settingsPath,
    'scheduler',
    normalized as unknown as Record<string, unknown>,
    saveSchedulerSettingsToFile,
  ) as unknown as SchedulerSettings;
};

export const ensureSchedulerSettings = (settingsPath: string): SchedulerSettings =>
  getSchedulerSettings(settingsPath);

export const mergeSchedulerTask = (
  settingsPath: string,
  task: ScheduledTaskEntry,
): SchedulerSettings => {
  const current = getSchedulerSettings(settingsPath);
  const normalizedTask = normalizeSchedulerSettings({ ...current, tasks: [task] }).tasks[0];
  const exists = current.tasks.some((item) => item.id === normalizedTask.id);
  const tasks = exists
    ? current.tasks.map((item) => (item.id === normalizedTask.id ? normalizedTask : item))
    : [...current.tasks, normalizedTask];

  return saveSchedulerSettings(settingsPath, { ...current, tasks });
};

export const removeSchedulerTask = (settingsPath: string, taskId: string): SchedulerSettings => {
  const current = getSchedulerSettings(settingsPath);
  const tasks = current.tasks.filter((item) => item.id !== taskId);
  if (tasks.length === current.tasks.length) {
    throw new SchedulerValidationError(`Task "${taskId}" was not found.`);
  }
  return saveSchedulerSettings(settingsPath, { ...current, tasks });
};

export const getSampleSchedulerSeed = () => ({
  functionId: SAMPLE_SCHEDULER_FUNCTION_ID,
  taskId: SAMPLE_SCHEDULER_TASK_ID,
});
