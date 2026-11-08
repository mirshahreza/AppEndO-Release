import { describe, expect, it } from 'vitest';
import {
  buildDashboardMyLinks,
  listDashboardMyLinkDefs,
} from '../dashboardMyLinks';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

const emptyConfig: PlatformRuntimeConfig = {
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
    {
      id: 'hawiety',
      pathPrefix: '/hawiety',
      name: 'Hawiety',
      enabled: true,
      defaultRoute: '/hawiety',
      designerRoutePropagation: 'none',
      authProfile: { requireAuth: true },
    },
  ],
  shells: [],
  shellRules: [],
  pageModules: [],
  bindings: [],
  navigations: [],
  version: 'v1',
};

describe('dashboardMyLinks', () => {
  it('includes account-menu routes and actions for every user', () => {
    expect(listDashboardMyLinkDefs(false).map((link) => link.id)).toEqual([
      'my-inbox',
      'my-apis',
      'my-workbooks',
      'active-sessions',
      'change-password',
      'logout',
    ]);
  });

  it('adds delete account when self-delete is allowed', () => {
    expect(listDashboardMyLinkDefs(true).map((link) => link.id)).toEqual([
      'my-inbox',
      'my-apis',
      'my-workbooks',
      'active-sessions',
      'change-password',
      'delete-account',
      'logout',
    ]);
  });

  it('resolves personal page paths without changing the active portal segment', () => {
    const links = buildDashboardMyLinks({
      config: emptyConfig,
      pathname: '/us/studio/dashboard',
      mountId: 'studio',
      currentUser: { role: 'USER', roles: ['USER'] },
      canDeleteAccount: false,
    });

    expect(links.find((link) => link.id === 'my-apis')?.path).toBe('/us/studio/my-apis');
    expect(links.find((link) => link.id === 'my-workbooks')?.path).toBe('/us/studio/my-workbooks');
    expect(links.find((link) => link.id === 'my-inbox')?.path).toBe('/us/studio/my-inbox');
  });

  it('keeps hawiety portal when opening inbox from the personal menu', () => {
    const config: PlatformRuntimeConfig = {
      ...emptyConfig,
      shells: [
        {
          shellKey: 'hawiety',
          name: 'Hawiety',
          entry: 'core:AdminLayout',
          surface: 'studio',
          enabled: true,
        },
      ],
    };

    const links = buildDashboardMyLinks({
      config,
      pathname: '/iq/hawiety/members-all',
      mountId: 'hawiety',
      currentUser: { role: 'USER', roles: ['USER'] },
      canDeleteAccount: false,
    });

    expect(links.find((link) => link.id === 'my-inbox')?.path).toBe('/iq/hawiety/my-inbox');
  });
});
