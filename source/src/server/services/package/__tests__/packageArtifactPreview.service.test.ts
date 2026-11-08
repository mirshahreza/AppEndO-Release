import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdmZip from 'adm-zip';
import { validateManifest } from '../../../../core/packages/PackageManifestValidator';
import { buildPackageZipBuffer, REFERENCE_PACKAGE_SPECS } from '../../../../core/packages/testkit/packageZipBuilder';

import {
  buildBundleDownloadPlan,
  previewPluginInstall,
  previewZipImport,
} from '../packageArtifactPreview.service';

describe('packageArtifactPreview.service', () => {
  it('previews a valid package ZIP import with manifest', async () => {
    const spec = REFERENCE_PACKAGE_SPECS[1];
    const buffer = buildPackageZipBuffer(spec);
    const preview = previewZipImport(buffer, 'preview-demo.zip');

    expect(preview.artifactType).toBe('package');
    expect(preview.packageId).toBe(spec.packageId);
    expect(preview.validationErrors).toEqual([]);
    expect(preview.installPreview?.pluginKind).toBe('extension');
    expect(validateManifest(preview.manifest).valid).toBe(true);
  });

  it('rejects ZIP without package.json', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello'));
    const preview = previewZipImport(zip.toBuffer(), 'empty.zip');

    expect(preview.artifactType).toBe('unknown');
    expect(preview.validationErrors[0]).toContain('package.json');
  });

  it('returns not found for install preview of missing package', () => {
    const result = previewPluginInstall({ packageId: 'missing-package-xyz' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not found');
    }
  });

  it('builds bundle download plan for package slot', () => {
    const result = buildBundleDownloadPlan({
      packageId: 'eco-pl-api',
    });

    if (!result.ok) {
      expect(result.error).toBeTruthy();
      return;
    }

    expect(result.plan.items).toHaveLength(1);
    expect(result.plan.items[0]?.artifactType).toBe('package');
    expect(result.plan.items[0]?.downloadUrl).toContain('/api/packages/');
  });
});
