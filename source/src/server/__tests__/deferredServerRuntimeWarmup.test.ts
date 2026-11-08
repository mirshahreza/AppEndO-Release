import { describe, expect, it, vi } from 'vitest';

const refreshMock = vi.hoisted(() => vi.fn());
const identityInitMock = vi.hoisted(() => vi.fn());
vi.mock('../db/dataSourcesStore', () => ({
  refreshEdgeDataSourcesCatalog: refreshMock,
}));

vi.mock('../services/auth/identityProviderSettings.service', () => ({
  initIdentityProviderRuntime: identityInitMock,
}));

vi.mock('../../core/platform-registry/platformRegistryDefaults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/platform-registry/platformRegistryDefaults')>();
  return {
    ...actual,
    syncMissingPlatformRegistryDefaults: vi.fn(),
    restoreCorePlatformRegistryArtifacts: vi.fn(),
    ensureCoreStudioDevelopmentRegistryArtifacts: vi.fn(),
  };
});

vi.mock('../../core/platform-registry/ensurePlatformRegistrySeed', () => ({
  ensurePlatformRegistrySeed: vi.fn(),
}));

vi.mock('../../core/platform-registry/PlatformRegistryFileStore', () => ({
  ensurePlatformRegistryDirs: vi.fn(),
  cleanupPlatformRegistryTmpFiles: vi.fn(),
}));

vi.mock('../../core/functions/FunctionFileStore', () => ({
  cleanupFunctionStoreTmpFiles: vi.fn(),
}));

vi.mock('../../core/packages/PackageFileStore', () => ({
  cleanupPackageTmpFiles: vi.fn(),
  enforcePackageEventRetention: vi.fn(),
}));

vi.mock('../domain/record-events/sampleMockHistory', () => ({
  seedSampleMockRecordEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

import { runDeferredServerRuntimeWarmup } from '../deferredServerRuntimeWarmup';

describe('runDeferredServerRuntimeWarmup', () => {
  it('refreshes edge catalog and identity runtime', async () => {
    refreshMock.mockResolvedValue(undefined);
    identityInitMock.mockResolvedValue(undefined);

    await runDeferredServerRuntimeWarmup('/tmp/settings.json');

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(identityInitMock).toHaveBeenCalledWith('/tmp/settings.json');
  });
});
