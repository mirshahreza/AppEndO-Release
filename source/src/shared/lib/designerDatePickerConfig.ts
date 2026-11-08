import { parseDate, parseDateTime } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';

export type DesignerDatePickerCalendarSystem = 'gregorian' | 'jalali' | 'hijri' | 'hebrew';

export type DesignerDatePickerGranularity = 'day' | 'hour' | 'minute' | 'second';

export type DesignerDatePickerHourCycle = '12' | '24' | 'auto';

export type DesignerDatePickerFirstDayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const DESIGNER_DATE_PICKER_CALENDAR_SYSTEMS: DesignerDatePickerCalendarSystem[] = [
  'gregorian',
  'jalali',
  'hijri',
  'hebrew',
];

export const DESIGNER_DATE_PICKER_GRANULARITIES: DesignerDatePickerGranularity[] = [
  'day',
  'hour',
  'minute',
  'second',
];

const CALENDAR_UNICODE_EXTENSION: Record<DesignerDatePickerCalendarSystem, string> = {
  gregorian: 'gregory',
  jalali: 'persian',
  hijri: 'islamic',
  hebrew: 'hebrew',
};

const DEFAULT_LOCALE_BY_CALENDAR: Record<DesignerDatePickerCalendarSystem, string> = {
  gregorian: 'en-US',
  jalali: 'fa-IR',
  hijri: 'ar-SA',
  hebrew: 'he-IL',
};

export type DesignerDatePickerInspectorOption = { value: string; label: string };

export const DESIGNER_DATE_PICKER_LOCALE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: 'Auto (from calendar)' },
  { value: 'en-US', label: 'English — United States (en-US)' },
  { value: 'en-GB', label: 'English — United Kingdom (en-GB)' },
  { value: 'fa-IR', label: 'Persian — Iran (fa-IR)' },
  { value: 'fa-AF', label: 'Persian — Afghanistan (fa-AF)' },
  { value: 'ar-SA', label: 'Arabic — Saudi Arabia (ar-SA)' },
  { value: 'ar-IQ', label: 'Arabic — Iraq (ar-IQ)' },
  { value: 'ar-EG', label: 'Arabic — Egypt (ar-EG)' },
  { value: 'ar-AE', label: 'Arabic — UAE (ar-AE)' },
  { value: 'he-IL', label: 'Hebrew — Israel (he-IL)' },
  { value: 'de-DE', label: 'German — Germany (de-DE)' },
  { value: 'fr-FR', label: 'French — France (fr-FR)' },
  { value: 'tr-TR', label: 'Turkish — Turkey (tr-TR)' },
  { value: 'ur-PK', label: 'Urdu — Pakistan (ur-PK)' },
];

export const DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: 'Auto (local)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Tehran', label: 'Asia/Tehran (Iran)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE)' },
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad (Iraq)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (Saudi Arabia)' },
  { value: 'Asia/Kabul', label: 'Asia/Kabul (Afghanistan)' },
  { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem (Israel)' },
  { value: 'Europe/London', label: 'Europe/London (UK)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (Germany)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (France)' },
  { value: 'America/New_York', label: 'America/New_York (US East)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (US West)' },
];

export const DESIGNER_DATE_PICKER_VISIBLE_MONTHS_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '1', label: '1 month' },
  { value: '2', label: '2 months' },
  { value: '3', label: '3 months' },
];

export const DESIGNER_DATE_PICKER_VALUE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: '(empty)' },
  { value: '2024-01-01', label: '2024-01-01' },
  { value: '2024-06-15', label: '2024-06-15' },
  { value: '2025-12-31', label: '2025-12-31' },
  { value: '1403-01-01', label: '1403-01-01 (Jalali sample)' },
  { value: '1403-06-15', label: '1403-06-15 (Jalali sample)' },
  { value: '1445-01-01', label: '1445-01-01 (Hijri sample)' },
  { value: '2024-03-07T09:00', label: '2024-03-07T09:00 (with hour)' },
  { value: '2024-03-07T14:30', label: '2024-03-07T14:30 (with minute)' },
  { value: '2024-03-07T14:30:00', label: '2024-03-07T14:30:00 (with second)' },
];

export const DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: '(no limit)' },
  { value: '2020-01-01', label: '2020-01-01' },
  { value: '2024-01-01', label: '2024-01-01' },
  { value: '2030-12-31', label: '2030-12-31' },
  { value: '1400-01-01', label: '1400-01-01 (Jalali range start)' },
  { value: '1410-12-29', label: '1410-12-29 (Jalali range end)' },
  { value: '2024-03-07T00:00', label: '2024-03-07T00:00 (start of day)' },
  { value: '2024-03-07T23:59', label: '2024-03-07T23:59 (end of day)' },
  { value: '2024-03-07T14:30:00', label: '2024-03-07T14:30:00' },
];

export const DESIGNER_DATE_PICKER_PLACEHOLDER_VALUE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: '(default empty segments)' },
  { value: '2024-01-01', label: '2024-01-01' },
  { value: '2024-03-07T00:00', label: '2024-03-07T00:00' },
  { value: '2024-03-07T14:30', label: '2024-03-07T14:30' },
  { value: '1403-01-01', label: '1403-01-01 (Jalali sample)' },
];

export const DESIGNER_DATE_PICKER_GRANULARITY_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: 'day', label: 'Date only (day)' },
  { value: 'hour', label: 'Date + hour' },
  { value: 'minute', label: 'Date + minute' },
  { value: 'second', label: 'Date + second' },
];

export const DESIGNER_DATE_PICKER_HOUR_CYCLE_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: 'auto', label: 'Auto (from locale)' },
  { value: '12', label: '12-hour (AM/PM)' },
  { value: '24', label: '24-hour' },
];

export const DESIGNER_DATE_PICKER_FIRST_DAY_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: '', label: 'Auto (from locale)' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
];

export const DESIGNER_DATE_PICKER_PAGE_BEHAVIOR_OPTIONS: DesignerDatePickerInspectorOption[] = [
  { value: 'visible', label: 'Page by visible months' },
  { value: 'single', label: 'Page one month at a time' },
];

export const toDesignerDatePickerSelectOptions = (
  options: DesignerDatePickerInspectorOption[],
): Array<{ value: string; label: string }> => options.map((option) => ({ ...option }));

export const normalizeDesignerDatePickerCalendarSystem = (
  value: unknown,
): DesignerDatePickerCalendarSystem => {
  if (
    value === 'gregorian'
    || value === 'jalali'
    || value === 'hijri'
    || value === 'hebrew'
  ) {
    return value;
  }
  return 'gregorian';
};

export const normalizeDesignerDatePickerGranularity = (
  value: unknown,
): DesignerDatePickerGranularity => {
  if (value === 'hour' || value === 'minute' || value === 'second') {
    return value;
  }
  return 'day';
};

export const normalizeDesignerDatePickerHourCycle = (
  value: unknown,
): DesignerDatePickerHourCycle => {
  if (value === '12' || value === '24') {
    return value;
  }
  return 'auto';
};

export const resolveDatePickerI18nLocale = (
  calendarSystemInput: unknown,
  localeOverride?: string,
): string => {
  const calendarSystem = normalizeDesignerDatePickerCalendarSystem(calendarSystemInput);
  const baseLocale = (localeOverride?.trim() || DEFAULT_LOCALE_BY_CALENDAR[calendarSystem])
    .replace(/-u-ca-[a-z-]+/gi, '');
  return `${baseLocale}-u-ca-${CALENDAR_UNICODE_EXTENSION[calendarSystem]}`;
};

const normalizeDateTimeInput = (raw: string, granularity: DesignerDatePickerGranularity): string => {
  const trimmed = raw.trim();
  if (granularity === 'day') {
    return trimmed.split('T')[0]?.split(' ')[0] ?? trimmed;
  }

  if (trimmed.includes('T')) {
    if (granularity === 'hour' && /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(trimmed)) {
      return `${trimmed}:00:00`;
    }
    if (granularity === 'minute' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00`;
  }

  return trimmed;
};

export const parseDesignerDatePickerValue = (
  raw: string | undefined,
  granularityInput: unknown,
): DateValue | undefined => {
  if (!raw?.trim()) {
    return undefined;
  }

  const granularity = normalizeDesignerDatePickerGranularity(granularityInput);

  try {
    const normalized = normalizeDateTimeInput(raw, granularity);
    if (granularity === 'day') {
      return parseDate(normalized);
    }
    return parseDateTime(normalized);
  } catch {
    return undefined;
  }
};

export const formatDesignerDatePickerValue = (
  value: unknown,
  granularityInput: unknown,
): string => {
  if (value === undefined || value === null) {
    return '';
  }

  const granularity = normalizeDesignerDatePickerGranularity(granularityInput);
  const serialized = typeof value === 'string' ? value : String(value);

  if (granularity === 'day') {
    return serialized.split('T')[0] ?? serialized;
  }

  if (granularity === 'hour') {
    const match = serialized.match(/^(\d{4}-\d{2}-\d{2}T\d{2})/);
    return match?.[1] ?? serialized;
  }

  if (granularity === 'minute') {
    const match = serialized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return match?.[1] ?? serialized;
  }

  return serialized.replace(/(\.\d{3})?Z?$/, '');
};

export const designerDatePickerPlaceholderHint = (
  granularityInput: unknown,
  calendarSystemInput: unknown,
): string => {
  const granularity = normalizeDesignerDatePickerGranularity(granularityInput);
  const calendarSystem = normalizeDesignerDatePickerCalendarSystem(calendarSystemInput);

  if (granularity === 'day') {
    if (calendarSystem === 'jalali') {
      return '1403-01-01';
    }
    if (calendarSystem === 'hijri') {
      return '1445-09-01';
    }
    return '2024-03-07';
  }

  if (granularity === 'hour') {
    return '2024-03-07T14';
  }

  if (granularity === 'minute') {
    return '2024-03-07T14:30';
  }

  return '2024-03-07T14:30:45';
};
