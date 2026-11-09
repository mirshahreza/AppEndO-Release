import { describe, expect, it } from 'vitest';
import studioNav from '../../../config/platform-registry/navigation/studio.json';
import { navLabelKey, resolveNavLabel, tryResolveNavLabel } from '../cultureShellKeys';
import { createTranslationRuntime } from '../TranslationRuntime';
import { BUILTIN_TRANSLATION_MASTER_EN } from '../translations/masterEn';

describe('resolveNavLabel', () => {
  it('returns the culture label when the nav key exists', () => {
    const { t } = createTranslationRuntime(
      { 'nav.data-studio': 'Data Studio' },
      {},
    );
    expect(resolveNavLabel(t, 'data-studio', 'Fallback')).toBe('Data Studio');
  });

  it('returns the fallback when t is missing or the key is unresolved', () => {
    const { t } = createTranslationRuntime({}, {});
    expect(resolveNavLabel(undefined, 'future-feature', 'Future Feature')).toBe('Future Feature');
    expect(resolveNavLabel(t, 'future-feature', 'Future Feature')).toBe('Future Feature');
  });

  it('tryResolveNavLabel returns null when the key is missing', () => {
    const { t } = createTranslationRuntime({}, {});
    expect(tryResolveNavLabel(undefined, 'hwy-employees-list')).toBeNull();
    expect(tryResolveNavLabel(t, 'hwy-employees-list')).toBeNull();
  });
});

describe('studio nav culture keys', () => {
  it('ships a master label for every studio.json pageKey including data-studio', () => {
    const collectPageKeys = (
      items: Array<{ pageKey?: string; children?: unknown[] }>,
    ): string[] => items.flatMap((item) => [
      ...(item.pageKey ? [item.pageKey] : []),
      ...collectPageKeys((item.children ?? []) as Array<{ pageKey?: string; children?: unknown[] }>),
    ]);
    const pageKeys = studioNav.groups.flatMap((group) => collectPageKeys(group.items));

    expect(pageKeys).toContain('data-studio');
    expect(BUILTIN_TRANSLATION_MASTER_EN[navLabelKey('data-studio')]).toBe('Data Studio');

    const missing = pageKeys.filter((pageKey) => {
      const label = BUILTIN_TRANSLATION_MASTER_EN[navLabelKey(pageKey)];
      return !label?.trim();
    });
    expect(missing).toEqual([]);
  });
});
