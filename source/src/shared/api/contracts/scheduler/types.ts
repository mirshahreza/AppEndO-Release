export type MissedRunPolicy = 'skip' | 'catch_up_once';

export type ScheduledTaskEntry = {
  id: string;
  name: string;
  enabled: boolean;
  functionId: string;
  cron: string;
  payload?: Record<string, unknown>;
  note?: string;
};

export type SchedulerSettings = {
  enabled: boolean;
  tickIntervalSec: number;
  defaultTimezone: string;
  missedRunPolicy: MissedRunPolicy;
  tasks: ScheduledTaskEntry[];
};

export type ScheduledTaskGridRow = ScheduledTaskEntry & {
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  functionMissing: boolean;
};

export type SchedulerSnapshot = SchedulerSettings & {
  tasks: ScheduledTaskGridRow[];
};

export type CronPreviewResponse = {
  cron: string;
  timezone: string;
  nextRuns: string[];
};
