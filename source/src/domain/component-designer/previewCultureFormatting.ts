import type { CultureCalendarId } from '../../shared/api/contracts/systemExtensions/types';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import type { DesignerNode } from './types';
import { getNodePaletteItemId } from './runtimeShared';

export type PreviewCultureFormatOptions = {
  locale: string;
  calendar: CultureCalendarId;
};

const ISO_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export type PreviewBoundFieldKind = 'date' | 'number' | 'text';

export const resolvePreviewBoundFieldKind = (node: DesignerNode): PreviewBoundFieldKind => {
  const paletteItemId = getNodePaletteItemId(node);
  if (paletteItemId === 'heroui.date-picker' || paletteItemId === 'form.date-range') {
    return 'date';
  }

  if (paletteItemId === 'heroui.number-input' || paletteItemId === 'form.calculator') {
    return 'number';
  }

  return 'text';
};

const looksLikeIsoDateValue = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE_PREFIX_PATTERN.test(value.trim());

export const formatPreviewCultureScalar = (
  value: unknown,
  options: PreviewCultureFormatOptions,
  fieldKind: PreviewBoundFieldKind = 'text',
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (fieldKind === 'number' || (fieldKind === 'text' && typeof value === 'number' && Number.isFinite(value))) {
    return new Intl.NumberFormat(options.locale).format(value);
  }

  if (fieldKind === 'date' || (fieldKind === 'text' && looksLikeIsoDateValue(value))) {
    return formatDisplayDateYmd(String(value));
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const inferGridColumnPreviewKind = (
  value: unknown,
): PreviewBoundFieldKind => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return 'number';
  }

  if (looksLikeIsoDateValue(value)) {
    return 'date';
  }

  return 'text';
};
