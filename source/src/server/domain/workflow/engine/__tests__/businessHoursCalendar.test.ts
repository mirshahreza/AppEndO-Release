import { describe, expect, it } from 'vitest';
import { addBusinessMilliseconds, hasBusinessMillisecondsElapsed, type BusinessHoursCalendarConfig } from '../businessHoursCalendar';

const MON_FRI: BusinessHoursCalendarConfig = {
  workingDays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '17:00',
  holidays: [],
};

const HOUR = 60 * 60 * 1000;

describe('businessHoursCalendar (HWF-2.2, pure algorithm)', () => {
  it('adds business ms within the same working day when it fits', () => {
    const from = new Date('2026-08-31T10:00:00.000Z'); // Monday 10:00 UTC
    const result = addBusinessMilliseconds(MON_FRI, from, 2 * HOUR);
    expect(result.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('rolls an instant that starts outside business hours to the next business-hours start first', () => {
    const from = new Date('2026-08-31T20:00:00.000Z'); // Monday 20:00 UTC — after hours
    const result = addBusinessMilliseconds(MON_FRI, from, 1 * HOUR);
    expect(result.toISOString()).toBe('2026-09-01T10:00:00.000Z'); // Tuesday 09:00 + 1h
  });

  it('spills over into the next working day when the duration exceeds the remaining hours today', () => {
    const from = new Date('2026-08-31T16:00:00.000Z'); // Monday 16:00 UTC — 1h left today
    const result = addBusinessMilliseconds(MON_FRI, from, 3 * HOUR); // 1h today + 2h tomorrow
    expect(result.toISOString()).toBe('2026-09-01T11:00:00.000Z');
  });

  it('skips a weekend entirely', () => {
    const from = new Date('2026-09-04T16:00:00.000Z'); // Friday 16:00 UTC — 1h left today
    const result = addBusinessMilliseconds(MON_FRI, from, 2 * HOUR); // 1h Friday + 1h Monday
    expect(result.toISOString()).toBe('2026-09-07T10:00:00.000Z'); // Monday 2026-09-07
  });

  it('skips a configured holiday even though it falls on a working weekday', () => {
    const withHoliday: BusinessHoursCalendarConfig = { ...MON_FRI, holidays: ['2026-09-01'] }; // Tuesday
    const from = new Date('2026-08-31T16:00:00.000Z'); // Monday 16:00 — 1h left today
    const result = addBusinessMilliseconds(withHoliday, from, 2 * HOUR); // 1h Monday + 1h Wednesday (Tuesday is a holiday)
    expect(result.toISOString()).toBe('2026-09-02T10:00:00.000Z');
  });

  it('hasBusinessMillisecondsElapsed reflects the same calendar-aware computation as a boolean', () => {
    const from = new Date('2026-08-31T20:00:00.000Z'); // Monday after hours
    expect(hasBusinessMillisecondsElapsed(MON_FRI, from, 1 * HOUR, new Date('2026-09-01T10:30:00.000Z'))).toBe(true);
    expect(hasBusinessMillisecondsElapsed(MON_FRI, from, 1 * HOUR, new Date('2026-09-01T09:30:00.000Z'))).toBe(false);
  });
});
