import type { SchedulerSettings } from './types';

export const SAMPLE_SCHEDULER_FUNCTION_ID = 'scheduler.sample-heartbeat';

export const SAMPLE_SCHEDULER_TASK_ID = 'sample-heartbeat-every-minute';

export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  enabled: true,
  tickIntervalSec: 60,
  defaultTimezone: 'UTC',
  missedRunPolicy: 'skip',
  tasks: [],
};
