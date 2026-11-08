import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../domain/platform', () => ({
  findLatestPlatformRouteBindingId: vi.fn(),
  findPlatformPageModuleByKey: vi.fn(),
  findPlatformRouteBindingById: vi.fn(),
  insertPlatformPageModule: vi.fn(async () => undefined),
  insertPlatformRouteBinding: vi.fn(async () => undefined),
  listPlatformMountRows: vi.fn(),
  listPlatformRouteBindingRows: vi.fn(async () => []),
  updatePlatformPageModule: vi.fn(async () => undefined),
  updatePlatformRouteBinding: vi.fn(async () => undefined),
  deletePlatformPageModule: vi.fn(async () => undefined),
  deletePlatformRouteBinding: vi.fn(async () => undefined),
}));

import {
  disableDesignerLayoutRoutes,
  propagateDesignerLayoutRoutes,
  removeDesignerLayoutRoutes,
} from '../designerRoutePropagation.service';
import { invalidatePlatformRuntimeConfig } from '../platformRuntimeConfig.service';
import {
  findLatestPlatformRouteBindingId,
  findPlatformPageModuleByKey,
  findPlatformRouteBindingById,
  insertPlatformPageModule,
  insertPlatformRouteBinding,
  listPlatformMountRows,
  listPlatformRouteBindingRows,
  updatePlatformPageModule,
  updatePlatformRouteBinding,
  deletePlatformPageModule,
  deletePlatformRouteBinding,
} from '../../../domain/platform';

describe('designerRoutePropagation.service', () => {
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
    vi.mocked(findPlatformPageModuleByKey).mockResolvedValue(undefined);
    vi.mocked(findLatestPlatformRouteBindingId).mockResolvedValue(undefined);
  });

  it('still upserts bindings for legacy auto-propagation mounts when present', async () => {
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
        id: 'us',
        pathPrefix: '/us',
        name: 'United States',
        enabled: true,
        defaultRoute: '/us',
        designerRoutePropagation: 'auto',
        authProfile: { requireAuth: true },
        cultureId: 'us',
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

    const result = await propagateDesignerLayoutRoutes({
      slug: 'test',
      title: 'Test Layout',
    });

    expect(result).toEqual({ pageKey: 'test', mountIds: ['ir', 'us'] });
    expect(insertPlatformPageModule).toHaveBeenCalledWith(
      {
        pageKey: 'test',
        title: 'Test Layout',
        loaderKind: 'designer',
        loaderRef: 'general/test',
        defaultRolesJson: null,
        enabled: true,
        source: 'auto',
      },
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'ir',
        routePattern: 'studio/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'ir',
        routePattern: 'component-alone/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'us',
        routePattern: 'studio/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'us',
        routePattern: 'component-alone/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalledTimes(1);
  });

  it('updates existing auto page module and route binding on legacy mounts', async () => {
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
    vi.mocked(findPlatformPageModuleByKey).mockResolvedValue({
      pageKey: 'test',
      title: 'Old Title',
      loaderKind: 'designer',
      loaderRef: 'test',
      enabled: true,
      source: 'auto',
    });
    vi.mocked(findLatestPlatformRouteBindingId).mockImplementation(async (_mountId, routePattern) => (
      routePattern === 'studio/general/test' ? { id: 42 } : undefined
    ));
    vi.mocked(findPlatformRouteBindingById).mockResolvedValue({
      id: 42,
      mountId: 'ir',
      routePattern: 'studio/general/test',
      pageKey: 'test',
      enabled: false,
      source: 'auto',
    });

    await propagateDesignerLayoutRoutes({ slug: 'test', title: 'Renamed Layout' });

    expect(updatePlatformPageModule).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        title: 'Renamed Layout',
        loaderKind: 'designer',
        loaderRef: 'general/test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(updatePlatformRouteBinding).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        routePattern: 'studio/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        mountId: 'ir',
        routePattern: 'component-alone/general/test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
  });

  it('propagates allowedRoles to page module and route bindings', async () => {
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

    await propagateDesignerLayoutRoutes({
      slug: 'secure-page',
      title: 'Secure Page',
      allowedRoles: ['ADMIN', 'EDITOR'],
    });

    expect(insertPlatformPageModule).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: 'secure-page',
        defaultRolesJson: JSON.stringify(['ADMIN', 'EDITOR']),
      }),
      { userId: null, username: null },
    );
    expect(insertPlatformRouteBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        authJson: JSON.stringify({
          accessMode: 'specific',
          allowRoles: ['ADMIN', 'EDITOR'],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        }),
      }),
      { userId: null, username: null },
    );
  });

  it('does not propagate when only studio mount exists', async () => {
    const result = await propagateDesignerLayoutRoutes({ slug: 'test', title: 'Test Layout' });

    expect(result).toEqual({ pageKey: 'test', mountIds: [] });
    expect(insertPlatformPageModule).not.toHaveBeenCalled();
    expect(insertPlatformRouteBinding).not.toHaveBeenCalled();
    expect(invalidatePlatformRuntimeConfig).not.toHaveBeenCalled();
  });

  it('disables auto route bindings and page module on layout delete', async () => {
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 7,
        mountId: 'ir',
        routePattern: 'test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      },
    ]);
    vi.mocked(findPlatformPageModuleByKey).mockResolvedValue({
      pageKey: 'test',
      title: 'Test',
      loaderKind: 'designer',
      loaderRef: 'test',
      enabled: true,
      source: 'auto',
    });

    await disableDesignerLayoutRoutes('test');

    expect(updatePlatformRouteBinding).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        enabled: false,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(updatePlatformPageModule).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        enabled: false,
        source: 'auto',
      }),
      { userId: null, username: null },
    );
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalledTimes(1);
  });

  it('deletes auto route bindings and page module on layout remove', async () => {
    vi.mocked(listPlatformRouteBindingRows).mockResolvedValue([
      {
        id: 7,
        mountId: 'ir',
        routePattern: 'test',
        pageKey: 'test',
        enabled: true,
        source: 'auto',
      },
    ]);
    vi.mocked(findPlatformPageModuleByKey).mockResolvedValue({
      pageKey: 'test',
      title: 'Test',
      loaderKind: 'designer',
      loaderRef: 'test',
      enabled: true,
      source: 'auto',
    });

    await removeDesignerLayoutRoutes('test');

    expect(deletePlatformRouteBinding).toHaveBeenCalledWith(7);
    expect(deletePlatformPageModule).toHaveBeenCalledWith('test');
    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalledTimes(1);
  });
});
