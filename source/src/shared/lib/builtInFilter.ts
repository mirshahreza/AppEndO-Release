export const BUILTIN_FILTER_ALL = '';
export const BUILTIN_FILTER_YES = 'builtin';
export const BUILTIN_FILTER_NO = 'not-builtin';

export const BUILTIN_FILTER_OPTIONS = [
  { value: BUILTIN_FILTER_YES, label: 'BuiltIn' },
  { value: BUILTIN_FILTER_NO, label: 'Not BuiltIn' },
] as const;

export function parseBuiltInFilter(value: unknown): string {
  if (value === BUILTIN_FILTER_YES || value === BUILTIN_FILTER_NO) {
    return value;
  }
  return BUILTIN_FILTER_ALL;
}

export function matchesBuiltInFilter(isBuiltIn: boolean, selected: string): boolean {
  const key = selected.trim();
  if (!key) {
    return true;
  }
  if (key === BUILTIN_FILTER_YES) {
    return isBuiltIn;
  }
  if (key === BUILTIN_FILTER_NO) {
    return !isBuiltIn;
  }
  return true;
}

/** Map leftover hide/show booleans and Kind CSVs that mixed BuiltIn into type. */
export function migrateLegacyBuiltInFilter(raw: Record<string, unknown>): string {
  if (typeof raw.builtInFilter === 'string') {
    return parseBuiltInFilter(raw.builtInFilter);
  }
  if (typeof raw.showBuiltIn === 'boolean') {
    return raw.showBuiltIn ? BUILTIN_FILTER_ALL : BUILTIN_FILTER_NO;
  }
  if (typeof raw.hideBuiltinItems === 'boolean') {
    return raw.hideBuiltinItems ? BUILTIN_FILTER_NO : BUILTIN_FILTER_ALL;
  }
  if (typeof raw.hideBuiltinPortals === 'boolean') {
    return raw.hideBuiltinPortals ? BUILTIN_FILTER_NO : BUILTIN_FILTER_ALL;
  }
  if (typeof raw.kindFilter === 'string') {
    const parts = new Set(
      raw.kindFilter.split(',').map((part) => part.trim()).filter((part) => part.length > 0),
    );
    const hasBuiltin = parts.has(BUILTIN_FILTER_YES);
    const hasCustom = parts.has('custom');
    if (hasBuiltin && !hasCustom) {
      return BUILTIN_FILTER_YES;
    }
    if (hasCustom && !hasBuiltin) {
      return BUILTIN_FILTER_NO;
    }
    return BUILTIN_FILTER_ALL;
  }
  return BUILTIN_FILTER_ALL;
}
