import { describe, expect, it } from 'vitest';
import {
  parseNavigationManifestJson,
  serializeNavigationManifest,
} from '../navigationManifestJson';

const manifest = {
  id: 'studio',
  version: '1',
  groups: [{
    heading: null,
    items: [{ label: 'Dashboard', pageKey: 'dashboard', routePattern: '' }],
  }],
};

describe('navigationManifestJson', () => {
  it('serializes manifests with pretty formatting', () => {
    const text = serializeNavigationManifest(manifest);
    expect(text).toContain('"id": "studio"');
    expect(text.startsWith('{')).toBe(true);
  });

  it('parses valid manifest json', () => {
    const result = parseNavigationManifestJson(serializeNavigationManifest(manifest), 'studio');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.id).toBe('studio');
    }
  });

  it('rejects manifest id changes', () => {
    const text = serializeNavigationManifest({ ...manifest, id: 'other' });
    const result = parseNavigationManifestJson(text, 'studio');
    expect(result.ok).toBe(false);
  });

  it('rejects invalid json syntax', () => {
    const result = parseNavigationManifestJson('{', 'studio');
    expect(result.ok).toBe(false);
  });
});
