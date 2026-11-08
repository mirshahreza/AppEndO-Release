import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildVerticalAppZipBuffer } from '../../../../core/packages/testkit/verticalAppPackageBuilder';

vi.mock('../../../domain/platform/packageOwnershipRepository', () => ({
  findPlatformMountIdByPathPrefix: vi.fn(async () => null),
  listPlatformMountPathPrefixes: vi.fn(async () => []),
  deletePlatformRowsByOwnerPluginId: vi.fn(async () => undefined),
}));

vi.mock('../../../domain/platform/mountRepository', () => ({
  findPlatformMountById: vi.fn(async () => undefined),
}));

vi.mock('../../platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

describe('packageAssetsRuntime.service', () => {
  let tmpDir = '';
  let origCwd = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-assets-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
    for (const dir of ['artifacts', 'manifests', 'installed', 'objects', 'runtimes', 'dependencies', 'events', 'locks', 'tmp', 'snapshots']) {
      fs.mkdirSync(path.join('packages-storage', dir), { recursive: true });
    }
    fs.writeFileSync(
      path.join('packages-storage', 'index.json'),
      JSON.stringify({ schema: 'package-index', schemaVersion: '1.0.0', updatedAt: new Date().toISOString(), plugins: [] }),
    );
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('resolves public static assets from extracted runtime', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const zip = buildVerticalAppZipBuffer({
      packageId: 'va-assets',
      name: 'VA Assets',
      version: '1.0.0',
      pathPrefix: '/va-assets',
      applyPolicy: 'auto',
      staticAssets: [
        {
          assetKey: 'logo',
          path: 'assets/logo.svg',
          mime: 'image/svg+xml',
          public: true,
        },
      ],
    });

    const upload = await artifact.uploadPackageArtifact(zip, 'va-assets.zip', 'admin');
    expect(upload.success).toBe(true);

    const install = await coordinator.install('va-assets', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);

    const { resolvePackageStaticAsset, buildPackageStaticAssetUrl } = await import('../packageAssetsRuntime.service');
    const resolved = resolvePackageStaticAsset('va-assets', 'logo');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.isPublic).toBe(true);
      expect(resolved.contentType).toBe('image/svg+xml');
      expect(fs.readFileSync(resolved.absPath, 'utf8')).toBe('asset:logo');
    }

    expect(buildPackageStaticAssetUrl('va-assets', 'logo')).toBe('/api/packages/va-assets/assets/logo');
  });

  it('rejects unknown asset keys', async () => {
    const { resolvePackageStaticAsset } = await import('../packageAssetsRuntime.service');
    const resolved = resolvePackageStaticAsset('missing-package', 'logo');
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.statusCode).toBe(404);
    }
  });
});
