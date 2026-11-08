import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../domain/platform', () => ({
  deletePlatformMount: vi.fn(async () => undefined),
  deletePlatformRouteBinding: vi.fn(async () => undefined),
  deletePlatformShellRule: vi.fn(async () => undefined),
  findLatestPlatformRouteBindingId: vi.fn(),
  findPlatformRouteBindingById: vi.fn(),
  insertPlatformRouteBinding: vi.fn(async () => undefined),
  listPlatformMountRows: vi.fn(),
  listPlatformRouteBindingRows: vi.fn(),
  listPlatformShellRuleRows: vi.fn(),
  updatePlatformRouteBinding: vi.fn(async () => undefined),
}));

import {
  ensureCultureRegistryMountsRemoved,
  ensureExperienceRegistryCleanup,
  ensureExperienceRegistryCleanupInBackground,
  ensureExperienceRouteBindings,
  ensureExperienceShellRules,
  propagateStudioRouteBinding,
  removePropagatedStudioRouteBinding,
} from '../experienceRoutePropagation.service';
import { invalidatePlatformRuntimeConfig } from '../platformRuntimeConfig.service';
import {
  deletePlatformMount,
  deletePlatformRouteBinding,
  deletePlatformShellRule,
  findLatestPlatformRouteBindingId,
  findPlatformRouteBindingById,
  insertPlatformRouteBinding,
  listPlatformMountRows,
  listPlatformRouteBindingRows,
  listPlatformShellRuleRows,
  updatePlatformRouteBinding,
} from '../../../domain/platform';
import { EXPERIENCE_ROUTE_SOURCE } from '../../../../shared/api/contracts/platform/mountConstants';

describe('experienceRoutePropagation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlatformMountRows).mockResolvedValue([
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none',
        authProfile: { requireAuth: true },
      },
    ]);
  });

  it('does not propagate studio bindings when no auto-propagation mounts exist', async () => {
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue(undefined);

    const result = await propagateStudioRouteBinding({
      id: 10,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
      nav: { label: 'Users', icon: 'Users' },
    });

    expect(result).toEqual([]);
    expect(insertPlatformRouteBinding).not.toHaveBeenCalled();
    expect(invalidatePlatformRuntimeConfig).not.toHaveBeenCalled();
  });

  it('still propagates to legacy auto-propagation mounts when present in registry', async () => {
    vi.mocked(listPlatformMountRows).mockResolvedValue([
      {
        id: 'ir',
        pathPrefix: '/ir',
        name: 'Iran',
        enabled: true,
        defaultRoute: '/ir',
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
        cultureId: 'ir',
      },
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none',
        authProfile: { requireAuth: true },
      },
    ]);
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue(undefined);

    const result = await propagateStudioRouteBinding({
      id: 10,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
    });

    expect(result).toEqual(['ir']);
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'ir',
        routePattern: 'studio/users',
        pageKey: 'users',
        source: EXPERIENCE_ROUTE_SOURCE,
      }),
      expect.any(Object),
    );
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalled();
  });

  it('updates mirrored bindings when studio binding already exists on experience mount', async () => {
    vi.mocked(listPlatformMountRows).mockResolvedValue([
      {
        id: 'ir',
        pathPrefix: '/ir',
        name: 'Iran',
        enabled: true,
        defaultRoute: '/ir',
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
        cultureId: 'ir',
      },
    ]);
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue({ id: 55 });
    vi.mocked(findPlatformRouteBindingById).mockResolvedValue({
      id: 55,
      mountId: 'ir',
      routePattern: '',
      pageKey: 'users',
      enabled: true,
      source: 'manual',
    });
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 55,
        mountId: 'ir',
        routePattern: '',
        pageKey: 'users',
        enabled: true,
        source: 'manual',
      },
    ]);

    await propagateStudioRouteBinding({
      id: 10,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: false,
    });

    expect(updatePlatformRouteBinding).toHaveBeenCalledWith(
      55,
      expect.objectContaining({
        routePattern: 'studio/users',
        enabled: false,
        source: EXPERIENCE_ROUTE_SOURCE,
      }),
      expect.any(Object),
    );
    expect(insertPlatformRouteBinding).not.toHaveBeenCalled();
  });

  it('removes mirrored bindings when a studio binding is deleted', async () => {
    vi.mocked(listPlatformMountRows).mockResolvedValue([
      {
        id: 'ir',
        pathPrefix: '/ir',
        name: 'Iran',
        enabled: true,
        defaultRoute: '/ir',
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
        cultureId: 'ir',
      },
    ]);
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 90,
        mountId: 'ir',
        routePattern: 'studio/users',
        pageKey: 'users',
        enabled: true,
        source: EXPERIENCE_ROUTE_SOURCE,
      },
    ]);

    await removePropagatedStudioRouteBinding({
      id: 10,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
    });

    expect(deletePlatformRouteBinding).toHaveBeenCalledWith(90);
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalled();
  });

  it('skips backfill when no auto-propagation mounts exist', async () => {
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
      },
      {
        id: 2,
        mountId: 'studio',
        routePattern: 'users',
        pageKey: 'users',
        enabled: true,
      },
    ]);
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue(undefined);

    const result = await ensureExperienceRouteBindings();

    expect(result.mountIds).toEqual([]);
    expect(result.syncedCount).toBe(0);
    expect(insertPlatformRouteBinding).not.toHaveBeenCalled();
  });

  it('removes legacy culture registry mounts on cleanup', async () => {
    vi.mocked(listPlatformMountRows).mockResolvedValue([
      {
        id: 'ir',
        pathPrefix: '/ir',
        name: 'Iran',
        enabled: true,
        defaultRoute: '/ir/studio',
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
        cultureId: 'ir',
      },
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none',
        authProfile: { requireAuth: true },
      },
    ]);

    const removed = await ensureCultureRegistryMountsRemoved();

    expect(removed).toEqual(['ir']);
    expect(deletePlatformMount).toHaveBeenCalledWith('ir');
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalled();
  });

  it('removes culture and redundant admin shell rules on cleanup', async () => {
    vi.mocked(listPlatformShellRuleRows).mockResolvedValue([
      {
        id: 1,
        mountId: 'studio',
        pathPrefix: '/studio',
        shellKey: 'admin',
        priority: 0,
        enabled: true,
      },
      {
        id: 2,
        mountId: 'ir',
        pathPrefix: '/ir',
        shellKey: 'admin',
        priority: 0,
        enabled: true,
      },
      {
        id: 3,
        mountId: 'studio',
        pathPrefix: '/studio/client-components',
        shellKey: 'designer',
        priority: 10,
        enabled: true,
      },
    ]);

    const removedCount = await ensureExperienceShellRules();

    expect(removedCount).toBe(2);
    expect(deletePlatformShellRule).toHaveBeenCalledWith(1);
    expect(deletePlatformShellRule).toHaveBeenCalledWith(2);
    expect(deletePlatformShellRule).not.toHaveBeenCalledWith(3);
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalled();
  });

  it('runs mount, shell-rule, and route cleanup together', async () => {
    let mounts = [
      {
        id: 'us',
        pathPrefix: '/us',
        name: 'US',
        enabled: true,
        defaultRoute: '/us/studio',
        designerRoutePropagation: 'auto' as const,
        authProfile: { requireAuth: true },
        cultureId: 'us',
      },
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none' as const,
        authProfile: { requireAuth: true },
      },
    ];
    vi.mocked(listPlatformMountRows).mockImplementation(async () => mounts);
    vi.mocked(deletePlatformMount).mockImplementation(async (id) => {
      mounts = mounts.filter((mount) => mount.id !== id);
    });
    vi.mocked(listPlatformShellRuleRows).mockResolvedValue([
      {
        id: 1,
        mountId: 'us',
        pathPrefix: '/us',
        shellKey: 'admin',
        priority: 0,
        enabled: true,
      },
    ]);
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
      },
    ]);
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue(undefined);

    const result = await ensureExperienceRegistryCleanup();

    expect(result.removedMountIds).toEqual(['us']);
    expect(result.removedShellRuleCount).toBe(1);
    expect(result.routeSync.syncedCount).toBe(0);
  });

  it('starts background cleanup only once per process', async () => {
    vi.mocked(listPlatformMountRows).mockResolvedValue([]);
    vi.mocked(listPlatformShellRuleRows).mockResolvedValue([]);
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([]);

    ensureExperienceRegistryCleanupInBackground();
    ensureExperienceRegistryCleanupInBackground();

    await vi.waitFor(() => {
      expect(listPlatformMountRows).toHaveBeenCalled();
    });
    await new Promise((resolve) => { setTimeout(resolve, 50); });

    const stableCalls = vi.mocked(listPlatformMountRows).mock.calls.length;
    ensureExperienceRegistryCleanupInBackground();
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(vi.mocked(listPlatformMountRows).mock.calls.length).toBe(stableCalls);
  });
});
