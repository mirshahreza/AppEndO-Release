import { describe, expect, it } from 'vitest';
import type { PlatformPageModule } from '../../../shared/api/contracts/platform/types';
import jobsPageModule from '../../../config/platform-registry/page-modules/jobs.json';
import scheduledTasksPageModule from '../../../config/platform-registry/page-modules/scheduled-tasks.json';
import usersPageModule from '../../../config/platform-registry/page-modules/users.json';
import {
  buildHomeWidgetRegistry,
  filterHomeWidgetRegistryForUser,
} from '../homeWidgetRegistry';

const adminUser = { id: 1, username: 'admin', roles: ['ADMIN'] };
const standardUser = { id: 2, username: 'user', roles: ['USER'] };

describe('homeWidgetRegistry', () => {
  it('merges platform, module metadata, and package bindings', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [usersPageModule as PlatformPageModule],
      packageBindings: [{ packageId: 'ref-hello-widget', componentKey: 'hello-widget', order: 1 }],
    });

    expect(registry.some((entry) => entry.layoutId === 'kpi')).toBe(true);
    expect(registry.some((entry) => entry.layoutId === 'module:users')).toBe(true);
    expect(registry.some((entry) => entry.layoutId === 'package:ref-hello-widget:hello-widget')).toBe(true);
  });

  it('does not register removed module Home widgets', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [
        { pageKey: 'roles', title: 'Roles', loaderKind: 'core', loaderRef: 'core:Roles', enabled: true },
        { pageKey: 'workflows', title: 'Workflows', loaderKind: 'core', loaderRef: 'core:Workflows', enabled: true },
        { pageKey: 'file-manager', title: 'Files', loaderKind: 'core', loaderRef: 'core:FileManager', enabled: true },
        { pageKey: 'chat-history', title: 'Chat', loaderKind: 'core', loaderRef: 'core:ChatHistory', enabled: true },
      ],
      packageBindings: [],
    });

    expect(registry.some((e) => e.layoutId === 'module:roles')).toBe(false);
    expect(registry.some((e) => e.layoutId === 'module:workflows:running')).toBe(false);
    expect(registry.some((e) => e.layoutId === 'module:file-manager')).toBe(false);
    expect(registry.some((e) => e.layoutId === 'module:chat-history')).toBe(false);
  });

  it('marks optional Home widgets off by default', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [
        jobsPageModule as PlatformPageModule,
        scheduledTasksPageModule as PlatformPageModule,
      ],
      packageBindings: [],
    });

    expect(registry.find((e) => e.layoutId === 'module:jobs')?.defaultVisible).toBe(false);
    expect(registry.find((e) => e.layoutId === 'module:scheduled-tasks')?.defaultVisible).toBe(false);
  });

  it('registers CMS review queue widget from page module seeds', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [
        {
          pageKey: 'cms-contents-list',
          title: 'Contents',
          loaderKind: 'designer',
          loaderRef: 'general/cms-contents-list@v1',
          enabled: true,
        },
      ],
      packageBindings: [],
    });

    const entry = registry.find((item) => item.layoutId === 'module:cms-contents-list:review-queue');
    expect(entry?.componentRef).toBe('core:CmsReviewQueueHomeWidget');
    expect(entry?.deepLink.pageKey).toBe('cms-contents-list');
    expect(entry?.defaultVisible).toBe(false);
  });

  it('registers Remote Hubs module widgets when page modules are enabled', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [
        { pageKey: 'ssh-hub', title: 'SSH', loaderKind: 'core', loaderRef: 'core:SshHub', enabled: true },
        { pageKey: 'file-hub', title: 'Sftp', loaderKind: 'core', loaderRef: 'core:FileHub', enabled: true },
        { pageKey: 'rdp-hub', title: 'RDP', loaderKind: 'core', loaderRef: 'core:RdpHub', enabled: true },
      ],
      packageBindings: [],
    });

    expect(registry.find((e) => e.layoutId === 'module:ssh-hub')?.componentRef).toBe('core:SshHubHomeWidget');
    expect(registry.find((e) => e.layoutId === 'module:file-hub')?.defaultVisible).toBe(false);
    expect(registry.find((e) => e.layoutId === 'module:rdp-hub')?.deepLink.pageKey).toBe('rdp-hub');
  });

  it('hides admin-only module widgets from non-admin users', () => {
    const pageModules = [usersPageModule as PlatformPageModule];
    const registry = buildHomeWidgetRegistry({ pageModules, packageBindings: [] });

    const forAdmin = filterHomeWidgetRegistryForUser(registry, adminUser, pageModules);
    const forUser = filterHomeWidgetRegistryForUser(registry, standardUser, pageModules);

    expect(forAdmin.some((entry) => entry.layoutId === 'module:users')).toBe(true);
    expect(forUser.some((entry) => entry.layoutId === 'module:users')).toBe(false);
    expect(forUser.some((entry) => entry.layoutId === 'kpi')).toBe(false);
  });

  it('keeps package widgets for any signed-in user', () => {
    const registry = buildHomeWidgetRegistry({
      pageModules: [],
      packageBindings: [{ packageId: 'ref-hello-widget', componentKey: 'hello-widget', order: 1 }],
    });

    const forUser = filterHomeWidgetRegistryForUser(registry, standardUser, []);
    expect(forUser.some((entry) => entry.layoutId === 'package:ref-hello-widget:hello-widget')).toBe(true);
  });
});
