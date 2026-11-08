import type { MountExperienceCalendar } from '../api/contracts/platform/types';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatYmdParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseUtcDateParts(value: string): { year: number; month: number; day: number } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

// Jalaali conversion (algorithm aligned with jalaali-js).
function gregorianToJalaliParts(
  gregorianYear: number,
  gregorianMonth: number,
  gregorianDay: number,
): { year: number; month: number; day: number } {
  const gregorianDaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const jalaaliDaysInMonth = [0, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let gy = gregorianYear - 1600;
  let gm = gregorianMonth - 1;
  let gd = gregorianDay - 1;

  let gDayNo =
    365 * gy
    + Math.floor((gy + 3) / 4)
    - Math.floor((gy + 99) / 100)
    + Math.floor((gy + 399) / 400);

  for (let index = 0; index < gm; index += 1) {
    gDayNo += gregorianDaysInMonth[index + 1];
  }

  if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) {
    gDayNo += 1;
  }

  gDayNo += gd;

  let jDayNo = gDayNo - 79;
  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;

  let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jy += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  let jm = 0;
  for (let index = 1; index <= 12 && jDayNo >= jalaaliDaysInMonth[index]; index += 1) {
    jDayNo -= jalaaliDaysInMonth[index];
    jm = index;
  }

  const jd = jDayNo + 1;
  jm += 1;

  return { year: jy, month: jm, day: jd };
}

function gregorianToJulianDay(
  gregorianYear: number,
  gregorianMonth: number,
  gregorianDay: number,
): number {
  let year = gregorianYear;
  let month = gregorianMonth;

  if (month <= 2) {
    year -= 1;
    month += 12;
  }

  const century = Math.floor(year / 100);
  const centuryAdjustment = 2 - century + Math.floor(century / 4);

  return (
    Math.floor(365.25 * (year + 4716))
    + Math.floor(30.6001 * (month + 1))
    + gregorianDay
    + centuryAdjustment
    - 1524
  );
}

// Tabular Islamic calendar (Kuwaiti algorithm variant).
function gregorianToHijriParts(
  gregorianYear: number,
  gregorianMonth: number,
  gregorianDay: number,
): { year: number; month: number; day: number } {
  const julianDay = gregorianToJulianDay(gregorianYear, gregorianMonth, gregorianDay);
  const l = julianDay - 1948440 + 10632;
  const cycle = Math.floor((l - 1) / 10631);
  let remaining = l - 10631 * cycle + 354;
  const leapIndex = (
    Math.floor((10985 - remaining) / 5316) * Math.floor((50 * remaining) / 17719)
    + Math.floor(remaining / 5670) * Math.floor((43 * remaining) / 15238)
  );
  remaining = (
    remaining
    - Math.floor((30 - leapIndex) / 15) * Math.floor((17719 * leapIndex) / 50)
    - Math.floor(leapIndex / 16) * Math.floor((15238 * leapIndex) / 43)
    + 29
  );
  const month = Math.floor((24 * remaining) / 709);
  const day = remaining - Math.floor((709 * month) / 24);
  const year = 30 * cycle + leapIndex - 30;

  return { year, month, day };
}

/** App-wide display: Gregorian UTC `YYYY-MM-DD` (empty → `-`). */
/** Normalize grid/API date values to `YYYY-MM-DD` (or ISO) for formatters. */
export function normalizeGridDateInput(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString();
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toISOString();
}

export function formatDisplayDateYmd(value: string | null | undefined, empty = '-'): string {
  if (!value) {
    return empty;
  }

  const parts = parseUtcDateParts(value);
  if (!parts) {
    return empty;
  }

  return formatYmdParts(parts.year, parts.month, parts.day);
}

/** Build `YYYY-MM-DD` from separate year/month/day fields (e.g. birth date). */
export function formatDisplayDateYmdFromParts(
  year: string | number | null | undefined,
  month: string | number | null | undefined,
  day: string | number | null | undefined,
  empty = '',
): string {
  const y = year === null || year === undefined ? '' : String(year).trim();
  const m = month === null || month === undefined ? '' : String(month).trim();
  const d = day === null || day === undefined ? '' : String(day).trim();
  if (!y && !m && !d) {
    return empty;
  }
  if (!y || !m || !d) {
    return [y, m, d].filter(Boolean).join('-');
  }
  return formatYmdParts(Number(y), Number(m), Number(d));
}

export function formatGridDateForCalendar(
  value: string | null | undefined,
  calendar: MountExperienceCalendar = 'gregorian',
): string {
  if (!value) {
    return '-';
  }

  const parts = parseUtcDateParts(value);
  if (!parts) {
    return '-';
  }

  if (calendar === 'jalali') {
    const jalali = gregorianToJalaliParts(parts.year, parts.month, parts.day);
    return formatYmdParts(jalali.year, jalali.month, jalali.day);
  }

  if (calendar === 'hijri') {
    const hijri = gregorianToHijriParts(parts.year, parts.month, parts.day);
    return formatYmdParts(hijri.year, hijri.month, hijri.day);
  }

  return formatYmdParts(parts.year, parts.month, parts.day);
}
