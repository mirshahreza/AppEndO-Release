import { describe, expect, it, vi } from 'vitest';
import { isRemoteHubsPageKey } from '../../../../core/packages/remoteHubsPackage';

vi.mock('../../../domain/package-domain/installStateRepository', () => ({
  isPluginRuntimeEnabled: vi.fn(),
}));

import { isPluginRuntimeEnabled } from '../../../domain/package-domain/installStateRepository';
import {
  applyRemoteHubsChromeToBindings,
  applyRemoteHubsChromeToPageModules,
  ensureRemoteHubsNavigationIfInstalled,
  filterRemoteHubsHostRowsUnlessInstalled,
  filterRemoteHubsNavigationUnlessInstalled,
  isRemoteHubsRuntimeEnabled,
} from '../remoteHubsRuntime';

describe('Remote Hubs runtime gate', () => {
  it('recognizes the three hub page keys', () => {
    expect(isRemoteHubsPageKey('file-hub')).toBe(true);
    expect(isRemoteHubsPageKey('ssh-hub')).toBe(true);
    expect(isRemoteHubsPageKey('rdp-hub')).toBe(true);
    expect(isRemoteHubsPageKey('file-manager')).toBe(false);
    expect(isRemoteHubsPageKey('api-talk')).toBe(false);
  });

  it('hides hub rows when the package is not installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    expect(isRemoteHubsRuntimeEnabled()).toBe(false);
    const rows = [
      { pageKey: 'file-manager' },
      { pageKey: 'file-hub' },
      { pageKey: 'ssh-hub' },
      { pageKey: 'rdp-hub' },
      { pageKey: 'workflows' },
    ];
    expect(filterRemoteHubsHostRowsUnlessInstalled(rows).map((row) => row.pageKey)).toEqual([
      'file-manager',
      'workflows',
    ]);
  });

  it('keeps hub rows when the package is installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    expect(isRemoteHubsRuntimeEnabled()).toBe(true);
    const rows = [{ pageKey: 'file-hub' }, { pageKey: 'file-manager' }];
    expect(filterRemoteHubsHostRowsUnlessInstalled(rows)).toEqual(rows);
  });

  it('strips leftover Remote Hubs nav groups when the package is not installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    const filtered = filterRemoteHubsNavigationUnlessInstalled({
      id: 'studio',
      groups: [
        {
          heading: 'Operations',
          items: [
            { pageKey: 'file-manager' },
            { pageKey: 'ssh-hub' },
          ],
        },
        {
          heading: 'Remote Hubs',
          items: [
            { pageKey: 'file-hub' },
            { pageKey: 'rdp-hub' },
          ],
        },
        {
          heading: 'Records',
          items: [{ pageKey: 'users' }],
        },
      ],
    });
    expect(filtered.groups.map((group) => group.heading)).toEqual(['Operations', 'Records']);
    expect(filtered.groups[0]?.items.map((item) => item.pageKey)).toEqual(['file-manager']);
  });

  it('does not strip non-hub leftovers in a Remote Hubs group', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    const filtered = filterRemoteHubsNavigationUnlessInstalled({
      id: 'studio',
      groups: [
        {
          heading: 'Remote Hubs',
          items: [
            { pageKey: 'api-talk' },
            { pageKey: 'file-hub' },
            { pageKey: 'ssh-hub' },
            { pageKey: 'rdp-hub' },
          ],
        },
      ],
    });
    expect(filtered.groups.map((group) => group.heading)).toEqual(['Remote Hubs']);
    expect(filtered.groups[0]?.items.map((item) => item.pageKey)).toEqual(['api-talk']);
  });

  it('restores the Studio Remote Hubs group when the package is installed but the manifest omitted it', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    const restored = ensureRemoteHubsNavigationIfInstalled({
      id: 'studio',
      groups: [
        { heading: 'Operations', order: 3, items: [{ pageKey: 'file-manager' }] },
        { heading: 'Records', order: 5, items: [{ pageKey: 'users' }] },
      ],
    });
    expect(restored.groups.map((group) => group.heading)).toEqual([
      'Operations',
      'Records',
      'Remote Hubs',
    ]);
    expect(restored.groups[2]?.items.map((item) => item.pageKey)).toEqual([
      'ssh-hub',
      'file-hub',
      'rdp-hub',
    ]);
  });

  it('relabels existing hub items from the recipe when the package is installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    const restored = ensureRemoteHubsNavigationIfInstalled({
      id: 'studio',
      groups: [
        {
          heading: 'Remote Hubs',
          order: 4,
          items: [
            { pageKey: 'file-hub', label: 'File Hub' },
            { pageKey: 'ssh-hub', label: 'SSH Hub' },
            { pageKey: 'rdp-hub', label: 'RDP Hub' },
          ],
        },
      ],
    });
    expect(restored.groups[0]?.items.map((item) => item.label)).toEqual(['SSH', 'Sftp', 'RDP']);
    expect(restored.groups[0]?.items.map((item) => item.routePattern)).toEqual(['ssh/*', 'sftp/*', 'rdp/*']);
    expect(restored.groups[0]?.items.find((item) => item.pageKey === 'rdp-hub')?.separatorBefore).toBe(true);
  });

  it('moves leftover hub items into the restored Remote Hubs group', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    const restored = ensureRemoteHubsNavigationIfInstalled({
      id: 'studio',
      groups: [
        {
          heading: 'Operations',
          order: 3,
          items: [
            { pageKey: 'file-manager' },
            { pageKey: 'file-hub' },
          ],
        },
        { heading: 'Records', order: 5, items: [{ pageKey: 'users' }] },
      ],
    });
    expect(restored.groups[0]?.items.map((item) => item.pageKey)).toEqual(['file-manager']);
    expect(restored.groups.map((group) => group.heading)).toEqual([
      'Operations',
      'Records',
      'Remote Hubs',
    ]);
    expect(restored.groups[2]?.items.map((item) => item.pageKey)).toEqual([
      'ssh-hub',
      'file-hub',
      'rdp-hub',
    ]);
  });

  it('does not invent a Remote Hubs group when the package is not installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    const manifest = {
      id: 'studio',
      groups: [{ heading: 'Operations', order: 3, items: [{ pageKey: 'file-manager' }] }],
    };
    expect(ensureRemoteHubsNavigationIfInstalled(manifest)).toEqual(manifest);
  });

  it('does not inject Remote Hubs into non-Studio portal navigations', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    const manifest = {
      id: 'hawiety',
      groups: [
        { heading: 'System management', order: 2, items: [{ pageKey: 'hwy-institutes' }] },
      ],
    };
    expect(ensureRemoteHubsNavigationIfInstalled(manifest)).toEqual(manifest);
  });

  it('rewrites stale hub page titles and route bindings to Sftp / SSH / RDP chrome', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    expect(applyRemoteHubsChromeToPageModules([
      { pageKey: 'ssh-hub', title: 'Ssh Hub' },
      { pageKey: 'file-manager', title: 'File Manager' },
    ])).toEqual([
      { pageKey: 'ssh-hub', title: 'SSH' },
      { pageKey: 'file-manager', title: 'File Manager' },
    ]);

    const bindings = applyRemoteHubsChromeToBindings([
      {
        mountId: 'studio',
        pageKey: 'ssh-hub',
        routePattern: 'ssh-hub/*',
        nav: { label: 'SSH Hub', group: 'Plugins', icon: 'Puzzle' },
      },
      {
        mountId: 'studio',
        pageKey: 'file-hub',
        routePattern: 'file-hub/*',
        nav: { label: 'File Hub', group: 'Plugins' },
      },
    ]);
    expect(bindings.map((row) => ({
      pageKey: row.pageKey,
      routePattern: row.routePattern,
      label: row.nav?.label,
      group: row.nav?.group,
    }))).toEqual([
      { pageKey: 'ssh-hub', routePattern: 'ssh/*', label: 'SSH', group: 'Remote Hubs' },
      { pageKey: 'file-hub', routePattern: 'sftp/*', label: 'Sftp', group: 'Remote Hubs' },
    ]);
  });
});
