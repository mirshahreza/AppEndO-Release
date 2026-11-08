import { describe, expect, it } from 'vitest';
import { applyDerivedTranslationBundle, deriveTranslationBundleId } from '../constants';

describe('deriveTranslationBundleId', () => {
  it('uses culture id for builtin packs', () => {
    expect(deriveTranslationBundleId('us', 'en-US')).toBe('us');
    expect(deriveTranslationBundleId('ir', 'fa-IR')).toBe('ir');
    expect(deriveTranslationBundleId('iq', 'ar-IQ')).toBe('iq');
  });

  it('derives bundle from locale for custom cultures', () => {
    expect(deriveTranslationBundleId('en-gregorian', 'en-US')).toBe('us');
    expect(deriveTranslationBundleId('fa-jalali', 'fa-IR')).toBe('ir');
    expect(deriveTranslationBundleId('ar-iq', 'ar-IQ')).toBe('iq');
    expect(deriveTranslationBundleId('custom', '')).toBe('us');
  });
});

describe('applyDerivedTranslationBundle', () => {
  it('updates typography when derived bundle changes', () => {
    const next = applyDerivedTranslationBundle({
      id: 'fa-custom',
      label: 'Persian Custom',
      language: 'fa',
      locale: 'fa-IR',
      calendar: 'jalali',
      direction: 'rtl',
      translationBundleId: 'us',
    });

    expect(next.translationBundleId).toBe('ir');
    expect(next.typography?.defaultFontId).toBeTruthy();
    expect(next.typography?.fonts.length).toBeGreaterThan(0);
  });
});
