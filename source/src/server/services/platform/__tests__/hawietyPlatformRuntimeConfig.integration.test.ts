import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidatePlatformRuntimeConfig, loadPlatformRuntimeConfig } from '../platformRuntimeConfig.service';

vi.mock('../../hawiety/hawietyRuntime', () => ({
  isHawietyRuntimeEnabled: () => true,
  filterHawietyHostRowsUnlessInstalled: <T,>(rows: T[]) => rows,
  filterHawietyNavigationsUnlessInstalled: <T,>(navigations: T[]) => navigations,
}));

vi.mock('../../remote-hubs/remoteHubsRuntime', () => ({
  isRemoteHubsRuntimeEnabled: () => false,
  ensureRemoteHubsNavigationIfInstalled: (manifest: unknown) => manifest,
  filterRemoteHubsHostRowsUnlessInstalled: (rows: unknown[]) => rows,
  filterRemoteHubsNavigationUnlessInstalled: (manifest: unknown) => manifest,
  applyRemoteHubsChromeToPageModules: (rows: unknown[]) => rows,
  applyRemoteHubsChromeToBindings: (rows: unknown[]) => rows,
}));

vi.mock('../../../../core/packages/PackageFileStore', () => ({
  listDeploymentAppliedRecords: vi.fn(() => []),
}));

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listNavigationFiles: vi.fn(() => [{ id: 'hawiety', groups: [] }]),
  readPlatformRegistryIndex: vi.fn(() => ({
    schema: 'platform-registry-index' as const,
    schemaVersion: '1.0.0' as const,
    updatedAt: '2026-06-17T12:00:00.000Z',
  })),
}));

vi.mock('../../../domain/platform', () => ({
  listPlatformMountRows: vi.fn(async () => []),
  listPlatformShellRows: vi.fn(async () => [
    {
      shellKey: 'hawiety',
      name: 'Hawiety',
      entry: 'designer:portal-layouts/studio-shell',
      surface: 'studio',
      enabled: true,
      ownerPackageId: 'hawiety',
    },
  ]),
  listPlatformShellRuleRows: vi.fn(async () => []),
  listPlatformPageModuleRows: vi.fn(async () => [
    {
      pageKey: 'hwy-targhin-requests',
      title: 'Targhin',
      loaderKind: 'package',
      loaderRef: 'hawiety:hwy-targhin-requests',
      enabled: true,
      ownerPackageId: 'hawiety',
    },
  ]),
  listPlatformRouteBindingRows: vi.fn(async () => [
    {
      id: 128,
      mountId: 'studio',
      routePattern: 'hawiety/targhin-requests',
      pageKey: 'hwy-targhin-requests',
      enabled: true,
      ownerPackageId: 'hawiety',
    },
  ]),
}));

afterEach(() => {
  invalidatePlatformRuntimeConfig();
});

describe('Hawiety platform runtime config (package enabled)', () => {
  it('includes package-owned shell and page modules from registry', async () => {
    const config = await loadPlatformRuntimeConfig();
    expect(config.shells.some((shell) => shell.shellKey === 'hawiety')).toBe(true);
    expect(config.pageModules.some((module) => module.pageKey === 'hwy-targhin-requests')).toBe(true);
    expect(config.bindings.some((binding) => binding.routePattern === 'hawiety/targhin-requests')).toBe(true);
  });
});
