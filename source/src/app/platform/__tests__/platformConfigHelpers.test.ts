import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { ROOT_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  buildBindingNavAbsolutePath,
  buildMountAbsolutePath,
  getBindingsForMount,
  getEnabledMounts,
  getMountById,
  getNonCultureEnabledMounts,
  getShellRulesForMount,
  isCultureExperienceMount,
  isCultureRouteId,
  matchesRouteBindingPattern,
  pathnameMatchesBindingNavPath,
  resolveCultureRouteMount,
  resolveMountCalendar,
  resolveMountDirection,
  resolveRouteBindingForRelativePath,
  resolveRouteBindingForPortalRemainder,
  resolveExperiencePortalNavigationRef,
  resolveRegistryShellForPortal,
  resolveShellRuleForPath,
  toMountRelativePath,
  withNavLandingPath,
} from '../platformConfigHelpers';

const sampleConfig: PlatformRuntimeConfig = {
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
      id: 'disabled',
      pathPrefix: '/disabled',
      name: 'Disabled',
      enabled: false,
      defaultRoute: '/disabled',
      designerRoutePropagation: 'none',
      authProfile: {},
    },
  ],
  shells: [],
  shellRules: [
    {
      id: 1,
      mountId: 'studio',
      pathPrefix: '/studio/client-components',
      shellKey: 'designer',
      priority: 10,
      enabled: true,
    },
  ],
  pageModules: [],
  bindings: [
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
      enabled: false,
    },
  ],
  navigations: [],
  version: 'v1',
};

describe('platformConfigHelpers', () => {
  it('filters enabled mounts', () => {
    expect(getEnabledMounts(sampleConfig).map((mount) => mount.id)).toEqual(['studio']);
  });

  it('resolves mount by id', () => {
    expect(getMountById(sampleConfig, 'studio')?.pathPrefix).toBe('/studio');
    expect(getMountById(sampleConfig, 'missing')).toBeUndefined();
  });

  it('filters enabled bindings and shell rules for a mount', () => {
    expect(getBindingsForMount(sampleConfig, 'studio')).toHaveLength(1);
    expect(getShellRulesForMount(sampleConfig, 'studio')).toHaveLength(1);
  });

  it('inherits enabled studio bindings for culture route ids without registry mounts', () => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);

    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
        {
          id: 1,
          mountId: 'studio',
          routePattern: '',
          pageKey: 'dashboard',
          enabled: true,
          nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
        },
        {
          id: 2,
          mountId: 'studio',
          routePattern: 'users',
          pageKey: 'users',
          enabled: true,
          nav: { label: 'Users', icon: 'Users' },
        },
      ],
    };

    const irBindings = getBindingsForMount(config, 'ir');
    expect(irBindings).toHaveLength(2);
    expect(irBindings.map((binding) => binding.pageKey).sort()).toEqual(['dashboard', 'users']);
    expect(irBindings.find((binding) => binding.pageKey === 'users')?.mountId).toBe('ir');
    expect(irBindings.find((binding) => binding.pageKey === 'users')?.routePattern).toBe('studio/users');
    expect(irBindings.find((binding) => binding.pageKey === 'users')?.id).toBe(-2);
    expect(irBindings.find((binding) => binding.pageKey === 'dashboard')?.routePattern).toBe('studio');
  });

  it('dedupes legacy and mirrored dashboard bindings for experience mounts', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        ...sampleConfig.mounts,
        {
          id: 'ir',
          pathPrefix: '/ir',
          name: 'Iran',
          enabled: true,
          defaultRoute: '/ir/studio',
          designerRoutePropagation: 'auto',
          authProfile: {},
          experienceConfig: {
            locale: 'fa-IR',
            calendar: 'jalali',
            direction: 'rtl',
          },
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
        {
          id: 19,
          mountId: 'ir',
          routePattern: '',
          pageKey: 'dashboard',
          enabled: true,
          nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
          source: 'manual',
        },
        {
          id: 39,
          mountId: 'ir',
          routePattern: 'studio',
          pageKey: 'dashboard',
          enabled: true,
          nav: { label: 'Dashboard', icon: 'LayoutDashboard' },
          source: 'studio-sync',
        },
      ],
    };

    const irBindings = getBindingsForMount(config, 'ir');
    expect(irBindings.filter((binding) => binding.pageKey === 'dashboard')).toHaveLength(1);
    expect(irBindings.find((binding) => binding.pageKey === 'dashboard')?.routePattern).toBe('studio');
    expect(irBindings.find((binding) => binding.pageKey === 'dashboard')?.source).toBe('studio-sync');
  });

  it('converts absolute mount paths to relative route patterns', () => {
    expect(toMountRelativePath('/studio', '/studio')).toBe('');
    expect(toMountRelativePath('/studio/users', '/studio')).toBe('users');
    expect(toMountRelativePath('/studio/users/extra', '/studio')).toBe('users/extra');
  });

  it('builds absolute mount paths from relative segments', () => {
    expect(buildMountAbsolutePath('/studio', '')).toBe('/studio');
    expect(buildMountAbsolutePath('/studio', 'users')).toBe('/studio/users');
  });

  it('resolves the longest matching shell rule with priority tie-break', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio',
          shellKey: 'studio',
          priority: 0,
          enabled: true,
        },
        {
          id: 2,
          mountId: 'studio',
          pathPrefix: '/studio/design-preview',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
        {
          id: 3,
          mountId: 'studio',
          pathPrefix: '/studio/design-preview',
          shellKey: 'studio',
          priority: 5,
          enabled: true,
        },
      ],
    };

    expect(resolveShellRuleForPath(config, 'studio', '/studio/users')?.shellKey).toBe('studio');
    expect(resolveShellRuleForPath(config, 'studio', '/studio/design-preview')?.shellKey).toBe(
      'designer',
    );
  });

  it('resolves route bindings by relative path', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
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
      ],
    };

    expect(resolveRouteBindingForRelativePath(config, 'studio', '')?.pageKey).toBe('dashboard');
    expect(resolveRouteBindingForRelativePath(config, 'studio', 'users')?.pageKey).toBe('users');
    expect(resolveRouteBindingForRelativePath(config, 'studio', 'missing')).toBeUndefined();
  });

  it('matches trailing splat route patterns for nested settings paths', () => {
    expect(matchesRouteBindingPattern('settings/*', 'settings')).toBe(true);
    expect(matchesRouteBindingPattern('settings/*', 'settings/pwa')).toBe(true);
    expect(matchesRouteBindingPattern('settings/*', 'settings-extra')).toBe(false);
    expect(matchesRouteBindingPattern('studio/settings/*', 'studio/settings/server-functions')).toBe(true);
    expect(matchesRouteBindingPattern('server-functions/*', 'server-functions')).toBe(true);
    expect(matchesRouteBindingPattern('server-functions/*', 'server-functions/auth/login')).toBe(true);
    expect(matchesRouteBindingPattern('studio/server-functions/*', 'studio/server-functions/auth/login')).toBe(true);
    expect(matchesRouteBindingPattern('client-components/*', 'client-components')).toBe(true);
    expect(matchesRouteBindingPattern('client-components/*', 'client-components/math/ui-for-sum-two-numbers')).toBe(true);
    expect(matchesRouteBindingPattern('studio/client-components/*', 'studio/client-components/math/ui-for-sum-two-numbers')).toBe(true);

    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
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
          routePattern: 'settings/*',
          pageKey: 'settings',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForRelativePath(config, 'studio', 'settings')?.pageKey).toBe('settings');
    expect(resolveRouteBindingForRelativePath(config, 'studio', 'settings/pwa')?.pageKey).toBe('settings');
    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/studio/settings/pwa')?.pageKey).toBe(
      'settings',
    );
  });

  it('resolves route bindings from application remainder paths', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
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
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/users')?.pageKey).toBe('users');
    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/')?.pageKey).toBe('dashboard');
    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/studio/users')?.pageKey).toBe('users');
  });

  it('resolves culture route bindings from canonical studio application remainder', () => {
    bootstrapCultureRegistry(['us']);

    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
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
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(config, 'us', '/users')?.pageKey).toBe('users');
    expect(resolveRouteBindingForPortalRemainder(config, 'us', '/')?.pageKey).toBe('dashboard');
    expect(resolveRouteBindingForPortalRemainder(config, 'us', '/', ROOT_PORTAL_SEGMENT)).toBeUndefined();

    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('resolves nested client-components edit routes on culture mounts', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 3,
          mountId: 'studio',
          routePattern: 'client-components/*',
          pageKey: 'client-components',
          enabled: true,
        },
        {
          id: 33,
          mountId: 'us',
          routePattern: 'studio/client-components/*',
          pageKey: 'client-components',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/client-components/math/ui-for-sum-two-numbers',
    )?.pageKey).toBe('client-components');
  });

  it('resolves nested workflows edit routes on culture mounts', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 27,
          mountId: 'studio',
          routePattern: 'workflows',
          pageKey: 'workflows',
          enabled: true,
        },
        {
          id: 31,
          mountId: 'studio',
          routePattern: 'workflows/edit/*',
          pageKey: 'workflows',
          enabled: true,
        },
      ],
    };

    expect(matchesRouteBindingPattern('workflows', 'workflows')).toBe(true);
    expect(matchesRouteBindingPattern('workflows/edit/*', 'workflows/edit/employee-leave-request')).toBe(true);
    expect(matchesRouteBindingPattern('studio/workflows/edit/*', 'studio/workflows/edit/employee-leave-request')).toBe(true);
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/workflows',
      'studio',
    )?.pageKey).toBe('workflows');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/workflows/edit/employee-leave-request',
      'studio',
    )?.pageKey).toBe('workflows');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/workflows/edit/employee-leave-request',
    )?.pageKey).toBe('workflows');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/workflow-designer/employee-leave-request',
      'studio',
    )?.pageKey).toBe('workflows');
  });

  it('resolves nested workbooks edit routes when only an exact workbooks binding exists', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 65,
          mountId: 'studio',
          routePattern: 'workbooks',
          pageKey: 'workbooks',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/workbooks/edit/wb-1',
    )?.pageKey).toBe('workbooks');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/workbooks/edit/wb-1',
      'studio',
    )?.pageKey).toBe('workbooks');
  });

  it('resolves My Workbooks list and edit on studio and culture mounts', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 82,
          mountId: 'studio',
          routePattern: 'my-workbooks',
          pageKey: 'my-workbooks',
          enabled: true,
        },
        {
          id: 83,
          mountId: 'studio',
          routePattern: 'my-workbooks/edit/*',
          pageKey: 'my-workbooks',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/my-workbooks')?.id).toBe(82);
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/my-workbooks',
      'studio',
    )?.pageKey).toBe('my-workbooks');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/my-workbooks/edit/wb-1',
      'studio',
    )?.pageKey).toBe('my-workbooks');
  });

  it('resolves My Workbooks list when only the edit splat binding remains', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 83,
          mountId: 'studio',
          routePattern: 'my-workbooks/edit/*',
          pageKey: 'my-workbooks',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/my-workbooks',
    )?.pageKey).toBe('my-workbooks');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/my-workbooks',
      'studio',
    )?.pageKey).toBe('my-workbooks');
  });

  it('resolves nested idea-foundry view routes when only an exact idea-foundry binding exists', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 80,
          mountId: 'studio',
          routePattern: 'idea-foundry',
          pageKey: 'idea-foundry',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/idea-foundry/edit/idea-1',
    )?.pageKey).toBe('idea-foundry');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/idea-foundry/edit/idea-1',
      'studio',
    )?.pageKey).toBe('idea-foundry');
  });

  it('resolves idea-foundry list and edit when both bindings exist', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 80,
          mountId: 'studio',
          routePattern: 'idea-foundry',
          pageKey: 'idea-foundry',
          enabled: true,
        },
        {
          id: 81,
          mountId: 'studio',
          routePattern: 'idea-foundry/edit/*',
          pageKey: 'idea-foundry',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(config, 'studio', '/idea-foundry')?.id).toBe(80);
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/idea-foundry',
      'studio',
    )?.pageKey).toBe('idea-foundry');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/idea-foundry/edit/idea-1',
      'studio',
    )?.pageKey).toBe('idea-foundry');
  });

  it('resolves idea-foundry list when only the edit splat binding remains', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 80,
          mountId: 'studio',
          routePattern: 'idea-foundry/edit/*',
          pageKey: 'idea-foundry',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/idea-foundry',
    )?.pageKey).toBe('idea-foundry');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/idea-foundry',
      'studio',
    )?.pageKey).toBe('idea-foundry');
  });

  it('resolves nested data-sources questions routes when only an exact sources binding exists', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 12,
          mountId: 'studio',
          routePattern: 'data-sources',
          pageKey: 'sources',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      config,
      'studio',
      '/data-sources/questions/ds-1',
    )?.pageKey).toBe('sources');
    expect(resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/data-sources/questions/ds-1',
      'studio',
    )?.pageKey).toBe('sources');
  });

  it('resolves workflows edit paths even when only a legacy workflows/* binding exists', () => {
    const legacyConfig: PlatformRuntimeConfig = {
      ...sampleConfig,
      mounts: [
        {
          id: 'us',
          pathPrefix: '/us',
          name: 'United States',
          enabled: true,
          defaultRoute: '/us',
          designerRoutePropagation: 'auto',
          authProfile: { requireAuth: true },
        },
      ],
      bindings: [
        {
          id: 27,
          mountId: 'studio',
          routePattern: 'workflows/*',
          pageKey: 'workflows',
          enabled: true,
        },
      ],
    };

    expect(resolveRouteBindingForPortalRemainder(
      legacyConfig,
      'us',
      '/workflows/edit/employee-leave-request',
      'studio',
    )?.pageKey).toBe('workflows');
    expect(resolveRouteBindingForPortalRemainder(
      legacyConfig,
      'us',
      '/workflow-designer/employee-leave-request',
      'studio',
    )?.pageKey).toBe('workflows');
  });

  it('resolves component-alone designer preview routes without explicit bindings', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      pageModules: [
        {
          pageKey: 'my-widget',
          title: 'My Widget',
          loaderKind: 'designer',
          loaderRef: 'general/my-widget',
          enabled: true,
          source: 'auto',
        },
      ],
      bindings: [],
    };

    const binding = resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/general/my-widget',
      'component-alone',
    );

    expect(binding?.pageKey).toBe('my-widget');
    expect(binding?.routePattern).toBe('component-alone/general/my-widget');
  });

  it('resolves component-alone designer preview routes without page modules', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      pageModules: [],
      bindings: [],
    };

    const binding = resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/general/my-widget',
      'component-alone',
    );

    expect(binding?.pageKey).toBe('my-widget');
    expect(binding?.routePattern).toBe('component-alone/general/my-widget');
  });

  it('inherits component-alone studio bindings without studio prefix on culture mounts', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      bindings: [
        {
          id: 91,
          mountId: 'studio',
          routePattern: 'component-alone/general/my-widget',
          pageKey: 'my-widget',
          enabled: true,
        },
      ],
    };

    const binding = resolveRouteBindingForPortalRemainder(
      config,
      'us',
      '/general/my-widget',
      'component-alone',
    );

    expect(binding?.routePattern).toBe('component-alone/general/my-widget');
    expect(binding?.pageKey).toBe('my-widget');
  });

  it('resolves mount experience direction and calendar with defaults', () => {
    const irMount = {
      id: 'ir',
      pathPrefix: '/ir',
      name: 'Iran',
      enabled: true,
      defaultRoute: '/ir',
      designerRoutePropagation: 'auto' as const,
      authProfile: {},
      cultureId: 'ir',
      experienceConfig: {
        locale: 'fa-IR',
        calendar: 'jalali' as const,
        direction: 'rtl' as const,
      },
    };

    expect(resolveMountDirection(irMount)).toBe('rtl');
    expect(resolveMountCalendar(irMount)).toBe('jalali');
    expect(resolveMountDirection({ ...irMount, id: 'custom', cultureId: undefined, experienceConfig: undefined })).toBe('ltr');
    expect(resolveMountCalendar({ ...irMount, id: 'custom', cultureId: undefined, experienceConfig: undefined })).toBe('gregorian');
  });

  describe('culture route routing helpers', () => {
    afterEach(() => {
      bootstrapCultureRegistry(['us', 'ir', 'iq']);
    });

    const cultureConfig: PlatformRuntimeConfig = {
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
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio',
          shellKey: 'studio',
          priority: 0,
          enabled: true,
        },
      ],
      pageModules: [],
      bindings: [],
      navigations: [],
      version: 'v1',
    };

    it('identifies enabled culture pack ids as culture routes', () => {
      expect(isCultureRouteId('ir')).toBe(true);
      expect(isCultureRouteId('studio')).toBe(false);
    });

    it('excludes culture routes from non-culture enabled mounts', () => {
      expect(getNonCultureEnabledMounts(cultureConfig).map((mount) => mount.id)).toEqual(['studio']);
    });

    it('synthesizes culture route mounts from studio without registry entities', () => {
      expect(resolveCultureRouteMount(cultureConfig, 'ir')?.id).toBe('ir');
      expect(resolveCultureRouteMount(cultureConfig, 'ir')?.pathPrefix).toBe('/ir');
      expect(resolveCultureRouteMount(cultureConfig, 'missing')).toBeUndefined();
      expect(getMountById(cultureConfig, 'us')?.designerRoutePropagation).toBe('auto');
    });

    it('inherits studio designer shell rules for culture route ids', () => {
      const config: PlatformRuntimeConfig = {
        ...cultureConfig,
        shellRules: [
          {
            id: 1,
            mountId: 'studio',
            pathPrefix: '/studio/client-components',
            shellKey: 'designer',
            priority: 10,
            enabled: true,
          },
        ],
      };

      expect(resolveShellRuleForPath(config, 'ir', '/ir/studio/client-components')?.shellKey).toBe('designer');
    });

    it('still classifies legacy registry culture mounts when present', () => {
      const legacyConfig: PlatformRuntimeConfig = {
        ...cultureConfig,
        mounts: [
          ...cultureConfig.mounts,
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
        ],
      };

      const irMount = getMountById(legacyConfig, 'ir')!;
      expect(isCultureExperienceMount(irMount)).toBe(true);
      expect(getNonCultureEnabledMounts(legacyConfig).map((mount) => mount.id)).toEqual(['studio']);
    });

    it('ignores disabled culture pack ids when resolving culture routes', () => {
      bootstrapCultureRegistry(['us']);

      expect(isCultureRouteId('ir')).toBe(false);
      expect(resolveCultureRouteMount(cultureConfig, 'ir')).toBeUndefined();
      expect(getNonCultureEnabledMounts(cultureConfig).map((mount) => mount.id)).toEqual(['studio']);
    });
  });

  it('lands catalog splat pages on their default section', () => {
    expect(withNavLandingPath('base-components')).toBe('base-components/crud-set');
    expect(withNavLandingPath('studio/base-components')).toBe('studio/base-components/crud-set');
    expect(withNavLandingPath('base-components/toolbar')).toBe('base-components/toolbar');
    expect(withNavLandingPath('settings')).toBe('settings/server-functions');
    expect(withNavLandingPath('studio/settings')).toBe('studio/settings/server-functions');
    expect(withNavLandingPath('settings/pwa')).toBe('settings/pwa');
    expect(withNavLandingPath('cms/settings')).toBe('cms/settings');
    expect(withNavLandingPath('studio/cms/settings')).toBe('studio/cms/settings');
    expect(withNavLandingPath('users')).toBe('users');

    expect(buildBindingNavAbsolutePath('/studio', {
      id: 24,
      mountId: 'studio',
      routePattern: 'base-components/*',
      pageKey: 'base-components',
      enabled: true,
    })).toBe('/studio/base-components/crud-set');

    expect(buildBindingNavAbsolutePath('/studio', {
      id: 7,
      mountId: 'studio',
      routePattern: 'settings/*',
      pageKey: 'settings',
      enabled: true,
    })).toBe('/studio/settings/server-functions');

    expect(pathnameMatchesBindingNavPath('/studio/base-components/toolbar', '/studio/base-components/crud-set')).toBe(true);
    expect(pathnameMatchesBindingNavPath('/studio/base-components/dialog', '/studio/base-components/crud-set')).toBe(true);
    expect(pathnameMatchesBindingNavPath('/studio/base-components', '/studio/base-components/crud-set')).toBe(true);
    expect(pathnameMatchesBindingNavPath('/studio/users', '/studio/base-components/crud-set')).toBe(false);
    expect(pathnameMatchesBindingNavPath('/studio/settings/pwa', '/studio/settings/server-functions')).toBe(true);
    expect(pathnameMatchesBindingNavPath('/studio/settings', '/studio/settings/server-functions')).toBe(true);
  });

  it('resolveRegistryShellForPortal prefers portal segment over designer layout shellKey', () => {
    const config: PlatformRuntimeConfig = {
      ...sampleConfig,
      shells: [
        {
          shellKey: 'hawiety',
          name: 'Hawiety',
          entry: 'designer:portal-layouts/studio-shell',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          navigationRef: 'hawiety',
        },
        {
          shellKey: 'studio-shell',
          name: 'Studio Shell',
          entry: 'designer:shells/studio-shell',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          navigationRef: 'studio',
        },
      ],
    };

    const shell = resolveRegistryShellForPortal(config, {
      portalSegment: 'hawiety',
      shellKey: 'studio-shell',
    });

    expect(shell?.shellKey).toBe('hawiety');
    expect(shell?.navigationRef).toBe('hawiety');
  });

  it('resolveExperiencePortalNavigationRef overrides studio layout nav on experience portals', () => {
    const hawietyShell = {
      shellKey: 'hawiety',
      name: 'Hawiety',
      entry: 'designer:portal-layouts/studio-shell',
      surface: 'studio' as const,
      enabled: true,
      entryMode: 'shell' as const,
      navigationRef: 'hawiety',
    };

    expect(resolveExperiencePortalNavigationRef(
      { portalSegment: 'hawiety', shellKey: 'studio-shell' },
      hawietyShell,
      'studio',
    )).toBe('hawiety');

    expect(resolveExperiencePortalNavigationRef(
      { portalSegment: 'studio', shellKey: 'studio-shell' },
      { ...hawietyShell, shellKey: 'studio', navigationRef: 'studio' },
      'studio',
    )).toBe('studio');

    expect(resolveExperiencePortalNavigationRef(
      { portalSegment: 'hawiety', shellKey: 'studio-shell' },
      hawietyShell,
      '',
    )).toBe('hawiety');
  });
});
