/**
 * Default Display Name is the formula `translate(field_name)`.
 * When untouched: culture lookup for `field_name`, else humanize
 * (underscores removed, each word capitalized).
 */

export const formatColumnDisplayNameFormula = (fieldName: string): string => (
  `translate(${fieldName})`
);

export const isColumnDisplayNameFormula = (
  value: string,
  fieldName: string,
): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  return trimmed === formatColumnDisplayNameFormula(fieldName);
};

/** `order_date` → `Order Date`; also splits camelCase. */
export const humanizeColumnFieldName = (fieldName: string): string => {
  const spaced = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) {
    return fieldName;
  }
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const resolveColumnDisplayName = (
  fieldName: string,
  translate: (key: string) => string,
  override?: string | null,
): string => {
  const trimmedOverride = override?.trim() ?? '';
  if (trimmedOverride && !isColumnDisplayNameFormula(trimmedOverride, fieldName)) {
    return trimmedOverride;
  }

  const translated = translate(fieldName).trim();
  // TranslationRuntime returns the key when no catalog entry exists.
  if (translated && translated !== fieldName) {
    return translated;
  }

  return humanizeColumnFieldName(fieldName);
};

/** Persist empty when the value is the default formula (untouched). */
export const normalizeColumnDisplayLabelForStorage = (
  fieldName: string,
  value: string,
): string => (
  isColumnDisplayNameFormula(value, fieldName) ? '' : value.trim()
);
