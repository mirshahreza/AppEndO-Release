import { CLDR_AVAILABLE_LOCALE_OPTIONS, type CldrLocaleOption } from './cldrLocaleOptions.generated';

export type { CldrLocaleOption };

/** Unicode CLDR availableLocales + likelySubtags (BCP-47) — see https://cldr.unicode.org/ */
export const CLDR_LOCALE_SOURCE_URL = 'https://github.com/unicode-org/cldr-json/tree/main/cldr-json/cldr-core';

export const CLDR_LOCALE_OPTIONS: CldrLocaleOption[] = CLDR_AVAILABLE_LOCALE_OPTIONS;

export function buildCultureLocaleOptions(currentLocale?: string): CldrLocaleOption[] {
  const trimmed = currentLocale?.trim() ?? '';

  if (!trimmed || CLDR_LOCALE_OPTIONS.some((option) => option.value === trimmed)) {
    return CLDR_LOCALE_OPTIONS;
  }

  return [
    { value: trimmed, label: trimmed },
    ...CLDR_LOCALE_OPTIONS,
  ];
}

export function toDesignerAutocompleteLocaleItems(
  options: CldrLocaleOption[],
): Array<{ id: string; textValue: string }> {
  return options.map((option) => ({
    id: option.value,
    textValue: option.label,
  }));
}
