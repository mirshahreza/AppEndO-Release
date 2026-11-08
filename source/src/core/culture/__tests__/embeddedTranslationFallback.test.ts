import { describe, expect, it, vi } from 'vitest';
import { createEmbeddedEnglishTranslationRuntime, lookupEmbeddedEnglish } from '../embeddedTranslationBundles';
import { loadBuiltinTranslationBundle } from '../builtinTranslationLoader';

vi.mock('../../shared/api/client', () => ({
  apiGet: vi.fn(async () => ({
    response: { ok: false, status: 503 },
    data: { success: false },
  })),
}));

describe('embedded translation fallback', () => {
  it('lookupEmbeddedEnglish returns English labels for known keys', () => {
    expect(lookupEmbeddedEnglish('actions.cancel')).toBe('Cancel');
    expect(lookupEmbeddedEnglish('nav.data-studio')).toBe('Data Studio');
    expect(lookupEmbeddedEnglish('profile.modals.accountDetails')).toBe('Account Details');
  });

  it('lookupEmbeddedEnglish returns the key when unknown', () => {
    expect(lookupEmbeddedEnglish('totally.unknown.key')).toBe('totally.unknown.key');
  });

  it('createEmbeddedEnglishTranslationRuntime exposes a translation function', () => {
    const runtime = createEmbeddedEnglishTranslationRuntime();
    expect(typeof runtime.t).toBe('function');
    expect(runtime.t('actions.cancel')).toBe('Cancel');
  });

  it('loadBuiltinTranslationBundle falls back to embedded English when API fails', async () => {
    const bundle = await loadBuiltinTranslationBundle('us');
    expect(bundle['actions.cancel']).toBe('Cancel');
  });
});
