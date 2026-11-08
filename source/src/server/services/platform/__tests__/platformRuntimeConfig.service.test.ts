import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformRuntimeConfig } from '../../../../shared/api/contracts/platform/types';
import { readPlatformRegistryIndex } from '../../../../core/platform-registry/PlatformRegistryFileStore';
import {
  __setPlatformRuntimeConfigCacheForTests,
  computePlatformRuntimeVersion,
  getPlatformRuntimeConfig,
  invalidatePlatformRuntimeConfig,
  loadPlatformRuntimeConfig,
} from '../platformRuntimeConfig.service';

const sampleConfig: Omit<PlatformRuntimeConfig, 'version'> = {
  mounts: [
    {
      id: 'studio',
      pathPrefix: '/studio',
      name: 'Studio',
      enabled: true,
      defaultRoute: '/studio',
      designerRoutePropagation: 'none',
      authProfile: { requireAuth: true },
    },
  ],
  shells: [
    {
      shellKey: 'admin',
      name: 'Admin Layout',
      entry: 'core:AdminLayout',
      surface: 'admin',
      enabled: true,
    },
  ],
  shellRules: [
    {
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio',
      shellKey: 'admin',
      priority: 0,
      enabled: true,
    },
  ],
  pageModules: [
    {
      pageKey: 'dashboard',
      title: 'Dashboard',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      enabled: true,
    },
  ],
  bindings: [
    {
      id: 1,
      mountId: 'studio',
      routePattern: '',
      pageKey: 'dashboard',
      enabled: true,
      nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
    },
  ],
  navigations: [
    {
      id: 'studio-admin',
      groups: [],
    },
  ],
};

vi.mock('../../remote-hubs/remoteHubsRuntime', () => ({
  isRemoteHubsRuntimeEnabled: () => false,
  ensureRemoteHubsNavigationIfInstalled: (manifest: unknown) => manifest,
  filterRemoteHubsHostRowsUnlessInstalled: (rows: unknown[]) => rows,
  filterRemoteHubsNavigationUnlessInstalled: (manifest: unknown) => manifest,
  applyRemoteHubsChromeToPageModules: (rows: unknown[]) => rows,
  applyRemoteHubsChromeToBindings: (rows: unknown[]) => rows,
}));

vi.mock('../../hawiety/hawietyRuntime', () => ({
  isHawietyRuntimeEnabled: () => false,
  filterHawietyHostRowsUnlessInstalled: (rows: unknown[]) => rows,
  filterHawietyNavigationsUnlessInstalled: (navigations: unknown[]) => navigations,
}));

vi.mock('../../../../core/packages/PackageFileStore', () => ({
  listDeploymentAppliedRecords: vi.fn(() => []),
}));

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listNavigationFiles: vi.fn(() => sampleConfig.navigations),
  readPlatformRegistryIndex: vi.fn(() => ({
    schema: 'platform-registry-index' as const,
    schemaVersion: '1.0.0' as const,
    updatedAt: '2026-06-17T12:00:00.000Z',
  })),
}));

vi.mock('../../../domain/platform', () => ({
  listPlatformMountRows: vi.fn(async () => sampleConfig.mounts),
  listPlatformShellRows: vi.fn(async () => sampleConfig.shells),
  listPlatformShellRuleRows: vi.fn(async () => sampleConfig.shellRules),
  listPlatformPageModuleRows: vi.fn(async () => sampleConfig.pageModules),
  listPlatformRouteBindingRows: vi.fn(async () => sampleConfig.bindings),
}));

afterEach(() => {
  invalidatePlatformRuntimeConfig();
});

describe('platformRuntimeConfig.service', () => {
  it('computes a stable version hash from registry content', () => {
    const versionA = computePlatformRuntimeVersion(sampleConfig);
    const versionB = computePlatformRuntimeVersion(sampleConfig);

    expect(versionA).toBe(versionB);
    expect(versionA).toHaveLength(16);
  });

  it('changes version when mount content changes', () => {
    const before = computePlatformRuntimeVersion(sampleConfig);
    const after = computePlatformRuntimeVersion({
      ...sampleConfig,
      mounts: [
        {
          ...sampleConfig.mounts[0],
          name: 'Studio Updated',
          updatedAt: '2026-06-17T12:00:00.000Z',
        },
      ],
    });

    expect(after).not.toBe(before);
  });

  it('loads runtime config with computed version', async () => {
    const config = await loadPlatformRuntimeConfig();

    expect(config.mounts).toHaveLength(1);
    expect(config.bindings).toHaveLength(1);
    expect(config.navigations).toEqual(sampleConfig.navigations);
    expect(config.version).toBe(computePlatformRuntimeVersion(sampleConfig, ['remote-hubs:off', 'hawiety:off']));
  });

  it('caches runtime config until invalidation', async () => {
    const first = await getPlatformRuntimeConfig();
    const second = await getPlatformRuntimeConfig();

    expect(second).toBe(first);

    invalidatePlatformRuntimeConfig();
    const third = await getPlatformRuntimeConfig();

    expect(third).not.toBe(first);
    expect(third.version).toBe(first.version);
  });

  it('reloads when another process bumps the registry index (cross-process staleness)', async () => {
    const first = await getPlatformRuntimeConfig();
    const second = await getPlatformRuntimeConfig();
    expect(second).toBe(first);

    // Simulate a write from a different process: no in-process invalidatePlatformRuntimeConfig()
    // call happens, only the on-disk index's updatedAt changes.
    vi.mocked(readPlatformRegistryIndex).mockReturnValueOnce({
      schema: 'platform-registry-index',
      schemaVersion: '1.0.0',
      updatedAt: '2026-06-17T13:00:00.000Z',
    }).mockReturnValue({
      schema: 'platform-registry-index',
      schemaVersion: '1.0.0',
      updatedAt: '2026-06-17T13:00:00.000Z',
    });

    const third = await getPlatformRuntimeConfig();
    expect(third).not.toBe(first);

    const fourth = await getPlatformRuntimeConfig();
    expect(fourth).toBe(third);
  });

  it('allows tests to seed cache directly', async () => {
    const cached: PlatformRuntimeConfig = {
      ...sampleConfig,
      version: 'test-version',
    };

    __setPlatformRuntimeConfigCacheForTests(cached);
    await expect(getPlatformRuntimeConfig()).resolves.toEqual(cached);
  });
});
