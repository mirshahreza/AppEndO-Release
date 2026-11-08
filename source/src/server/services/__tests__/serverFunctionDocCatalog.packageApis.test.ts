import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildPackageZipBuffer } from '../../../core/packages/testkit/packageZipBuilder';
import { buildManagedFunctionOpenApiDocument } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';

const EXTENSION_SPEC = {
  packageId: 'openapi-demo-pack',
  name: 'OpenAPI Demo Pack',
  version: '1.0.0',
  apis: [
    {
      id: 'openapi-demo-pack.health',
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-openapi-docs-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../package-runtime/packageLifecycle.service');
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

describe('serverFunctionDocCatalog package APIs', () => {
  it('includes installed package APIs in OpenAPI doc inputs and scoped specs', async () => {
    const artifact = await import('../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'openapi-demo-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('openapi-demo-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const { buildPackageApiCatalogId } = await import('../package-runtime/packageApiCatalog.service');
    const { findServerFunctionDocInput, loadAllServerFunctionDocInputs } = await import('../serverFunctionDocCatalog');

    const catalogId = buildPackageApiCatalogId('openapi-demo-pack', 'openapi-demo-pack.health');
    const deps = { discoverSystemRoutes: async () => [] };
    const inputs = await loadAllServerFunctionDocInputs(deps);

    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: catalogId,
          method: 'GET',
          path: '/api/packages/health',
          is_built_in: false,
        }),
      ]),
    );

    const resolved = await findServerFunctionDocInput(deps, catalogId);
    expect(resolved).toMatchObject({
      id: catalogId,
      path: '/api/packages/health',
      is_built_in: false,
    });

    const spec = buildManagedFunctionOpenApiDocument(resolved!);
    expect(spec).toMatchObject({
      openapi: '3.1.2',
      paths: expect.objectContaining({
        '/api/packages/health': expect.objectContaining({
          get: expect.any(Object),
        }),
      }),
    });
  });
});
