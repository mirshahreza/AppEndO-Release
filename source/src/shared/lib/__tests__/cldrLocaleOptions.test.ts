import { describe, expect, it } from 'vitest';
import {
  buildCultureLocaleOptions,
  CLDR_LOCALE_OPTIONS,
  CLDR_LOCALE_SOURCE_URL,
} from '../cldrLocaleOptions';

describe('cldrLocaleOptions', () => {
  it('references the Unicode CLDR source', () => {
    expect(CLDR_LOCALE_SOURCE_URL).toContain('cldr-json');
  });

  it('includes common BCP-47 locales from CLDR', () => {
    expect(CLDR_LOCALE_OPTIONS.length).toBeGreaterThan(700);
    expect(CLDR_LOCALE_OPTIONS.some((option) => option.value === 'en-US')).toBe(true);
    expect(CLDR_LOCALE_OPTIONS.some((option) => option.value === 'fa-IR')).toBe(true);
    expect(CLDR_LOCALE_OPTIONS.some((option) => option.value === 'ar-IQ')).toBe(true);
  });

  it('includes unknown saved values so the picker can display them', () => {
    const options = buildCultureLocaleOptions('xx-YY-Test');
    expect(options[0]).toEqual({ value: 'xx-YY-Test', label: 'xx-YY-Test' });
  });
});
