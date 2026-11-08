import { describe, expect, it } from 'vitest';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { resolveStudioPagePath } from '../constants';

const adminUser = { role: 'ADMIN', roles: ['ADMIN'] };
const memberUser = { role: 'USER', roles: ['USER'] };

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
  ],
  shells: [],
  shellRules: [],
  pageModules: [],
  bindings: [],
  navigations: [],
  version: 'v1',
};

describe('resolveStudioPagePath Insights fallback', () => {
  it('builds culture Studio paths when Insights bindings are not in runtime config yet', () => {
    expect(
      resolveStudioPagePath(emptyConfig, 'us', '/us', adminUser, 'studio-insights-ops'),
    ).toBe('/us/studio/insights/operations');
    expect(
      resolveStudioPagePath(emptyConfig, 'us', '/us', adminUser, 'studio-insights-work'),
    ).toBe('/us/studio/insights/work');
    expect(
      resolveStudioPagePath(emptyConfig, 'us', '/us', adminUser, 'studio-insights-people'),
    ).toBe('/us/studio/insights/people');
  });

  it('builds studio-mount paths without a second studio segment', () => {
    expect(
      resolveStudioPagePath(emptyConfig, 'studio', '/studio', adminUser, 'studio-insights-ops'),
    ).toBe('/studio/insights/operations');
  });

  it('does not invent Insights links for non-admin users', () => {
    expect(
      resolveStudioPagePath(emptyConfig, 'us', '/us', memberUser, 'studio-insights-ops'),
    ).toBeUndefined();
  });

  it('uses the live binding when it exists', () => {
    const config: PlatformRuntimeConfig = {
      ...emptyConfig,
      bindings: [
        {
          id: 85,
          mountId: 'studio',
          routePattern: 'insights/operations',
          pageKey: 'studio-insights-ops',
          enabled: true,
          auth: {
            accessMode: 'specific',
            allowRoles: ['ADMIN'],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          },
          nav: null,
        },
      ],
    };

    expect(
      resolveStudioPagePath(config, 'studio', '/studio', adminUser, 'studio-insights-ops'),
    ).toBe('/studio/insights/operations');
  });
});
