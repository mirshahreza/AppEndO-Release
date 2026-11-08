import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTranslationRuntime,
  setTranslationDevWarningsEnabled,
} from '../../../core/culture/TranslationRuntime';
import usBundle from '../../../core/system-extensions/culture-packs/us/bundle';
import irBundle from '../../../core/system-extensions/culture-packs/ir/bundle';
import { buildAdminShellNav } from '../buildAdminShellNav';
import { translateAdminShellNav } from '../translateAdminShellNav';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

const STUDIO_MOUNT_PREFIX = '/studio';

function buildStudioConfig(bindings: PlatformRuntimeConfig['bindings']): PlatformRuntimeConfig {
  return {
    version: 'test-v1',
    mounts: [
      {
        id: 'studio',
        pathPrefix: STUDIO_MOUNT_PREFIX,
        name: 'Studio',
        enabled: true,
        defaultRoute: STUDIO_MOUNT_PREFIX,
        designerRoutePropagation: 'none',
        authProfile: {},
      },
    ],
    shells: [],
    shellRules: [],
    pageModules: [],
    bindings,
    navigations: [],
  };
}

describe('translateAdminShellNav', () => {
  afterEach(() => {
    setTranslationDevWarningsEnabled(false);
    vi.restoreAllMocks();
  });
  it('translates nav labels and group headings via culture keys', () => {
    const config = buildStudioConfig([
      {
        id: 1,
        mountId: 'studio',
        routePattern: '',
        pageKey: 'dashboard',
        enabled: true,
        nav: {
          label: 'Dashboard',
          icon: 'LayoutDashboard',
          description: 'System overview and core metrics tracking.',
          color: 'text-indigo-500',
        },
      },
      {
        id: 2,
        mountId: 'studio',
        routePattern: 'users',
        pageKey: 'users',
        enabled: true,
        nav: {
          label: 'Users',
          icon: 'Users',
          description: 'Create, update and manage user accounts and credentials.',
          group: 'Records',
          color: 'text-indigo-500',
        },
      },
    ]);

    const nav = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const { t } = createTranslationRuntime(irBundle, usBundle);
    const translated = translateAdminShellNav(nav, t);
    const usersGroup = translated.find((group) => group.heading === 'Records');
    expect(usersGroup).toBeTruthy();

    const dashboard = translated
      .flatMap((group) => group.items)
      .find((item) => item.pageKey === 'dashboard');
    expect(dashboard?.label).toBe('Home');
    expect(dashboard?.description).toContain('overview');
  });

  it('falls back to manifest label when a culture nav key is missing', () => {
    const config = buildStudioConfig([
      {
        id: 99,
        mountId: 'studio',
        routePattern: 'future-feature',
        pageKey: 'future-feature',
        enabled: true,
        nav: {
          label: 'Future Feature',
          icon: 'Sparkles',
          description: 'Not yet localized.',
          group: 'Operations',
          color: 'text-cyan-600',
        },
      },
    ]);

    const nav = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const { t } = createTranslationRuntime({}, usBundle);
    const translated = translateAdminShellNav(nav, t);
    const item = translated
      .flatMap((group) => group.items)
      .find((entry) => entry.pageKey === 'future-feature');

    expect(item?.label).toBe('Future Feature');
    expect(item?.description).toBe('Not yet localized.');
  });

  it('does not warn when falling back to the manifest nav label', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTranslationDevWarningsEnabled(true);

    const config = buildStudioConfig([
      {
        id: 99,
        mountId: 'studio',
        routePattern: 'designer-scratch-page',
        pageKey: 'designer-scratch-page',
        enabled: true,
        nav: {
          label: 'Scratch Page',
          icon: 'Sparkles',
          description: 'A designer page without a culture key.',
          group: 'CMS',
          color: 'text-sky-600',
        },
      },
    ]);

    const nav = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const { t } = createTranslationRuntime({}, {});
    const translated = translateAdminShellNav(nav, t);
    const item = translated
      .flatMap((group) => group.items)
      .find((entry) => entry.pageKey === 'designer-scratch-page');

    expect(item?.label).toBe('Scratch Page');
    expect(item?.description).toBe('A designer page without a culture key.');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
