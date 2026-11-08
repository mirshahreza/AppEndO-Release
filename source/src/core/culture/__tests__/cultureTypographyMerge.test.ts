import { describe, expect, it } from 'vitest';
import {
  mergeCultureTypography,
  resolveBuiltinTypographyForBundle,
  resolveCultureFontOptions,
  validateCultureTypographyOverride,
} from '../cultureTypographyMerge';
import { setPlatformWebFonts } from '../platformWebFontRegistry';

describe('cultureTypographyMerge', () => {
  it('resolves builtin typography per translation bundle', () => {
    expect(resolveBuiltinTypographyForBundle('us').defaultFontId).toBe('inter');
    expect(resolveBuiltinTypographyForBundle('ir').defaultFontId).toBe('vazirmatn');
    expect(resolveBuiltinTypographyForBundle('iq').defaultFontId).toBe('noto-sans-arabic');
  });

  it('merges settings default font override when valid for bundle', () => {
    const merged = mergeCultureTypography('us', {
      defaultFontId: 'source-sans-3',
      fonts: [],
    });
    expect(merged.defaultFontId).toBe('source-sans-3');
    expect(merged.fonts).toHaveLength(3);
  });

  it('ignores invalid override font ids', () => {
    const merged = mergeCultureTypography('us', {
      defaultFontId: 'vazirmatn',
      fonts: [],
    });
    expect(merged.defaultFontId).toBe('inter');
  });

  it('validates typography override against bundle catalog', () => {
    expect(validateCultureTypographyOverride('ir', {
      defaultFontId: 'parastoo',
      fonts: [],
    })).toBeNull();

    expect(validateCultureTypographyOverride('ir', {
      defaultFontId: 'inter',
      fonts: [],
    })).toMatch(/not allowed/i);
  });

  it('merges uploaded web fonts into culture font options', () => {
    setPlatformWebFonts([{
      id: 'web-dana',
      label: 'Dana',
      family: 'Dana',
      format: 'woff2',
      fileName: 'font.woff2',
      url: '/assets/platform/fonts/web-dana/font.woff2',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      script: 'en',
    }]);

    const options = resolveCultureFontOptions('us');
    expect(options.some((font) => font.id === 'web-dana')).toBe(true);

    expect(validateCultureTypographyOverride('us', {
      defaultFontId: 'web-dana',
      fonts: [],
    })).toBeNull();

    const merged = mergeCultureTypography('us', {
      defaultFontId: 'web-dana',
      fonts: [],
    });
    expect(merged.defaultFontId).toBe('web-dana');
  });

  it('merges Tajawal web font as Iraq culture default when registered', () => {
    setPlatformWebFonts([{
      id: 'web-tajawal-regular',
      label: 'Tajawal Regular',
      family: 'Tajawal Regular',
      format: 'woff',
      fileName: 'font.woff',
      url: '/assets/platform/fonts/web-tajawal-regular/font.woff',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      script: 'ar',
    }]);

    const merged = mergeCultureTypography('iq', {
      defaultFontId: 'web-tajawal-regular',
      fonts: [],
    });
    expect(merged.defaultFontId).toBe('web-tajawal-regular');
    expect(merged.fonts.some((font) => font.id === 'web-tajawal-regular')).toBe(true);
  });

  it('only merges uploaded web fonts that match the culture script', () => {
    setPlatformWebFonts([
      {
        id: 'web-latin',
        label: 'Latin Custom',
        family: 'Latin Custom',
        format: 'woff2',
        fileName: 'font.woff2',
        url: '/assets/platform/fonts/web-latin/font.woff2',
        uploadedAt: '2026-01-01T00:00:00.000Z',
        script: 'en',
      },
      {
        id: 'web-farsi',
        label: 'Farsi Custom',
        family: 'Farsi Custom',
        format: 'woff2',
        fileName: 'font.woff2',
        url: '/assets/platform/fonts/web-farsi/font.woff2',
        uploadedAt: '2026-01-01T00:00:00.000Z',
        script: 'fa',
      },
    ]);

    expect(resolveCultureFontOptions('us').some((font) => font.id === 'web-latin')).toBe(true);
    expect(resolveCultureFontOptions('us').some((font) => font.id === 'web-farsi')).toBe(false);
    expect(resolveCultureFontOptions('ir').some((font) => font.id === 'web-farsi')).toBe(true);
    expect(resolveCultureFontOptions('ir').some((font) => font.id === 'web-latin')).toBe(false);
  });
});
