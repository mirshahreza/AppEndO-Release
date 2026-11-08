import { getContentTextDirection, isRtlDominantText } from '../lib/textDirection';

export type FieldTextDir = 'ltr' | 'rtl' | 'auto';

/** Input types that stay LTR (codes, secrets, numbers, machine identifiers). */
const AUTO_DIR_SKIP_TYPES = new Set([
  'password',
  'number',
  'email',
  'tel',
  'url',
  'hidden',
  'file',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'range',
  'color',
]);

export const isAutoDirSkippedInputType = (type?: string): boolean =>
  AUTO_DIR_SKIP_TYPES.has((type ?? 'text').toLowerCase());

/**
 * Whether auto direction-from-first-character is active.
 * Defaults to enabled for text-like fields; pass `autoDir={false}` to opt out
 * (required for character-restricted identifiers: slugs, keys, cron, hex, JSON/code).
 */
export const resolveAutoDirEnabled = (
  autoDir: boolean | undefined,
  type?: string,
): boolean => {
  if (autoDir === false) {
    return false;
  }
  if (isAutoDirSkippedInputType(type)) {
    return false;
  }
  return true;
};

/**
 * Resolve `dir` for UiInput / UiTextarea.
 * Explicit `ltr` | `rtl` wins; `auto` and default `autoDir` use first meaningful character.
 * When the value is empty, RTL placeholders set `rtl`; otherwise inherit document `dir`
 * (avoids forcing `ltr` on empty fields in RTL cultures).
 */
export const resolveFieldTextDirection = (
  dir: FieldTextDir | undefined,
  autoDirEnabled: boolean,
  value: string,
  placeholder?: string,
): 'ltr' | 'rtl' | undefined => {
  if (dir === 'ltr' || dir === 'rtl') {
    return dir;
  }
  if (dir === 'auto' || autoDirEnabled) {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      return getContentTextDirection(trimmedValue);
    }
    const trimmedPlaceholder = (placeholder ?? '').trim();
    if (!trimmedPlaceholder) {
      return undefined;
    }
    if (isRtlDominantText(trimmedPlaceholder)) {
      return 'rtl';
    }
    return undefined;
  }
  return undefined;
};

export const toFieldTextValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};

/** Dropdown/listbox direction — matches culture unless the field sets explicit `dir`. */
export const resolveFieldMenuDirection = (
  fieldDir: FieldTextDir | undefined,
  cultureDirection?: 'ltr' | 'rtl',
): 'ltr' | 'rtl' => {
  if (fieldDir === 'ltr' || fieldDir === 'rtl') {
    return fieldDir;
  }
  if (cultureDirection === 'ltr' || cultureDirection === 'rtl') {
    return cultureDirection;
  }
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl') {
    return 'rtl';
  }
  return 'ltr';
};
