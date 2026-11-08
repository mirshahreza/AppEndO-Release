/**
 * HWF-2.2 — Business Hours Calendar (per user decision 2026-08-30: single global calendar, opt-in
 * per escalation step, default off so no existing workflow's behavior changes silently).
 *
 * Documented V1 scope boundary: all times are interpreted as UTC wall-clock (the calendar's
 * `startTime`/`endTime` are UTC hours, `workingDays` are UTC weekdays) — the same "no DB-native
 * transaction-clock primitive, application-process UTC wall clock is the established convention"
 * finding Slice 5 already documented for the engine's canonical clock. Real per-user timezone
 * conversion is deliberately out of scope for this round.
 */

export type BusinessHoursCalendarConfig = {
  /** 0 = Sunday .. 6 = Saturday (UTC), matching `Date.prototype.getUTCDay()`. */
  workingDays: number[];
  /** "HH:MM", UTC, e.g. "09:00". */
  startTime: string;
  /** "HH:MM", UTC, e.g. "17:00". */
  endTime: string;
  /** "YYYY-MM-DD" UTC calendar dates, entirely excluded regardless of `workingDays`. */
  holidays: string[];
};

const MAX_DAYS_TO_SEARCH = 3650; // ~10 years — guards against a misconfigured calendar (e.g. zero working days) looping forever.

const parseHm = (value: string): { hour: number; minute: number } => {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  return { hour: hour || 0, minute: minute || 0 };
};

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const isWorkingDay = (config: BusinessHoursCalendarConfig, date: Date): boolean =>
  config.workingDays.includes(date.getUTCDay()) && !config.holidays.includes(toDateKey(date));

const dayStart = (config: BusinessHoursCalendarConfig, date: Date): Date => {
  const { hour, minute } = parseHm(config.startTime);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0));
};

const dayEnd = (config: BusinessHoursCalendarConfig, date: Date): Date => {
  const { hour, minute } = parseHm(config.endTime);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0));
};

const nextDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));

/** The next instant at/after `from` that falls inside a working day's business-hours window. */
function nextBusinessInstant(config: BusinessHoursCalendarConfig, from: Date): Date {
  let cursor = from;
  for (let i = 0; i < MAX_DAYS_TO_SEARCH; i += 1) {
    if (isWorkingDay(config, cursor)) {
      const start = dayStart(config, cursor);
      const end = dayEnd(config, cursor);
      if (cursor < start) return start;
      if (cursor <= end) return cursor;
    }
    cursor = dayStart(config, nextDay(cursor));
  }
  throw new Error('BusinessHoursCalendar.nextBusinessInstant: no working day found within the search horizon — check workingDays/holidays configuration.');
}

/**
 * Adds `ms` of BUSINESS time (not wall-clock time) to `from`, skipping non-working days, holidays,
 * and hours outside `[startTime, endTime)`. This is the calendar-aware replacement for a plain
 * `from.getTime() + ms` due-instant computation.
 */
export function addBusinessMilliseconds(config: BusinessHoursCalendarConfig, from: Date, ms: number): Date {
  if (ms <= 0) return nextBusinessInstant(config, from);
  let remainingMs = ms;
  let cursor = nextBusinessInstant(config, from);
  for (let i = 0; i < MAX_DAYS_TO_SEARCH; i += 1) {
    const end = dayEnd(config, cursor);
    const availableMsToday = end.getTime() - cursor.getTime();
    if (remainingMs <= availableMsToday) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= availableMsToday;
    cursor = nextBusinessInstant(config, dayStart(config, nextDay(cursor)));
  }
  throw new Error('BusinessHoursCalendar.addBusinessMilliseconds: could not resolve within the search horizon — check workingDays/holidays configuration.');
}

/** Convenience: "has at least `ms` of business time elapsed between `from` and `now`?" — used by the escalation scanner's due-check when a step opts into calendar-awareness. */
export function hasBusinessMillisecondsElapsed(config: BusinessHoursCalendarConfig, from: Date, ms: number, now: Date = new Date()): boolean {
  return addBusinessMilliseconds(config, from, ms).getTime() <= now.getTime();
}
