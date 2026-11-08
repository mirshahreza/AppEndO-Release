import { parseCronIterator } from '../../../shared/lib/cronSchedule';
import { previewCronRuns } from '../../../shared/api/contracts/scheduler/validators';

export const resolveSchedulerTimezone = (defaultTimezone: string): string => (
  String(defaultTimezone || 'UTC').trim() || 'UTC'
);

export const getNextCronRun = (cron: string, timezone: string, fromDate = new Date()): Date => {
  const iterator = parseCronIterator(cron, {
    currentDate: fromDate,
    tz: timezone,
  });
  return iterator.next().toDate();
};

export const getCurrentCronSlot = (cron: string, timezone: string, now = new Date()): string => {
  const iterator = parseCronIterator(cron, {
    currentDate: now,
    tz: timezone,
  });
  return iterator.prev().toDate().toISOString();
};

export const isCronDue = (
  cron: string,
  timezone: string,
  lastEvaluatedAt: Date | null,
  now = new Date(),
): { due: boolean; cronSlot: string; nextRunAt: string } => {
  const cronSlot = getCurrentCronSlot(cron, timezone, now);
  const slotStart = new Date(cronSlot);
  const nextRunAt = getNextCronRun(cron, timezone, slotStart).toISOString();

  if (now < slotStart) {
    return { due: false, cronSlot, nextRunAt };
  }

  if (!lastEvaluatedAt || lastEvaluatedAt < slotStart) {
    return { due: true, cronSlot, nextRunAt };
  }

  return { due: false, cronSlot, nextRunAt };
};

export const getCatchUpCronSlot = (
  cron: string,
  timezone: string,
  lastEvaluatedAt: Date | null,
  now = new Date(),
): string | null => {
  if (!lastEvaluatedAt) return null;

  const currentSlot = getCurrentCronSlot(cron, timezone, now);
  const currentSlotStart = new Date(currentSlot);
  if (lastEvaluatedAt >= currentSlotStart) return null;

  const iterator = parseCronIterator(cron, {
    currentDate: currentSlotStart,
    tz: timezone,
  });
  const previousSlotStart = iterator.prev().toDate();
  const previousSlot = previousSlotStart.toISOString();

  if (lastEvaluatedAt >= previousSlotStart) return null;
  if (previousSlot === currentSlot) return null;

  return previousSlot;
};

export { previewCronRuns };
