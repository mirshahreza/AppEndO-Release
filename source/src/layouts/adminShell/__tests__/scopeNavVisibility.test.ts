import { describe, expect, it } from 'vitest';
import { buildAdminShellNav } from '../buildAdminShellNav';
import {
  getPageModuleByKey,
  resolveRouteBindingForPortalRemainder,
} from '../../../app/platform/platformConfigHelpers';
import { resolvePortalFromPathname } from '../../../app/platform/PortalUrlResolver';
import { resolvePageModule } from '../../../app/platform/resolvers';
import {
  getPlatformRuntimeConfig,
  invalidatePlatformRuntimeConfig,
} from '../../../server/services/platform/platformRuntimeConfig.service';

describe('studio Records nav excludes scope admin pages', () => {
  it('does not expose scope-dimensions as a top-level Records page', async () => {
    invalidatePlatformRuntimeConfig();
    const config = await getPlatformRuntimeConfig();
    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: '/studio',
      currentUser: { role: 'ADMIN', roles: ['ADMIN'] },
      navigationRef: 'studio',
    });
    const records = groups.find((group) => group.heading === 'Records');
    expect(records).toBeTruthy();
    const keys = (records?.items ?? [])
      .filter((item) => item.type !== 'separator')
      .map((item) => item.pageKey);
    expect(keys).not.toContain('scope-dimensions');
    expect(keys).not.toContain('scope-memberships');
  });

  it('resolves every Studio sidebar item to a page module', async () => {
    invalidatePlatformRuntimeConfig();
    const config = await getPlatformRuntimeConfig();
    const groups = buildAdminShellNav({
      config,
      mountId: 'us',
      mountPathPrefix: '/us',
      currentUser: { role: 'ADMIN', roles: ['ADMIN'] },
      navigationRef: 'studio',
      currentCultureId: 'us',
      currentPortalSegment: 'studio',
    });

    const missing: string[] = [];
    const visit = (item: (typeof groups)[number]['items'][number]) => {
      if (item.type === 'separator' || !item.path) {
        item.children?.forEach(visit);
        return;
      }

      const portal = resolvePortalFromPathname(item.path, config);
      const binding = resolveRouteBindingForPortalRemainder(
        config,
        'us',
        portal.pageRemainderPath,
        portal.portalSegment,
      );
      const pageModule = binding ? getPageModuleByKey(config, binding.pageKey) : undefined;
      const resolved = pageModule?.loaderKind === 'core'
        ? Boolean(resolvePageModule(pageModule.loaderRef))
        : Boolean(pageModule?.loaderRef);

      if (!binding || !pageModule || !resolved) {
        missing.push(`${item.label} (${item.path})`);
      }
      item.children?.forEach(visit);
    };

    for (const group of groups) {
      for (const item of group.items) {
        visit(item);
      }
    }

    expect(missing).toEqual([]);
  });

  it('resolves every Hawiety sidebar item to a page module', async () => {
    invalidatePlatformRuntimeConfig();
    const config = await getPlatformRuntimeConfig();
    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: '/iq',
      currentUser: { role: 'ADMIN', roles: ['ADMIN'] },
      navigationRef: 'hawiety',
      currentCultureId: 'iq',
      currentPortalSegment: 'hawiety',
    });

    const missing: string[] = [];
    const visit = (item: (typeof groups)[number]['items'][number]) => {
      if (item.type === 'separator' || !item.path) {
        item.children?.forEach(visit);
        return;
      }

      const portal = resolvePortalFromPathname(item.path, config);
      const binding = resolveRouteBindingForPortalRemainder(
        config,
        'studio',
        portal.pageRemainderPath,
        portal.portalSegment,
      );
      const pageModule = binding ? getPageModuleByKey(config, binding.pageKey) : undefined;
      const resolved = pageModule?.loaderKind === 'core'
        ? Boolean(resolvePageModule(pageModule.loaderRef))
        : Boolean(pageModule?.loaderRef);

      if (!binding || !pageModule || !resolved) {
        missing.push(`${item.label} (${item.path})`);
      }
      item.children?.forEach(visit);
    };

    for (const group of groups) {
      for (const item of group.items) {
        visit(item);
      }
    }

    expect(missing).toEqual([]);
  });
});
