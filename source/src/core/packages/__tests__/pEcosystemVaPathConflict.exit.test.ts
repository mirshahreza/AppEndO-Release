/**
 * SC-D6 — vertical-app pathPrefix conflict with real deploymentConflictScan.
 * Spec: historical ecosystem ZIP phase-1 / phase-2 plans
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  buildVerticalAppZipBuffer,
  vaOwnerForPathConflictSpec,
  vaPathConflictSpec,
} from '../testkit/ecosystemFixtures';
import { deploymentAppliedPath } from '../testkit/deploymentAppliedAssertions';
import type { PackageLifecycleResult } from '../../../server/domain/package-domain/types';

vi.mock('../../../server/domain/platform/mountRepository', () => ({
  findPlatformMountById: async () => undefined,
}));

vi.mock('../../../server/services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../server/services/package-runtime/packageDbScripts.service', () => ({
  runPackageInstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
  runPluginUninstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
}));

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-va-path-conflict-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
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

async function loadLifecycleModules() {
  const artifact = await import('../PackageArtifactService');
  const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
  lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();
  return { artifact, coordinator };
}

function expectLifecycleFailure(result: PackageLifecycleResult, code: string) {
  expect(result.success).toBe(false);
  if (result.success) return;
  const failure = result as Extract<PackageLifecycleResult, { success: false }>;
  expect(failure.code).toBe(code);
}

describe('pEcosystemVaPathConflict.exit — SC-D6 (real deploymentConflictScan)', () => {
  it('blocks second vertical-app on conflicting pathPrefix after owner auto-apply (VA-06)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const pathPrefix = '/eco-va-conflict-path';
    const owner = vaOwnerForPathConflictSpec(pathPrefix);
    const conflict = vaPathConflictSpec(pathPrefix);

    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(owner), 'owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(conflict), 'conflict.zip', 'admin')).success).toBe(true);

    const ownerInstall = await coordinator.install(owner.packageId, 'admin@example.com');
    expect(ownerInstall.success, (ownerInstall as { error?: string }).error).toBe(true);
    if (!ownerInstall.success) return;
    expect(ownerInstall.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath(owner.packageId))).toBe(true);

    const blocked = await coordinator.install(conflict.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'conflict_denied');
  });
});
