export const FIELD_NUMERIC_DATE_MONO_CLASS = 'font-mono tabular-nums';

/** ISO-style grid dates (`YYYY-MM-DD` and mount calendar variants) — fixed 10-character width. */
export const FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS =
  `inline-block w-[10ch] shrink-0 whitespace-nowrap ${FIELD_NUMERIC_DATE_MONO_CLASS}`;

/** Center-aligned numeric / date field chrome (inputs + read-only boxes). */
export const FIELD_NUMERIC_DATE_INPUT_CENTER_CLASS = `!text-center ${FIELD_NUMERIC_DATE_MONO_CLASS}`;

export const FIELD_NUMERIC_DATE_DISPLAY_CENTER_CLASS = `text-center ${FIELD_NUMERIC_DATE_MONO_CLASS}`;

export const FIELD_NUMERIC_DATE_DISPLAY_GRID_CENTER_CLASS =
  `${FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS} text-center`;

export const FIELD_NUMERIC_DATE_DISPLAY_START_CLASS =
  `${FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS} text-start`;

/** Callable phone digits (Iraq mobile `07…` — 11 chars) inside {@link PhoneNumberDisplay}. */
export const PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS =
  `inline-block min-w-[11ch] w-max max-w-none shrink-0 whitespace-nowrap text-start ${FIELD_NUMERIC_DATE_MONO_CLASS}`;

type HtmlInputMode = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';

export function isNumericOrDateFieldInput(type?: string, inputMode?: HtmlInputMode): boolean {
  const normalizedType = (type ?? 'text').toLowerCase();
  if (['date', 'time', 'datetime-local', 'month', 'week', 'number'].includes(normalizedType)) {
    return true;
  }
  return inputMode === 'numeric' || inputMode === 'decimal';
}
