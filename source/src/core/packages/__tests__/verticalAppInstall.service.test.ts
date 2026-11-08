import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildVerticalAppZipBuffer } from '../testkit/verticalAppPackageBuilder';

vi.mock('../../../server/services/package-runtime/deploymentConflictScan', () => ({
  findEffectiveShellOwner: vi.fn(async () => null),
  findEffectivePageModuleOwner: vi.fn(async () => null),
  findEffectiveMountIdByPathPrefix: vi.fn(async () => null),
  findEffectiveMountOwnerById: vi.fn(async () => null),
  findEffectiveRouteBindingOwner: vi.fn(async () => null),
  listEffectiveMountPathPrefixes: vi.fn(async () => []),
  mountExistsInCoreOrDeployments: vi.fn(async () => false),
  CORE_PLATFORM_OWNER: '__core__',
}));

vi.mock('../../../server/domain/platform/mountRepository', () => ({
  findPlatformMountById: vi.fn(async () => undefined),
}));

vi.mock('../../../server/services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'va-install-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('verticalAppInstall orchestration', () => {
  it('installs vertical-app with pending deployment when applyPolicy is propose', async () => {
    const artifact = await import('../PackageArtifactService');
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const zip = buildVerticalAppZipBuffer({
      packageId: 'va-orchestration',
      name: 'VA Orchestration',
      version: '1.0.0',
      pathPrefix: '/va-orchestration',
      applyPolicy: 'propose',
    });

    const upload = await artifact.uploadPackageArtifact(zip, 'va-orchestration.zip', 'admin');
    expect(upload.success).toBe(true);

    const install = await coordinator.install('va-orchestration', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);

    const state = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'packages-storage', 'installed', 'va-orchestration.install-state.json'),
        'utf8',
      ),
    );
    expect(state.deploymentStatus).toBe('pending');
    expect(state.pluginKind).toBe('vertical-app');

    const previewPath = path.join(
      tmpDir,
      'packages-storage',
      'installed',
      'va-orchestration.deployment-preview.json',
    );
    expect(fs.existsSync(previewPath)).toBe(true);
  });

  it('applies pending deployment proposal', async () => {
    const artifact = await import('../PackageArtifactService');
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const zip = buildVerticalAppZipBuffer({
      packageId: 'va-apply',
      name: 'VA Apply',
      version: '1.0.0',
      pathPrefix: '/va-apply',
      applyPolicy: 'propose',
    });

    const upload = await artifact.uploadPackageArtifact(zip, 'va-apply.zip', 'admin');
    expect(upload.success).toBe(true);

    const install = await coordinator.install('va-apply', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);

    const apply = await coordinator.applyDeployment('va-apply', 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (apply.success) {
      expect(apply.deploymentStatus).toBe('applied');
    }

    const state = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'packages-storage', 'installed', 'va-apply.install-state.json'),
        'utf8',
      ),
    );
    expect(state.deploymentStatus).toBe('applied');
    expect(fs.existsSync(path.join(tmpDir, 'packages-storage', 'installed', 'va-apply.deployment-preview.json'))).toBe(false);
  });
});
