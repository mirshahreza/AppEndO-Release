import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import {
  REFERENCE_INVENTORY_VERTICAL_APP_SPEC,
  buildVerticalAppZipBuffer,
} from '../testkit/verticalAppPackageBuilder';
import { validateVerticalAppManifest } from '../verticalAppManifestValidator';

describe('reference inventory vertical-app package', () => {
  it('builds a valid marketplace-ready ZIP with complete manifest', () => {
    const zipBuffer = buildVerticalAppZipBuffer(REFERENCE_INVENTORY_VERTICAL_APP_SPEC);
    const zip = new AdmZip(zipBuffer);
    const manifestText = zip.readAsText('package.json');
    const manifest = JSON.parse(manifestText);

    const validation = validateVerticalAppManifest(manifest);
    expect(validation.valid, validation.errors.join('\n')).toBe(true);
    if (!validation.valid || !validation.manifest) return;

    const vaManifest = validation.manifest as VerticalAppManifest;

    expect(vaManifest.kind).toBe('vertical-app');
    expect(vaManifest.id).toBe('inventory');
    expect(vaManifest.deployment.applyPolicy).toBe('propose');
    expect(vaManifest.deployment.mount.pathPrefix).toBe('/inventory');
    expect(vaManifest.deployment.mount.experienceConfig).toMatchObject({
      locale: 'en',
      calendar: 'gregorian',
      direction: 'ltr',
    });
    expect(vaManifest.capabilities.pages).toHaveLength(2);
    expect(vaManifest.capabilities.apis).toHaveLength(2);
    expect(vaManifest.capabilities.db_objects).toHaveLength(1);
    expect(vaManifest.branding?.logoAssetKey).toBe('logo');
    expect(vaManifest.integrity.artifactHash).toMatch(/^[a-f0-9]{64}$/);

    const entryNames = zip.getEntries().map((entry) => entry.entryName).sort();
    expect(entryNames).toContain('package.json');
    expect(entryNames).toContain('db/install/inventory_items.sql');
    expect(entryNames).toContain('api/items.js');
    expect(entryNames).toContain('assets/logo.svg');
    expect(entryNames).toContain('ui/pages/Dashboard.js');
    expect(entryNames).toContain('ui/pages/Items.js');
  });

  it('re-validates after validator normalization (cached manifest round-trip)', () => {
    const zipBuffer = buildVerticalAppZipBuffer(REFERENCE_INVENTORY_VERTICAL_APP_SPEC);
    const manifest = JSON.parse(new AdmZip(zipBuffer).readAsText('package.json'));
    const first = validateVerticalAppManifest(manifest);
    expect(first.valid, first.errors.join('\n')).toBe(true);
    if (!first.valid || !first.manifest) return;

    const second = validateVerticalAppManifest(first.manifest);
    expect(second.valid, second.errors.join('\n')).toBe(true);
    expect(second.manifest?.capabilities.designer_shells).toBeUndefined();
  });
});
