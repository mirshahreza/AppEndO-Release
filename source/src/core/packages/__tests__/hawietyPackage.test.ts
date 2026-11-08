import { describe, expect, it } from 'vitest';
import { validateVerticalAppManifest } from '../verticalAppManifestValidator';
import {
  buildHawietyCultureKeys,
  buildHawietyVerticalAppPackageSpec,
  listHawietyPackageDbInstallFiles,
} from '../hawietyPackagePackRecipe';
import { buildVerticalAppManifest } from '../testkit/verticalAppPackageBuilder';
import { assertHawietyPackageManifestValid, buildHawietyPackageZipBuffer } from '../hawietyPackageZip';
import { verifyHawietyReinstallParity } from '../../../../scripts/hawiety-pack/verify-hawiety-reinstall-parity';
import { coerceHawietyPackagePageModule, HAWIETY_PACKAGE_ID } from '../hawietyPackage';

describe('Hawiety package recipe', () => {
  it('builds a valid vertical-app manifest with SQL install scripts (no member seed)', () => {
    assertHawietyPackageManifestValid();
    const spec = buildHawietyVerticalAppPackageSpec();
    const manifest = buildVerticalAppManifest(spec);
    expect(manifest.id).toBe(HAWIETY_PACKAGE_ID);
    expect(manifest.kind).toBe('vertical-app');
    expect(manifest.capabilities.db_objects.length).toBeGreaterThan(0);
    expect(manifest.capabilities.db_objects.some((db) => db.installScript.includes('hwy_schema'))).toBe(true);
    expect(manifest.capabilities.db_objects.every((db) => !/member.*seed/i.test(db.installScript))).toBe(true);
    const validation = validateVerticalAppManifest(manifest);
    expect(validation.valid, validation.errors.join('\n')).toBe(true);
  });

  it('coerces legacy core:Hwy loaders to hawiety:pageKey', () => {
    const upgraded = coerceHawietyPackagePageModule({
      pageKey: 'hwy-targhin-requests',
      loaderKind: 'core',
      loaderRef: 'core:HwyMemberTarghinAdmin',
    });
    expect(upgraded.loaderKind).toBe('package');
    expect(upgraded.loaderRef).toBe('hawiety:hwy-targhin-requests');
    expect(upgraded.ownerPackageId).toBe(HAWIETY_PACKAGE_ID);
  });

  it('matches live workspace registry snapshot + zip artifact (reinstall parity)', () => {
    const drift = verifyHawietyReinstallParity();
    expect(drift, drift.join('\n')).toEqual([]);
  });

  it(
    'ships culture keys and prebuilt UI bundles in the zip',
    async () => {
    const zip = await buildHawietyPackageZipBuffer();
    expect(zip.byteLength).toBeGreaterThan(10_000);
    const AdmZip = (await import('adm-zip')).default;
    const archive = new AdmZip(zip);
    const dossierView = archive.getEntry('ui/pages/hwy_member_dossier_view.bundle.js');
    expect(dossierView).toBeTruthy();
    expect(archive.readAsText(dossierView!)).toContain('appendo-package-ui-prebuilt:v1');
    const keys = buildHawietyCultureKeys();
    expect(keys['nav.group.hawiety']).toBe('Hawiety');
    expect(listHawietyPackageDbInstallFiles().length).toBeGreaterThan(5);
  },
    180_000,
  );
});
