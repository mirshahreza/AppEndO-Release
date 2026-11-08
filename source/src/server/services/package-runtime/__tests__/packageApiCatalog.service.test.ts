import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildPackageZipBuffer } from '../../../../core/packages/testkit/packageZipBuilder';

const EXTENSION_SPEC = {
  packageId: 'catalog-demo-pack',
  name: 'Catalog Demo Pack',
  version: '1.0.0',
  apis: [
    {
      id: 'catalog-demo-pack.health',
      method: 'GET' as const,
      path: '/packages/health',
      entry: 'edge/health.js',
      auth: 'public' as const,
    },
  ],
};

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-api-catalog-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  } catch {
    // module may not be loaded
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Windows may briefly lock package-storage handles
  }
  vi.resetModules();
});

describe('packageApiCatalog.service', () => {
  it('lists enabled installed package APIs for the server functions catalog', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'catalog-demo-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('catalog-demo-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const { listInstalledPackageApiRoutes } = await import('../packageApiCatalog.service');
    const routes = listInstalledPackageApiRoutes();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pkg-api-catalog-demo-pack-catalog-demo-pack.health',
          method: 'GET',
          path: '/api/packages/health',
          folder: 'packages',
          isBuiltIn: false,
          packageId: 'catalog-demo-pack',
          packageDisplayName: 'Catalog Demo Pack',
        }),
      ]),
    );
  });
});
