import { describe, expect, it } from 'vitest';
import {
  ASSETS_ATTRIBUTION_MANIFEST,
  buildAssetsAttributionManifest,
  listRequiredAttributionEntries,
} from '../assetsAttribution';
import { ICON_PACK_MANIFEST } from '../navigationIcons/iconPackManifest';

describe('assetsAttribution manifest', () => {
  it('includes every bundled icon pack', () => {
    expect(ASSETS_ATTRIBUTION_MANIFEST.entries).toHaveLength(ICON_PACK_MANIFEST.length);
    for (const pack of ICON_PACK_MANIFEST) {
      expect(ASSETS_ATTRIBUTION_MANIFEST.entries.some((entry) => entry.id === pack.id)).toBe(true);
    }
  });

  it('flags attribution-required packs such as Solar', () => {
    const solar = listRequiredAttributionEntries().find((entry) => entry.id === 'solar');
    expect(solar?.attributionRequired).toBe(true);
    expect(solar?.suggestedText).toBeTruthy();
  });

  it('builds a versioned manifest with timestamps', () => {
    const manifest = buildAssetsAttributionManifest('2026-01-01T00:00:00.000Z');
    expect(manifest.version).toBe(1);
    expect(manifest.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(manifest.entries.length).toBeGreaterThan(0);
  });
});
