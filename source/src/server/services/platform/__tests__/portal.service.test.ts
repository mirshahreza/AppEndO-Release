import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  defaultHomePortal,
  defaultStudioPortal,
} from '../../../../shared/api/contracts/platform/experienceManifest';

vi.mock('../../../domain/platform', () => ({
  findPlatformShellByKey: vi.fn(),
  updatePlatformShell: vi.fn(async () => undefined),
  listPlatformShellRows: vi.fn(() => []),
  insertPlatformShell: vi.fn(),
  deletePlatformShell: vi.fn(),
}));

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  readNavigationFile: vi.fn(() => null),
  writeNavigationFile: vi.fn(),
  deleteNavigationFile: vi.fn(),
  listNavigationFiles: vi.fn(() => []),
  listRouteBindingFiles: vi.fn(() => []),
  deleteRouteBindingFile: vi.fn(),
  deletePageModuleFile: vi.fn(),
}));

vi.mock('../platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(async () => undefined),
}));

vi.mock('../experienceManifest.service', () => ({
  getDefaultExperienceManifestService: vi.fn(),
}));

import { findPlatformShellByKey, updatePlatformShell, listPlatformShellRows, deletePlatformShell } from '../../../domain/platform';
import {
  listRouteBindingFiles,
  deleteRouteBindingFile,
  deletePageModuleFile,
} from '../../../../core/platform-registry/PlatformRegistryFileStore';
import { updatePortal, deletePortal, appendDesignerPageToPortalMenu } from '../portal.service';
import { HOME_SHELL_KEY, BUILT_IN_SITE_SHELL_ENTRY } from '../../../../shared/api/contracts/platform/mountConstants';
import { EXPERIENCE_MANIFEST_SOURCE } from '../../../../shared/api/contracts/platform/experienceManifest';
import { getDefaultExperienceManifestService } from '../experienceManifest.service';

describe('portal.service updatePortal', () => {
  beforeEach(() => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === HOME_SHELL_KEY) {
        return {
          shellKey: HOME_SHELL_KEY,
          name: 'Home',
          entry: '',
          surface: 'home',
          enabled: true,
          entryMode: 'redirect',
          redirectToSegment: 'studio',
          redirectToCulture: 'us',
          navigationRef: null,
          auth: null,
          source: 'experience-manifest',
        };
      }

      return null;
    });
    vi.mocked(updatePlatformShell).mockClear();
  });

  it('updates built-in home portal without duplicate segment validation error', async () => {
    const homePortal = {
      ...defaultHomePortal(),
      name: 'Landing',
    };

    const updated = await updatePortal('home', homePortal, { userId: 1, username: 'tester' });

    expect(updated.name).toBe('Landing');
    expect(updatePlatformShell).toHaveBeenCalledWith(
      HOME_SHELL_KEY,
      expect.objectContaining({ name: 'Landing' }),
      expect.anything(),
    );
  });

  it('persists home layout as the public SiteLayout when the operator assigns it', async () => {
    const homePortal = {
      ...defaultHomePortal(),
      entryMode: 'shell' as const,
      redirectToSegment: null,
      redirectToCulture: null,
      shellKey: 'site',
    };

    await updatePortal('home', homePortal, { userId: 1, username: 'tester' });

    expect(updatePlatformShell).toHaveBeenCalledWith(
      HOME_SHELL_KEY,
      expect.objectContaining({
        entry: BUILT_IN_SITE_SHELL_ENTRY,
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
      }),
      expect.anything(),
    );
  });

  it('persists home layout as a designer shell when the operator picks a draft', async () => {
    const homePortal = {
      ...defaultHomePortal(),
      entryMode: 'shell' as const,
      redirectToSegment: null,
      redirectToCulture: null,
      shellKey: 'landing-shell',
    };

    await updatePortal('home', homePortal, { userId: 1, username: 'tester' });

    expect(updatePlatformShell).toHaveBeenCalledWith(
      HOME_SHELL_KEY,
      expect.objectContaining({
        entry: 'designer:portal-layouts/landing-shell',
        entryMode: 'shell',
      }),
      expect.anything(),
    );
  });

  it('updates built-in studio portal without duplicate segment validation error', async () => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === 'studio') {
        return {
          shellKey: 'studio',
          name: 'Studio',
          entry: 'core:AdminLayout',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          navigationRef: 'studio',
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          source: 'experience-manifest',
        };
      }

      return null;
    });

    const studioPortal = {
      ...defaultStudioPortal(),
      name: 'Admin Studio',
    };

    const updated = await updatePortal('studio', studioPortal, { userId: 1, username: 'tester' });

    expect(updated.name).toBe('Admin Studio');
    expect(updatePlatformShell).toHaveBeenCalledWith(
      'studio',
      expect.objectContaining({ name: 'Admin Studio' }),
      expect.anything(),
    );
  });

  it('persists public portal access as a cleared auth payload', async () => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === 'my-portal') {
        return {
          shellKey: 'my-portal',
          name: 'My Portal',
          entry: 'designer:portal-layouts/my-portal',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          navigationRef: 'my-portal',
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          source: EXPERIENCE_MANIFEST_SOURCE,
        };
      }

      return null;
    });

    await updatePortal('my-portal', {
      segment: 'my-portal',
      name: 'My Portal',
      shellKey: 'my-portal',
      entryMode: 'shell',
      enabled: true,
      auth: null,
      pages: [],
    }, { userId: 1, username: 'tester' });

    expect(updatePlatformShell).toHaveBeenCalledWith(
      'my-portal',
      expect.objectContaining({ auth: null }),
      expect.anything(),
    );
  });

  it('persists specific portal access lists', async () => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === 'my-portal') {
        return {
          shellKey: 'my-portal',
          name: 'My Portal',
          entry: 'designer:portal-layouts/my-portal',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          navigationRef: 'my-portal',
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          source: EXPERIENCE_MANIFEST_SOURCE,
        };
      }

      return null;
    });

    const specificAuth = {
      accessMode: 'specific' as const,
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    };

    await updatePortal('my-portal', {
      segment: 'my-portal',
      name: 'My Portal',
      shellKey: 'my-portal',
      entryMode: 'shell',
      enabled: true,
      auth: specificAuth,
      pages: [],
    }, { userId: 1, username: 'tester' });

    expect(updatePlatformShell).toHaveBeenCalledWith(
      'my-portal',
      expect.objectContaining({ auth: specificAuth }),
      expect.anything(),
    );
  });

  it('persists portal identity on the shell', async () => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === 'my-portal') {
        return {
          shellKey: 'my-portal',
          name: 'My Portal',
          entry: 'designer:portal-layouts/my-portal',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          navigationRef: 'my-portal',
          brand: null,
          source: EXPERIENCE_MANIFEST_SOURCE,
        };
      }

      return null;
    });

    await updatePortal('my-portal', {
      segment: 'my-portal',
      name: 'My Portal',
      shellKey: 'my-portal',
      entryMode: 'shell',
      enabled: true,
      brand: {
        title: 'Harbor',
        aboutTitle: 'About Harbor',
        aboutBody: 'A storefront',
      },
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [],
    }, { userId: 1, username: 'tester' });

    expect(updatePlatformShell).toHaveBeenCalledWith(
      'my-portal',
      expect.objectContaining({
        brand: expect.objectContaining({
          title: 'Harbor',
          aboutTitle: 'About Harbor',
          aboutBody: 'A storefront',
        }),
      }),
      expect.anything(),
    );
  });
});

describe('portal.service deletePortal', () => {
  beforeEach(() => {
    vi.mocked(deletePlatformShell).mockClear();
    vi.mocked(listPlatformShellRows).mockReset();
    vi.mocked(listRouteBindingFiles).mockReturnValue([]);
    vi.mocked(deleteRouteBindingFile).mockClear();
    vi.mocked(deletePageModuleFile).mockClear();
  });

  it('deletes portal by registry key segment', async () => {
    vi.mocked(findPlatformShellByKey).mockImplementation(async (shellKey: string) => {
      if (shellKey === 'my-app') {
        return {
          shellKey: 'my-app',
          name: 'My App',
          entry: 'designer:my-app',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          navigationRef: 'mys-navs',
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          source: EXPERIENCE_MANIFEST_SOURCE,
        };
      }

      return undefined;
    });

    await deletePortal('my-app', { userId: 1, username: 'tester' });

    expect(deletePlatformShell).toHaveBeenCalledWith('my-app');
  });

  it('treats a missing portal as already deleted', async () => {
    vi.mocked(findPlatformShellByKey).mockResolvedValue(undefined);
    vi.mocked(listPlatformShellRows).mockResolvedValue([]);

    await expect(deletePortal('site', { userId: 1, username: 'tester' })).resolves.toBeUndefined();

    expect(deletePlatformShell).toHaveBeenCalledWith('site');
  });

  it('removes leftover site route bindings and CMS page modules', async () => {
    vi.mocked(findPlatformShellByKey).mockResolvedValue(undefined);
    vi.mocked(listPlatformShellRows).mockResolvedValue([]);
    vi.mocked(listRouteBindingFiles).mockReturnValue([
      {
        id: 60,
        mountId: 'studio',
        routePattern: 'site',
        pageKey: 'cms-site-home',
        enabled: true,
      },
      {
        id: 61,
        mountId: 'studio',
        routePattern: 'site/stories/*',
        pageKey: 'cms-site-article',
        enabled: true,
      },
      {
        id: 1,
        mountId: 'studio',
        routePattern: 'users',
        pageKey: 'users',
        enabled: true,
      },
    ]);

    await deletePortal('site', { userId: 1, username: 'tester' });

    expect(deleteRouteBindingFile).toHaveBeenCalledWith(60);
    expect(deleteRouteBindingFile).toHaveBeenCalledWith(61);
    expect(deleteRouteBindingFile).not.toHaveBeenCalledWith(1);
    expect(deletePageModuleFile).toHaveBeenCalledWith('cms-site-home');
    expect(deletePageModuleFile).toHaveBeenCalledWith('cms-site-article');
  });

  it('deletes portal when client passes primary navigation id instead of segment', async () => {
    vi.mocked(findPlatformShellByKey).mockResolvedValue(undefined);
    vi.mocked(listPlatformShellRows).mockResolvedValue([
      {
        shellKey: 'my-app',
        name: 'My App',
        entry: 'designer:my-app',
        surface: 'studio',
        enabled: true,
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
        navigationRef: 'mys-navs',
        auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
    ]);

    await deletePortal('mys-navs', { userId: 1, username: 'tester' });

    expect(deletePlatformShell).toHaveBeenCalledWith('my-app');
  });
});

describe('portal.service appendDesignerPageToPortalMenu', () => {
  const compileManifest = vi.fn();

  beforeEach(() => {
    compileManifest.mockReset();
    vi.mocked(getDefaultExperienceManifestService).mockReturnValue({
      getManifest: async () => ({
        manifest: {
          id: 'admin',
          cultureId: 'us',
          portals: [
            defaultHomePortal(),
            {
              ...defaultStudioPortal(),
              pages: [],
            },
            {
              segment: 'partner',
              name: 'Partner',
              shellKey: 'partner',
              entryMode: 'shell',
              enabled: true,
              pages: [],
            },
          ],
        },
      }),
      compileManifest,
    } as never);
  });

  it('normalizes folder/name identity to experience pageKey + designer loaderRef', async () => {
    compileManifest.mockImplementation(async (_actor: unknown, nextManifest: {
      portals: Array<{ segment: string; pages: Array<{ pageKey: string; loaderRef?: string; path: string }> }>;
    }) => ({
      ok: true as const,
      manifest: nextManifest,
    }));

    const portal = await appendDesignerPageToPortalMenu(
      'studio',
      {
        pageKey: 'general/reports-board',
        navLabel: 'Reports',
        path: 'general/reports-board/',
      },
      { userId: 1, username: 'tester' },
    );

    expect(portal.pages).toEqual([
      expect.objectContaining({
        pageKey: 'reports-board',
        loaderRef: 'general/reports-board',
        path: 'general/reports-board/',
        nav: { label: 'Reports' },
      }),
    ]);
    expect(compileManifest).toHaveBeenCalled();
  });

  it('rejects invalid pageKey slugs after normalization', async () => {
    await expect(
      appendDesignerPageToPortalMenu(
        'studio',
        { pageKey: 'Bad_Key', navLabel: 'Bad' },
        { userId: 1, username: 'tester' },
      ),
    ).rejects.toThrow(/must match/);
    expect(compileManifest).not.toHaveBeenCalled();
  });

  it('accepts an already-normalized pageKey with designer loaderRef', async () => {
    compileManifest.mockImplementation(async (_actor: unknown, nextManifest: {
      portals: Array<{ segment: string; pages: Array<{ pageKey: string; loaderRef?: string; path: string }> }>;
    }) => ({
      ok: true as const,
      manifest: nextManifest,
    }));

    const portal = await appendDesignerPageToPortalMenu(
      'studio',
      {
        pageKey: 'previewbug',
        loaderRef: 'bug/previewbug',
        navLabel: 'previewbug',
        path: 'bug/previewbug/',
      },
      { userId: 1, username: 'tester' },
    );

    expect(portal.pages).toEqual([
      expect.objectContaining({
        pageKey: 'previewbug',
        loaderRef: 'bug/previewbug',
        path: 'bug/previewbug/',
        nav: { label: 'previewbug' },
      }),
    ]);
  });

  it('keeps built-in page keys without inventing a designer loaderRef', async () => {
    compileManifest.mockImplementation(async (_actor: unknown, nextManifest: {
      portals: Array<{ segment: string; pages: Array<{ pageKey: string; loaderRef?: string }> }>;
    }) => ({
      ok: true as const,
      manifest: nextManifest,
    }));

    const portal = await appendDesignerPageToPortalMenu(
      'partner',
      { pageKey: 'dashboard', navLabel: 'Dashboard', path: 'dashboard/' },
      { userId: 1, username: 'tester' },
    );

    expect(portal.pages[0]).toEqual(
      expect.objectContaining({
        pageKey: 'dashboard',
        path: 'dashboard/',
        nav: { label: 'Dashboard' },
      }),
    );
    expect(portal.pages[0]?.loaderRef).toBeUndefined();
  });
});
