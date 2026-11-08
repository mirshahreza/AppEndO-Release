import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildPackageZipBuffer } from '../../../../core/packages/testkit/packageZipBuilder';

const EXTENSION_SPEC = {
  packageId: 'edit-demo-pack',
  name: 'Edit Demo Pack',
  version: '1.0.0',
  apis: [
    {
      id: 'edit-demo-pack.health',
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-api-edit-'));
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

describe('package API edit helpers', () => {
  it('marks installed package APIs as editable (not built-in)', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'edit-demo-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('edit-demo-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const {
      buildPackageApiCatalogId,
      listInstalledPackageApiRoutes,
      resolvePackageApiCatalogEntry,
      updateInstalledPackageApiHandler,
    } = await import('../packageApiCatalog.service');

    const catalogId = buildPackageApiCatalogId('edit-demo-pack', 'edit-demo-pack.health');
    const routes = listInstalledPackageApiRoutes();

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: catalogId,
          isBuiltIn: false,
        }),
      ]),
    );

    const resolved = resolvePackageApiCatalogEntry(catalogId);
    expect(resolved?.packageId).toBe('edit-demo-pack');

    const updatedCode = 'export default async function handler(req, res) {\n  return res.json({ edited: true });\n}\n';
    const saveResult = updateInstalledPackageApiHandler(catalogId, updatedCode);
    expect(saveResult.ok).toBe(true);

    const routesAfterSave = listInstalledPackageApiRoutes();
    const savedRoute = routesAfterSave.find((route) => route.id === catalogId);
    expect(savedRoute?.code).toBe(updatedCode);
  });
});
