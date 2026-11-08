import { IANA_ZONE1970_TIMEZONE_OPTIONS, type IanaTimezoneOption } from './ianaTimezoneOptions.generated';

export type { IanaTimezoneOption };

/** IANA zone1970.tab canonical zones — see https://www.iana.org/time-zones */
export const IANA_TIMEZONE_SOURCE_URL = 'https://data.iana.org/time-zones/data/zone1970.tab';

const UTC_OPTION: IanaTimezoneOption = { value: 'UTC', label: 'UTC' };

const BASE_IANA_TIMEZONE_OPTIONS: IanaTimezoneOption[] = IANA_ZONE1970_TIMEZONE_OPTIONS.some(
  (option) => option.value === 'UTC',
)
  ? [...IANA_ZONE1970_TIMEZONE_OPTIONS]
  : [UTC_OPTION, ...IANA_ZONE1970_TIMEZONE_OPTIONS];

export const IANA_TIMEZONE_OPTIONS: IanaTimezoneOption[] = BASE_IANA_TIMEZONE_OPTIONS;

export function buildCultureTimezoneOptions(currentTimezone?: string): IanaTimezoneOption[] {
  const notSetOption: IanaTimezoneOption = { value: '', label: '(not set)' };
  const trimmed = currentTimezone?.trim() ?? '';

  if (!trimmed || IANA_TIMEZONE_OPTIONS.some((option) => option.value === trimmed)) {
    return [notSetOption, ...IANA_TIMEZONE_OPTIONS];
  }

  return [
    notSetOption,
    { value: trimmed, label: trimmed },
    ...IANA_TIMEZONE_OPTIONS,
  ];
}

export function toDesignerAutocompleteTimezoneItems(
  options: IanaTimezoneOption[],
): Array<{ id: string; textValue: string }> {
  return options.map((option) => ({
    id: option.value || '__not_set__',
    textValue: option.label,
  }));
}
