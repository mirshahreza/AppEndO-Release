import { describe, expect, it } from 'vitest';
import {
  applyDerivedCulturePack,
  deriveCultureId,
  deriveCultureLabel,
  resolveCultureDisplayLabel,
} from '../constants';

describe('deriveCultureId', () => {
  it('preserves builtin ids when requested', () => {
    expect(deriveCultureId('fa-IR', 'jalali', ['us', 'ir'], 'ir')).toBe('ir');
  });

  it('derives ids from locale for new cultures', () => {
    expect(deriveCultureId('en-US', 'gregorian', ['us', 'ir'])).toBe('en-us');
    expect(deriveCultureId('fa-IR', 'jalali', ['us', 'ir'])).toBe('fa-ir');
  });
});

describe('applyDerivedCulturePack', () => {
  it('uses locale as label and derives id on create', () => {
    const next = applyDerivedCulturePack({
      id: '',
      label: '',
      language: 'en',
      locale: 'en-GB',
      calendar: 'gregorian',
      direction: 'ltr',
      translationBundleId: 'us',
    }, { existingIds: ['us', 'ir'] });

    expect(next.label).toBe('en-GB');
    expect(deriveCultureLabel(next.locale)).toBe('en-GB');
    expect(next.id).toBe('en-gb');
    expect(resolveCultureDisplayLabel(next)).toBe('en-GB');
  });
});
