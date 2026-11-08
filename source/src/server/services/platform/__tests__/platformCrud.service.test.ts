import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActorContext } from '../../../types/requestContext';

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../domain/platform', () => ({
  deletePlatformMount: vi.fn(async () => undefined),
  deletePlatformPageModule: vi.fn(async () => undefined),
  deletePlatformRouteBinding: vi.fn(async () => undefined),
  deletePlatformShell: vi.fn(async () => undefined),
  deletePlatformShellRule: vi.fn(async () => undefined),
  findLatestPlatformRouteBindingId: vi.fn(async () => ({ id: 99 })),
  findLatestPlatformShellRuleId: vi.fn(async () => ({ id: 88 })),
  findPlatformMountById: vi.fn(async (id: string) => ({
    id,
    pathPrefix: '/studio',
    name: 'Studio',
    enabled: true,
    defaultRoute: '/studio',
    designerRoutePropagation: 'none',
    authProfile: { requireAuth: true },
  })),
  findPlatformPageModuleByKey: vi.fn(async (pageKey: string) => ({
    pageKey,
    title: 'Page',
    loaderKind: 'core',
    loaderRef: 'core:Dashboard',
    enabled: true,
  })),
  findPlatformRouteBindingById: vi.fn(async (id: number) => ({
    id,
    mountId: 'studio',
    routePattern: 'demo',
    pageKey: 'dashboard',
    enabled: true,
  })),
  findPlatformShellByKey: vi.fn(async (shellKey: string) => ({
    shellKey,
    name: 'Admin',
    entry: 'core:AdminLayout',
    surface: 'admin',
    enabled: true,
  })),
  findPlatformShellRuleById: vi.fn(async (id: number) => ({
    id,
    mountId: 'studio',
    pathPrefix: '/studio',
    shellKey: 'admin',
    priority: 0,
    enabled: true,
  })),
  // experienceRoutePropagation.service.ts filters this list for auto-propagation mounts —
  // empty is fine here since all mocked mounts use designerRoutePropagation: 'none'.
  listPlatformMountRows: vi.fn(async () => []),
  insertPlatformMount: vi.fn(async () => undefined),
  insertPlatformPageModule: vi.fn(async () => undefined),
  insertPlatformRouteBinding: vi.fn(async () => undefined),
  insertPlatformShell: vi.fn(async () => undefined),
  insertPlatformShellRule: vi.fn(async () => undefined),
  updatePlatformMount: vi.fn(async () => undefined),
  updatePlatformPageModule: vi.fn(async () => undefined),
  updatePlatformRouteBinding: vi.fn(async () => undefined),
  updatePlatformShell: vi.fn(async () => undefined),
  updatePlatformShellRule: vi.fn(async () => undefined),
}));

import { PlatformCrudService } from '../platformCrud.service';
import { invalidatePlatformRuntimeConfig } from '../platformRuntimeConfig.service';

const actor: ActorContext = { userId: 1, isAdmin: true };

describe('PlatformCrudService registry invalidation', () => {
  const service = new PlatformCrudService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates runtime config after mount create/update/delete', async () => {
    await service.createMount(actor, {
      id: 'demo',
      name: 'Demo',
      pathPrefix: '/demo',
      defaultRoute: '/demo',
      source: 'manual',
    });
    await service.updateMount(actor, 'studio', { name: 'Studio Updated' });
    await service.deleteMount('demo');

    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalledTimes(3);
  });

  it('invalidates runtime config after shell, page module, shell rule, and binding mutations', async () => {
    await service.createShell(actor, {
      shellKey: 'demo-shell',
      name: 'Demo Shell',
      entry: 'core:AdminLayout',
      surface: 'admin',
      source: 'manual',
    });
    await service.createPageModule(actor, {
      pageKey: 'demo-page',
      title: 'Demo Page',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      source: 'manual',
    });
    await service.createShellRule(actor, {
      mountId: 'studio',
      pathPrefix: '/studio/demo',
      shellKey: 'admin',
      priority: 5,
      source: 'manual',
    });
    await service.createRouteBinding(actor, {
      mountId: 'studio',
      routePattern: 'demo-route',
      pageKey: 'dashboard',
      source: 'manual',
    });
    await service.deleteShell('demo-shell');
    await service.deletePageModule('demo-page');
    await service.deleteShellRule(88);
    await service.deleteRouteBinding(99);

    expect(invalidatePlatformRuntimeConfig).toHaveBeenCalledTimes(8);
  });
});
