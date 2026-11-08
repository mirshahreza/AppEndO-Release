import { describe, expect, it } from 'vitest';
import { validateCulturesDraft } from '../useCulturesSection';

describe('validateCulturesDraft', () => {
  const availablePackIds = ['us', 'ir', 'iq', 'en-gregorian'];

  it('accepts configured packs with default included', () => {
    expect(validateCulturesDraft({
      packs: [
        { id: 'us', label: 'US', language: 'en', locale: 'en-US', calendar: 'gregorian', direction: 'ltr', translationBundleId: 'us' },
        { id: 'ir', label: 'IR', language: 'fa', locale: 'fa-IR', calendar: 'jalali', direction: 'rtl', translationBundleId: 'ir' },
      ],
      enabledCulturePackIds: ['us', 'ir'],
      defaultCultureId: 'us',
    }, availablePackIds)).toBeNull();
  });

  it('rejects empty pack list', () => {
    expect(validateCulturesDraft({
      packs: [],
      enabledCulturePackIds: [],
      defaultCultureId: 'us',
    }, availablePackIds)).toBe('At least one culture pack must be configured.');
  });

  it('rejects unknown pack ids', () => {
    expect(validateCulturesDraft({
      packs: [
        { id: 'xx', label: 'XX', language: 'en', locale: 'en-US', calendar: 'gregorian', direction: 'ltr', translationBundleId: 'us' },
      ],
      enabledCulturePackIds: ['xx'],
      defaultCultureId: 'xx',
    }, availablePackIds)).toBe('Unknown culture pack id: xx');
  });

  it('rejects default outside configured packs', () => {
    expect(validateCulturesDraft({
      packs: [
        { id: 'ir', label: 'IR', language: 'fa', locale: 'fa-IR', calendar: 'jalali', direction: 'rtl', translationBundleId: 'ir' },
      ],
      enabledCulturePackIds: ['ir'],
      defaultCultureId: 'us',
    }, availablePackIds)).toBe('Default culture must be one of the configured packs.');
  });

  it('validates pack fields', () => {
    expect(validateCulturesDraft({
      packs: [{
        id: 'bad id',
        label: '',
        language: 'en',
        locale: '',
        calendar: 'gregorian',
        direction: 'ltr',
        translationBundleId: 'us',
      }],
      enabledCulturePackIds: ['us'],
      defaultCultureId: 'us',
    }, availablePackIds)).toBe('Culture locale is required.');
  });
});
