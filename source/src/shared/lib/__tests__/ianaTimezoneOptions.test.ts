import { describe, expect, it } from 'vitest';
import {
  buildCultureTimezoneOptions,
  IANA_TIMEZONE_OPTIONS,
  IANA_TIMEZONE_SOURCE_URL,
} from '../ianaTimezoneOptions';

describe('ianaTimezoneOptions', () => {
  it('references the IANA zone1970.tab source', () => {
    expect(IANA_TIMEZONE_SOURCE_URL).toContain('iana.org/time-zones');
  });

  it('includes canonical zones from IANA zone1970.tab', () => {
    expect(IANA_TIMEZONE_OPTIONS.length).toBeGreaterThan(300);
    expect(IANA_TIMEZONE_OPTIONS.some((option) => option.value === 'Asia/Tehran')).toBe(true);
    expect(IANA_TIMEZONE_OPTIONS.some((option) => option.value === 'America/New_York')).toBe(true);
    expect(IANA_TIMEZONE_OPTIONS.some((option) => option.value === 'UTC')).toBe(true);
  });

  it('includes unknown saved values so the picker can display them', () => {
    const options = buildCultureTimezoneOptions('Etc/Unknown-Test-Zone');
    expect(options[0]).toEqual({ value: '', label: '(not set)' });
    expect(options[1]).toEqual({ value: 'Etc/Unknown-Test-Zone', label: 'Etc/Unknown-Test-Zone' });
  });
});
