import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTranslationRuntime,
  setTranslationDevWarningsEnabled,
} from '../TranslationRuntime';

describe('TranslationRuntime', () => {
  afterEach(() => {
    setTranslationDevWarningsEnabled(false);
    vi.restoreAllMocks();
  });

  it('returns bundle value when key exists', () => {
    const { t } = createTranslationRuntime(
      { 'actions.save': 'Store' },
      { 'actions.save': 'Save' },
    );
    expect(t('actions.save')).toBe('Store');
  });

  it('falls back to master bundle and warns once in dev mode', () => {
    setTranslationDevWarningsEnabled(true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { t } = createTranslationRuntime(
      {},
      { 'actions.save': 'Save' },
    );

    expect(t('actions.save')).toBe('Save');
    expect(t('actions.save')).toBe('Save');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to embedded English when missing in both bundles', () => {
    const { t } = createTranslationRuntime({}, {});
    expect(t('profile.actions.cancel')).toBe('Cancel');
  });

  it('returns key when missing in all catalogs', () => {
    const { t } = createTranslationRuntime({}, {});
    expect(t('missing.key')).toBe('missing.key');
  });

  it('does not warn when missing lookup is silent', () => {
    setTranslationDevWarningsEnabled(true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { t } = createTranslationRuntime({}, {});

    expect(t('nav.future-feature', { missing: 'silent' })).toBe('nav.future-feature');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
