import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

afterEach(() => {
  delete process.env.PACKAGE_STORAGE_ROOT;
  vi.resetModules();
});

describe('PackageFileStore PACKAGE_STORAGE_ROOT isolation', () => {
  it('does not replace the live catalog when PACKAGE_STORAGE_ROOT is set', async () => {
    const liveIndexPath = path.join(process.cwd(), 'packages-storage', 'index.json');
    const before = fs.existsSync(liveIndexPath) ? fs.readFileSync(liveIndexPath, 'utf8') : '';
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-store-isolate-'));
    process.env.PACKAGE_STORAGE_ROOT = isolated;
    vi.resetModules();

    try {
      const store = await import('../PackageFileStore');
      store.writePackageIndex({
        schema: 'package-index',
        schemaVersion: '1.0.0',
        updatedAt: new Date().toISOString(),
        packages: [{
          packageId: 'pkg-portal-test',
          displayName: 'Portal Test',
          latestVersion: '1.0.0',
          versions: [{
            version: '1.0.0',
            artifactPath: 'artifacts/pkg-portal-test/1.0.0.zip',
            manifestPath: 'manifests/pkg-portal-test/1.0.0.manifest.json',
            artifactSha256: 'a'.repeat(64),
            requiredAppVersion: '1.0.0',
            createdAt: new Date().toISOString(),
          }],
        }],
      });

      expect(fs.readFileSync(path.join(isolated, 'index.json'), 'utf8')).toContain('pkg-portal-test');
      const after = fs.existsSync(liveIndexPath) ? fs.readFileSync(liveIndexPath, 'utf8') : '';
      expect(after).toBe(before);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});
