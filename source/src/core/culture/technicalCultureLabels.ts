import type { CultureCalendarId } from '../../shared/api/contracts/systemExtensions/types';
import { EXPLICIT_LTR_TEXT_CHROME_CLASS } from '../../shared/lib/appTableGridColumnTextDirection';

/** Translation keys that must always resolve to English (technical identifiers). */
export const ALWAYS_ENGLISH_TRANSLATION_KEYS = new Set([
  'settings.cultures.nativeColumn',
  'settings.cultures.locale',
]);

/** Technical identifiers always use explicit LTR, not culture-relative direction. */
export const TECHNICAL_LTR_CLASS = EXPLICIT_LTR_TEXT_CHROME_CLASS;

const CALENDAR_ENGLISH_LABELS: Record<CultureCalendarId, string> = {
  gregorian: 'Gregorian',
  jalali: 'Jalali',
  hijri: 'Hijri',
  hebrew: 'Hebrew',
};

export function formatTechnicalCalendarLabel(calendar: string): string {
  if (calendar in CALENDAR_ENGLISH_LABELS) {
    return CALENDAR_ENGLISH_LABELS[calendar as CultureCalendarId];
  }
  return calendar;
}

export function formatTechnicalDirectionLabel(direction: 'ltr' | 'rtl' | string): string {
  return direction === 'rtl' ? 'RTL' : 'LTR';
}

export function formatTechnicalCultureMeta(
  calendar: string,
  direction: 'ltr' | 'rtl' | string,
): string {
  return `${formatTechnicalCalendarLabel(calendar)} · ${formatTechnicalDirectionLabel(direction)}`;
}
