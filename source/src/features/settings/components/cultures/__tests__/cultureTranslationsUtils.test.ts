import { describe, expect, it } from 'vitest';
import {
  buildEffectiveTranslationsDraft,
  buildTranslationsSavePayload,
  filterTranslationKeys,
  isRtlCultureTranslationColumn,
  mergeCultureTranslationColumns,
  sortTranslationKeys,
} from '../cultureTranslationsUtils';
import type { PlatformCultureTranslationsResponse } from '../../../../../shared/api/contracts/platform/cultureTranslations';

const SAMPLE_DATA: PlatformCultureTranslationsResponse = {
  success: true,
  revision: 3,
  keys: ['actions.save', 'actions.cancel'],
  masterBundle: {
    'actions.save': 'Save',
    'actions.cancel': 'Cancel',
  },
  defaultBundles: {
    us: {
      'actions.save': 'Save',
      'actions.cancel': 'Cancel',
    },
    ir: {
      'actions.save': 'Save',
      'actions.cancel': 'Cancel',
    },
  },
  cultureOverrides: {
    ir: { 'actions.cancel': 'Custom cancel' },
  },
  cultures: [
    { id: 'us', label: 'United States', translationBundleId: 'us', direction: 'ltr' },
    { id: 'ir', label: 'Iran', translationBundleId: 'ir', direction: 'rtl' },
  ],
};

describe('cultureTranslationsUtils', () => {
  it('builds effective drafts from bundles and culture overrides', () => {
    const draft = buildEffectiveTranslationsDraft(SAMPLE_DATA, ['ir']);
    expect(draft.ir['actions.save']).toBe('Save');
    expect(draft.ir['actions.cancel']).toBe('Custom cancel');
  });

  it('builds save payload from edited draft', () => {
    const draft = buildEffectiveTranslationsDraft(SAMPLE_DATA, ['ir']);
    draft.ir['actions.cancel'] = 'Cancel';

    const payload = buildTranslationsSavePayload(SAMPLE_DATA, draft);
    expect(payload.revision).toBe(4);
    expect(payload.bundles.ir['actions.cancel']).toBe('Cancel');
    expect(payload.cultureOverrides.ir).toBeUndefined();
  });

  it('filters keys by search query', () => {
    expect(filterTranslationKeys(['actions.save', 'nav.dashboard'], 'dash')).toEqual(['nav.dashboard']);
  });

  it('sorts keys by key or native label', () => {
    const keys = ['actions.save', 'actions.cancel'];
    const master = SAMPLE_DATA.masterBundle;
    expect(sortTranslationKeys(keys, 'key', 'asc', master)).toEqual(['actions.cancel', 'actions.save']);
    expect(sortTranslationKeys(keys, 'native', 'asc', master)).toEqual(['actions.cancel', 'actions.save']);
    expect(sortTranslationKeys(keys, 'native', 'desc', master)).toEqual(['actions.save', 'actions.cancel']);
  });

  it('detects rtl culture columns from direction or bundle id', () => {
    expect(isRtlCultureTranslationColumn({ direction: 'rtl', translationBundleId: 'us' })).toBe(true);
    expect(isRtlCultureTranslationColumn({ direction: 'ltr', translationBundleId: 'ir' })).toBe(true);
    expect(isRtlCultureTranslationColumn({ direction: 'ltr', translationBundleId: 'us' })).toBe(false);
  });

  it('merges configured packs missing from the translations API', () => {
    const merged = mergeCultureTranslationColumns(SAMPLE_DATA.cultures, [{
      id: 'ak',
      label: 'ak',
      language: 'ak',
      locale: 'ak',
      calendar: 'hijri',
      direction: 'rtl',
      translationBundleId: 'us',
    }]);

    expect(merged.map((culture) => culture.id)).toContain('ak');
    const draft = buildEffectiveTranslationsDraft(
      { ...SAMPLE_DATA, cultures: merged },
      ['ak'],
    );
    expect(draft.ak['actions.save']).toBe('Save');
  });
});
