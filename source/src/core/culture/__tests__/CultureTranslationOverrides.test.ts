import { describe, expect, it } from 'vitest';
import {
  bootstrapCultureTranslationRuntime,
  buildCultureTranslationsSavePayload,
  diffTranslationOverrides,
  mergeTranslationBundle,
  normalizePlatformCultureTranslationsConfig,
} from '../CultureTranslationOverrides';

describe('CultureTranslationOverrides', () => {
  it('merges culture overrides on top of the base bundle', () => {
    bootstrapCultureTranslationRuntime({
      revision: 1,
      cultureOverrides: {
        ir: { 'actions.save': 'Custom save' },
      },
    });

    const merged = mergeTranslationBundle({ 'actions.save': 'Save' }, 'ir');
    expect(merged['actions.save']).toBe('Custom save');
  });

  it('diffs overrides from provided defaults', () => {
    const overrides = diffTranslationOverrides(
      { 'actions.save': 'Save', 'actions.cancel': 'Cancel' },
      { 'actions.save': 'Save', 'actions.cancel': 'Custom cancel' },
    );

    expect(overrides['actions.save']).toBeUndefined();
    expect(overrides['actions.cancel']).toBe('Custom cancel');
  });

  it('stores builtin culture edits in cultureOverrides so seed refresh cannot drop them', () => {
    const payload = buildCultureTranslationsSavePayload(
      {
        revision: 2,
        bundles: {
          us: { 'actions.save': 'Save', 'actions.cancel': 'Cancel' },
          ir: { 'actions.save': 'Save', 'actions.cancel': 'Cancel' },
        },
        cultureOverrides: {},
      },
      {
        us: { 'actions.save': 'Store', 'actions.cancel': 'Cancel' },
      },
      [{ id: 'us', translationBundleId: 'us' }],
    );

    expect(payload.revision).toBe(3);
    expect(payload.bundles.us['actions.save']).toBe('Save');
    expect(payload.cultureOverrides.us?.['actions.save']).toBe('Store');
  });

  it('preserves untouched culture overrides when saving one culture draft', () => {
    const payload = buildCultureTranslationsSavePayload(
      {
        revision: 4,
        bundles: {
          iq: { 'hwy.members.column.nakhebin': 'سجل الناخب' },
        },
        cultureOverrides: {
          ir: { 'actions.save': 'Custom save' },
        },
      },
      {
        iq: {
          'hwy.members.column.nakhebin': 'سجل الناخب المخصص',
          'actions.cancel': 'Cancel',
        },
      },
      [{ id: 'iq', translationBundleId: 'iq' }],
    );

    expect(payload.cultureOverrides.ir?.['actions.save']).toBe('Custom save');
    expect(payload.cultureOverrides.iq?.['hwy.members.column.nakhebin']).toBe('سجل الناخب المخصص');
  });

  it('normalizes legacy overrides-only payloads', () => {
    expect(normalizePlatformCultureTranslationsConfig(null)).toEqual({
      revision: 0,
      bundles: {},
      cultureOverrides: {},
    });
    expect(normalizePlatformCultureTranslationsConfig({
      overrides: {
        us: { 'actions.save': ' Save ', '': 'x', 'actions.cancel': '   ' },
      },
    })).toEqual({
      revision: 0,
      bundles: {},
      cultureOverrides: {
        us: { 'actions.save': 'Save' },
      },
    });
  });
});
