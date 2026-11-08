import type { AppTableGridColumnDef } from './appTableGridQuery';

export const APP_TABLE_GRID_COLUMN_TEXT_DIRECTIONS = [
  'culture',
  'opposite',
  'ltr',
  'rtl',
] as const;

export type AppTableGridColumnTextDirection = (typeof APP_TABLE_GRID_COLUMN_TEXT_DIRECTIONS)[number];

export const DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION: AppTableGridColumnTextDirection = 'culture';

export const APP_TABLE_GRID_COLUMN_TEXT_DIRECTION_LABELS: Record<AppTableGridColumnTextDirection, string> = {
  culture: 'Same as culture direction',
  opposite: 'Opposite to culture direction',
  ltr: 'Left to right (explicit)',
  rtl: 'Right to left (explicit)',
};

export const isAppTableGridColumnTextDirection = (
  value: unknown,
): value is AppTableGridColumnTextDirection => (
  value === 'culture'
  || value === 'opposite'
  || value === 'ltr'
  || value === 'rtl'
);

export function resolveAppTableGridColumnBidi(
  textDirection: AppTableGridColumnTextDirection | undefined,
  cultureDirection: 'ltr' | 'rtl',
): 'ltr' | 'rtl' {
  const mode = textDirection ?? DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION;
  switch (mode) {
    case 'culture':
      return cultureDirection;
    case 'opposite':
      return cultureDirection === 'ltr' ? 'rtl' : 'ltr';
    case 'ltr':
      return 'ltr';
    case 'rtl':
      return 'rtl';
  }
}

const LEGACY_LTR_PATTERN = /\[direction:ltr\]|(?:^|\s)dir-ltr(?:\s|$)|(?:^|\s)text-left(?:\s|$)/;
const LEGACY_RTL_PATTERN = /\[direction:rtl\]|(?:^|\s)dir-rtl(?:\s|$)/;

/** Infer semantic direction from legacy physical LTR/RTL class strings (migration). */
export function inferAppTableGridColumnTextDirectionFromLegacyClassName(
  className?: string,
): AppTableGridColumnTextDirection | undefined {
  if (!className?.trim()) {
    return undefined;
  }
  if (LEGACY_RTL_PATTERN.test(className)) {
    return 'opposite';
  }
  if (LEGACY_LTR_PATTERN.test(className)) {
    return 'culture';
  }
  return undefined;
}

export function stripLegacyAppTableGridColumnPhysicalDirection(className?: string): string | undefined {
  if (!className?.trim()) {
    return undefined;
  }
  const stripped = className
    .replace(/\s*\[direction:(?:ltr|rtl)\]/g, '')
    .replace(/(?:^|\s)dir-ltr(?:\s|$)/g, ' ')
    .replace(/(?:^|\s)dir-rtl(?:\s|$)/g, ' ')
    .replace(/(?:^|\s)text-left(?:\s|$)/g, ' ')
    .replace(/(?:^|\s)text-right(?:\s|$)/g, ' ')
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

function columnHasDedicatedHorizontalAlign(className?: string): boolean {
  if (!className) {
    return false;
  }
  return (
    className.includes('text-center')
    || className.includes('text-end')
    || className.includes('text-right')
  );
}

export function resolveAppTableGridColumnTextDirection(
  column: Pick<AppTableGridColumnDef<unknown>, 'textDirection' | 'headerClassName' | 'cellClassName'>,
): AppTableGridColumnTextDirection {
  if (column.textDirection && isAppTableGridColumnTextDirection(column.textDirection)) {
    return column.textDirection;
  }
  const legacy = inferAppTableGridColumnTextDirectionFromLegacyClassName(column.headerClassName)
    ?? inferAppTableGridColumnTextDirectionFromLegacyClassName(column.cellClassName);
  return legacy ?? DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION;
}

export type AppTableGridColumnDirectionChrome = {
  headerClassName?: string;
  cellClassName?: string;
  headerDir?: 'ltr' | 'rtl';
  cellDir?: 'ltr' | 'rtl';
};

/**
 * Merges column text direction (culture-relative by default) with optional alignment classes.
 * Center/end-aligned columns skip bidi overrides so actions and booleans stay stable.
 */
export function resolveAppTableGridColumnDirectionChrome(
  column: Pick<AppTableGridColumnDef<unknown>, 'textDirection' | 'headerClassName' | 'cellClassName'>,
  cultureDirection: 'ltr' | 'rtl',
): AppTableGridColumnDirectionChrome {
  const textDirection = resolveAppTableGridColumnTextDirection(column);
  const headerBase = stripLegacyAppTableGridColumnPhysicalDirection(column.headerClassName);
  const cellBase = stripLegacyAppTableGridColumnPhysicalDirection(column.cellClassName);

  const headerAlignDedicated = columnHasDedicatedHorizontalAlign(column.headerClassName);
  const cellAlignDedicated = columnHasDedicatedHorizontalAlign(column.cellClassName);

  const resolvedDir = resolveAppTableGridColumnBidi(textDirection, cultureDirection);

  return {
    headerClassName: headerAlignDedicated
      ? headerBase
      : [headerBase, 'text-start'].filter(Boolean).join(' ') || undefined,
    cellClassName: cellAlignDedicated
      ? cellBase
      : [cellBase, 'text-start'].filter(Boolean).join(' ') || undefined,
    headerDir: headerAlignDedicated ? undefined : resolvedDir,
    cellDir: cellAlignDedicated ? undefined : resolvedDir,
  };
}

/** Explicit LTR for technical identifiers (culture packs, locale codes) outside grid columns. */
export const EXPLICIT_LTR_TEXT_CHROME_CLASS = 'text-start [direction:ltr]';
