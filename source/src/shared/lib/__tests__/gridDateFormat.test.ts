import { describe, expect, it } from 'vitest';
import { formatDisplayDateYmd, formatGridDateForCalendar } from '../gridDateFormat';

describe('formatDisplayDateYmd', () => {
  it('formats ISO timestamps as Gregorian YYYY-MM-DD (UTC)', () => {
    expect(formatDisplayDateYmd('2026-06-15T14:30:00.000Z')).toBe('2026-06-15');
    expect(formatDisplayDateYmd(null)).toBe('-');
    expect(formatDisplayDateYmd('invalid')).toBe('-');
  });
});

describe('formatGridDateForCalendar', () => {
  it('formats gregorian dates as YYYY-MM-DD in UTC', () => {
    expect(formatGridDateForCalendar('2026-06-15T14:30:00.000Z', 'gregorian')).toBe('2026-06-15');
    expect(formatGridDateForCalendar('2026-06-15T14:30:00.000Z')).toBe('2026-06-15');
  });

  it('formats jalali dates as YYYY-MM-DD without locale formatting', () => {
    expect(formatGridDateForCalendar('2026-06-15T14:30:00.000Z', 'jalali')).toBe('1405-03-25');
    expect(formatGridDateForCalendar('2024-01-01T00:00:00.000Z', 'jalali')).toBe('1402-10-11');
  });

  it('formats hijri dates as YYYY-MM-DD without locale formatting', () => {
    expect(formatGridDateForCalendar('2026-06-15T14:30:00.000Z', 'hijri')).toBe('1447-12-29');
  });

  it('returns dash for empty or invalid values', () => {
    expect(formatGridDateForCalendar(null, 'jalali')).toBe('-');
    expect(formatGridDateForCalendar(undefined, 'gregorian')).toBe('-');
    expect(formatGridDateForCalendar('invalid', 'gregorian')).toBe('-');
  });
});
