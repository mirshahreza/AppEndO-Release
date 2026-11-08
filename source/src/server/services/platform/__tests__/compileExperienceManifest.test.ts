import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PlatformRouteBinding, PlatformShell } from '../../../../shared/api/contracts/platform/types';
import type { ExperienceManifest } from '../../../../shared/api/contracts/platform/experienceManifest';
import { EXPERIENCE_MANIFEST_SOURCE, defaultHomePortal } from '../../../../shared/api/contracts/platform/experienceManifest';
import { STUDIO_MOUNT_ID } from '../../../../shared/api/contracts/platform/mountConstants';

const shellRows: PlatformShell[] = [];
const bindingRows: PlatformRouteBinding[] = [];
const pageModuleRows: Array<{
  pageKey: string;
  title: string;
  loaderKind: string;
  loaderRef: string;
  defaultRoles: string[] | null;
  enabled: boolean;
}> = [];
let nextBindingId = 100;

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listNavigationFiles: () => [],
  readNavigationFile: () => undefined,
  writeNavigationFile: vi.fn(),
}));

vi.mock('../../../domain/platform', () => ({
  listPlatformShellRows: async () => shellRows,
  listPlatformRouteBindingRows: async () => bindingRows,
  listPlatformPageModuleRows: async () => pageModuleRows,
  findLatestPlatformRouteBindingId: async (mountId: string, routePattern: string) => {
    const match = [...bindingRows]
      .reverse()
      .find((binding) => binding.mountId === mountId && binding.routePattern === routePattern);
    return match ? { id: match.id } : null;
  },
  insertPlatformRouteBinding: async (input: {
    mountId: string;
    routePattern: string;
    pageKey: string;
    enabled: boolean;
    source?: string | null;
  }) => {
    const id = nextBindingId++;
    bindingRows.push({
      id,
      mountId: input.mountId,
      routePattern: input.routePattern,
      pageKey: input.pageKey,
      enabled: input.enabled,
      auth: null,
      nav: null,
      source: input.source ?? null,
    });
  },
  updatePlatformRouteBinding: async (
    id: number,
    input: { routePattern: string; pageKey: string; enabled: boolean; source?: string | null },
  ) => {
    const binding = bindingRows.find((row) => row.id === id);
    if (!binding) throw new Error('missing');
    binding.routePattern = input.routePattern;
    binding.pageKey = input.pageKey;
    binding.enabled = input.enabled;
    binding.source = input.source ?? binding.source;
  },
  deletePlatformRouteBinding: async (id: number) => {
    const index = bindingRows.findIndex((row) => row.id === id);
    if (index >= 0) bindingRows.splice(index, 1);
  },
  insertPlatformPageModule: async () => undefined,
  updatePlatformPageModule: async () => undefined,
  updatePlatformShell: async (
    shellKey: string,
    input: {
      navigationRef?: string | null;
      source?: string | null;
      brand?: PlatformShell['brand'];
    },
  ) => {
    const shell = shellRows.find((row) => row.shellKey === shellKey);
    if (!shell) throw new Error('missing shell');
    shell.navigationRef = input.navigationRef ?? shell.navigationRef;
    shell.source = input.source ?? shell.source;
    if ('brand' in input) {
      shell.brand = input.brand;
    }
  },
  findPlatformMountById: async () => ({
    id: STUDIO_MOUNT_ID,
    pathPrefix: '/studio',
    name: 'Studio',
    enabled: true,
    defaultRoute: '/studio',
    designerRoutePropagation: 'none',
    authProfile: {},
  }),
  updatePlatformMount: vi.fn(async () => undefined),
}));

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../experienceRoutePropagation.service', () => ({
  propagateStudioRouteBinding: vi.fn(async () => []),
}));

import { writeNavigationFile } from '../../../../core/platform-registry/PlatformRegistryFileStore';
import {
  compileExperienceManifest,
  decompileExperienceManifest,
} from '../compileExperienceManifest';

const actor = { userId: 1, username: 'admin' };

describe('compileExperienceManifest', () => {
  beforeEach(() => {
    shellRows.length = 0;
    bindingRows.length = 0;
    pageModuleRows.length = 0;
    nextBindingId = 100;
    vi.mocked(writeNavigationFile).mockClear();

    shellRows.push({
      shellKey: 'home-shell',
      name: 'Home Redirect',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
      source: 'manual',
    });

    shellRows.push({
      shellKey: 'studio',
      name: 'Studio',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      navigationRef: 'studio',
      source: 'manual',
    });
  });

  it('compiles manifest routes to studio bindings and navigation file', async () => {
    const manifest: ExperienceManifest = {
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        {
          segment: 'studio',
          name: 'Studio',
          shellKey: 'studio',
          navigationRef: 'studio',
          enabled: true,
          pages: [
            {
              path: 'studio/users',
              pageKey: 'users',
              nav: { label: 'Users', icon: 'Users', group: 'Records', order: 1 },
            },
          ],
        },
      ],
    };

    const result = await compileExperienceManifest(manifest, actor);

    expect(result.shellKeys).toContain('studio');
    expect(result.navigationIds).toContain('studio');
    expect(bindingRows).toHaveLength(1);
    expect(bindingRows[0]).toMatchObject({
      mountId: STUDIO_MOUNT_ID,
      routePattern: 'users',
      pageKey: 'users',
      source: EXPERIENCE_MANIFEST_SOURCE,
    });
    expect(writeNavigationFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'studio', groups: expect.any(Array) }),
    );
  });

  it('removes stale experience-manifest bindings', async () => {
    bindingRows.push({
      id: 50,
      mountId: STUDIO_MOUNT_ID,
      routePattern: 'legacy',
      pageKey: 'legacy-page',
      enabled: true,
      auth: null,
      nav: null,
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest: ExperienceManifest = {
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        {
          segment: 'studio',
          name: 'Studio',
          shellKey: 'studio',
          navigationRef: 'studio',
          enabled: true,
          pages: [{ path: 'studio/dashboard', pageKey: 'dashboard' }],
        },
      ],
    };

    const result = await compileExperienceManifest(manifest, actor);

    expect(result.bindingsRemoved).toBe(1);
    expect(bindingRows.some((row) => row.pageKey === 'legacy-page')).toBe(false);
  });

  it('decompiles studio bindings into manifest applications', async () => {
    bindingRows.push({
      id: 1,
      mountId: STUDIO_MOUNT_ID,
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
      auth: null,
      nav: { label: 'Users' },
      source: 'manual',
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });

    expect(manifest).toMatchObject({
      id: 'admin',
      cultureId: 'us',
      portals: [
        expect.objectContaining({
          segment: 'home',
          shellKey: 'home-shell',
          entryMode: 'redirect',
          redirectToSegment: 'studio',
        }),
        {
          segment: 'studio',
          name: 'Studio',
          shellKey: 'studio',
          navigationRef: 'studio',
          pages: [{ path: 'studio/users', pageKey: 'users', nav: { label: 'Users' } }],
        },
        expect.objectContaining({
          segment: 'component-alone',
          name: 'Component Alone',
          shellKey: 'component-alone',
        }),
      ],
    });
    expect(manifest?.portals.some((portal) => portal.segment === 'site')).toBe(false);
  });

  it('decompiles a site portal only when the site shell exists on disk', async () => {
    shellRows.push({
      shellKey: 'site',
      name: 'Site',
      entry: 'core:SiteLayout',
      surface: 'site',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'site',
      source: 'manual',
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });

    expect(manifest?.portals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segment: 'site',
          name: 'Site',
          shellKey: 'site',
        }),
      ]),
    );
  });

  it('decompiles home shell navigation when root portal is not redirect', async () => {
    shellRows[0] = {
      ...shellRows[0]!,
      name: 'Home',
      entry: 'core:AdminLayout',
      entryMode: 'shell',
      redirectToSegment: null,
      redirectToCulture: null,
      navigationRef: 'home',
    };

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });

    expect(manifest?.portals[0]).toMatchObject({
      segment: 'home',
      shellKey: 'core:AdminLayout',
      entryMode: 'shell',
      navigationRef: 'home',
      navigations: ['home'],
    });
  });

  it('includes disabled experience-manifest shells in decompiled applications', async () => {
    shellRows.push({
      shellKey: 'my-portal',
      name: 'My Portal',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: false,
      entryMode: 'shell',
      navigationRef: 'my-portal',
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });

    expect(manifest?.portals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segment: 'my-portal',
          shellKey: 'core:AdminLayout',
          enabled: false,
        }),
      ]),
    );
  });

  it('keeps portal segment as shell registry key when navigationRef differs', async () => {
    shellRows.push({
      shellKey: 'my-app',
      name: 'My App',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'mys-navs',
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });

    expect(manifest?.portals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segment: 'my-app',
          navigationRef: 'mys-navs',
          navigations: ['mys-navs'],
        }),
      ]),
    );
  });

  it('decompiles explicit public portal auth as null instead of logged-in default', async () => {
    shellRows.push({
      shellKey: 'my-app',
      name: 'My App',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'my-app',
      auth: null,
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });
    const portal = manifest?.portals.find((item) => item.segment === 'my-app');

    expect(portal?.auth).toBeNull();
  });

  it('decompiles portal identity from the shell file', async () => {
    shellRows.push({
      shellKey: 'shop',
      name: 'Shop',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'shop',
      brand: {
        title: 'Harbor',
        aboutTitle: 'About Harbor',
        aboutBody: 'A storefront',
        logoUrl: '/assets/workspace/portals/shop/logo.png',
      },
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });
    const portal = manifest?.portals.find((item) => item.segment === 'shop');

    expect(portal?.brand).toEqual({
      title: 'Harbor',
      aboutTitle: 'About Harbor',
      aboutBody: 'A storefront',
      logoUrl: '/assets/workspace/portals/shop/logo.png',
    });
  });

  it('decompiles custom portal pages with portal-relative paths and dedupes duplicate bindings', async () => {
    shellRows.push({
      shellKey: 'hawiety',
      name: 'Hawiety',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'hawiety',
      source: EXPERIENCE_MANIFEST_SOURCE,
    });
    bindingRows.push(
      {
        id: 94,
        mountId: STUDIO_MOUNT_ID,
        routePattern: 'hawiety/members-all/view/*',
        pageKey: 'hwy-member-dossier-view',
        enabled: true,
        auth: null,
        nav: null,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      {
        id: 98,
        mountId: STUDIO_MOUNT_ID,
        routePattern: 'hawiety/members-all/edit/*',
        pageKey: 'hwy-member-dossier-edit',
        enabled: true,
        auth: null,
        nav: null,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
    );

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });
    const portal = manifest?.portals.find((item) => item.segment === 'hawiety');

    expect(portal?.pages).toEqual([
      {
        path: 'members-all/view/*',
        pageKey: 'hwy-member-dossier-view',
        auth: null,
        nav: null,
      },
      {
        path: 'members-all/edit/*',
        pageKey: 'hwy-member-dossier-edit',
        auth: null,
        nav: null,
      },
    ]);
  });

  it('decompiles specific portal access lists from the shell file', async () => {
    const specificAuth = {
      accessMode: 'specific' as const,
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    };
    shellRows.push({
      shellKey: 'my-app',
      name: 'My App',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      navigationRef: 'my-app',
      auth: specificAuth,
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest = await decompileExperienceManifest({ cultureId: 'us' });
    const portal = manifest?.portals.find((item) => item.segment === 'my-app');

    expect(portal?.auth).toEqual(specificAuth);
  });

  it('does not remove studio route bindings when compiling extension portals only', async () => {
    shellRows.push({
      shellKey: 'my-app',
      name: 'My App',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
      navigationRef: 'my-app',
      source: EXPERIENCE_MANIFEST_SOURCE,
    });
    bindingRows.push({
      id: 2,
      mountId: STUDIO_MOUNT_ID,
      routePattern: 'server-functions/*',
      pageKey: 'server-functions',
      enabled: true,
      auth: null,
      nav: null,
      source: EXPERIENCE_MANIFEST_SOURCE,
    });
    bindingRows.push({
      id: 3,
      mountId: STUDIO_MOUNT_ID,
      routePattern: 'client-components',
      pageKey: 'client-components',
      enabled: true,
      auth: null,
      nav: null,
      source: EXPERIENCE_MANIFEST_SOURCE,
    });

    const manifest: ExperienceManifest = {
      id: 'pkg-only',
      cultureId: 'us',
      portals: [
        {
          segment: 'my-app',
          name: 'My App',
          shellKey: 'my-app',
          enabled: true,
          pages: [{ path: 'my-app/home', pageKey: 'home' }],
        },
      ],
    };

    const result = await compileExperienceManifest(manifest, actor);

    expect(result.bindingsRemoved).toBe(0);
    expect(bindingRows.some((row) => row.pageKey === 'server-functions')).toBe(true);
    expect(bindingRows.some((row) => row.pageKey === 'client-components')).toBe(true);
  });
});
