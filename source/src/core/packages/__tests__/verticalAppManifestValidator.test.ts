import { describe, expect, it } from 'vitest';
import { isVerticalAppManifest, validateManifest } from '../PackageManifestValidator';
import { buildVerticalAppManifest } from '../testkit/verticalAppPackageBuilder';

describe('validateManifest – vertical-app 1.1', () => {
  it('accepts a minimal valid vertical-app manifest', () => {
    const manifest = buildVerticalAppManifest({
      packageId: 'ref-inventory',
      name: 'Reference Inventory',
      version: '1.0.0',
      pathPrefix: '/inventory',
    });

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.manifest && isVerticalAppManifest(result.manifest)).toBe(true);
  });

  it('rejects when deployment.shellRule.shellKey mismatches shell key', () => {
    const manifest = buildVerticalAppManifest({
      packageId: 'ref-inventory',
      name: 'Reference Inventory',
      version: '1.0.0',
      pathPrefix: '/inventory',
    });
    manifest.deployment.shellRule.shellKey = 'wrong-shell';

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('shellRule.shellKey'))).toBe(true);
  });

  it('rejects route pageKey missing from pages/designer_layouts', () => {
    const manifest = buildVerticalAppManifest({
      packageId: 'ref-inventory',
      name: 'Reference Inventory',
      version: '1.0.0',
      pathPrefix: '/inventory',
    });
    manifest.capabilities.pages[0].pageKey = 'missing-page';

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('pages or designer_layouts'))).toBe(true);
  });
});
