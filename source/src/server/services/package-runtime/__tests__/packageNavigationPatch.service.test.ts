import { describe, expect, it } from 'vitest';
import {
  applyNavigationPatchFieldsToExistingItems,
  applyNavigationPatchUninstall,
  relocateNavigationItemsToHeading,
  resolveNavigationHeadingClaim,
  sortNavigationGroupsByOrder,
} from '../packageNavigationPatch.service';

describe('resolveNavigationHeadingClaim', () => {
  it('creates the group when it is absent', () => {
    expect(resolveNavigationHeadingClaim({
      groupExists: false,
      ourSidecarMatches: false,
      foreignSidecarMatches: false,
    })).toBe('create');
  });

  it('reuses this package sidecar on reinstall', () => {
    expect(resolveNavigationHeadingClaim({
      groupExists: true,
      ourSidecarMatches: true,
      foreignSidecarMatches: false,
    })).toBe('ours');
  });

  it('adopts an unowned leftover group with the same heading', () => {
    expect(resolveNavigationHeadingClaim({
      groupExists: true,
      ourSidecarMatches: false,
      foreignSidecarMatches: false,
    })).toBe('adopt');
  });

  it('conflicts when another package sidecar owns the heading', () => {
    expect(resolveNavigationHeadingClaim({
      groupExists: true,
      ourSidecarMatches: false,
      foreignSidecarMatches: true,
    })).toBe('conflict');
  });
});

describe('applyNavigationPatchUninstall', () => {
  const contents = { pageKey: 'cms-contents-list', label: 'Contents', routePattern: 'cms/contents' };
  const settings = { pageKey: 'cms-settings', label: 'Settings', routePattern: 'cms/settings/*' };
  const apiTalk = { pageKey: 'api-talk', label: 'API Talk', routePattern: 'api-talk' };
  const fileHub = { pageKey: 'file-hub', label: 'File Hub', routePattern: 'file-hub/*' };
  const sshHub = { pageKey: 'ssh-hub', label: 'SSH Hub', routePattern: 'ssh-hub/*' };

  it('drops the heading when every remaining item was tracked', () => {
    const groups = applyNavigationPatchUninstall(
      [
        { heading: 'Development', items: [{ pageKey: 'data-studio', label: 'Data Studio' }] },
        { heading: 'CMS', items: [contents, settings] },
      ],
      {
        heading: 'CMS',
        itemPageKeys: ['cms-contents-list', 'cms-settings'],
      },
    );
    expect(groups.map((group) => group.heading)).toEqual(['Development']);
  });

  it('keeps untracked leftover items when uninstalling hubs from Remote Hubs', () => {
    const groups = applyNavigationPatchUninstall(
      [
        { heading: 'Remote Hubs', items: [apiTalk, fileHub, sshHub] },
      ],
      {
        heading: 'Remote Hubs',
        itemPageKeys: ['file-hub', 'ssh-hub', 'rdp-hub'],
      },
    );
    expect(groups).toEqual([{ heading: 'Remote Hubs', items: [apiTalk] }]);
  });

  it('removes only tracked items when the heading was not created by this package', () => {
    const groups = applyNavigationPatchUninstall(
      [{ heading: 'CMS', items: [contents, settings] }],
      {
        heading: 'CMS',
        itemPageKeys: ['cms-contents-list'],
      },
    );
    expect(groups).toEqual([{ heading: 'CMS', items: [settings] }]);
  });
});

describe('applyNavigationPatchFieldsToExistingItems', () => {
  it('moves Settings to the last order on upgrade', () => {
    const items = applyNavigationPatchFieldsToExistingItems(
      [
        { pageKey: 'cms-settings', label: 'Settings', order: 0 },
        { pageKey: 'cms-contents-list', label: 'Contents', order: 1 },
      ],
      [
        { pageKey: 'cms-contents-list', label: 'Contents', order: 0 },
        { pageKey: 'cms-settings', label: 'Settings', order: 1 },
      ],
    );
    expect(items.map((item) => ({ pageKey: item.pageKey, order: item.order }))).toEqual([
      { pageKey: 'cms-settings', order: 1 },
      { pageKey: 'cms-contents-list', order: 0 },
    ]);
  });
});

describe('sortNavigationGroupsByOrder', () => {
  it('places Remote Hubs after Records', () => {
    const groups = sortNavigationGroupsByOrder([
      { heading: 'Records', order: 5 },
      { heading: 'Development', order: 1 },
      { heading: 'Remote Hubs', order: 6 },
      { heading: 'Operations', order: 2 },
    ]);
    expect(groups.map((group) => group.heading)).toEqual([
      'Development',
      'Operations',
      'Records',
      'Remote Hubs',
    ]);
  });
});

describe('relocateNavigationItemsToHeading', () => {
  it('moves hub pageKeys out of Operations so a new group can own them', () => {
    const groups = relocateNavigationItemsToHeading(
      [
        {
          heading: 'Operations',
          items: [
            { pageKey: 'file-manager', label: 'File Manager' },
            { pageKey: 'file-hub', label: 'File Hub' },
            { pageKey: 'ssh-hub', label: 'SSH Hub' },
          ],
        },
        { heading: 'Records', items: [{ pageKey: 'users', label: 'Users' }] },
      ],
      'Remote Hubs',
      new Set(['file-hub', 'ssh-hub', 'rdp-hub']),
    );
    expect(groups[0]?.items.map((item) => item.pageKey)).toEqual(['file-manager']);
    expect(groups[1]?.items.map((item) => item.pageKey)).toEqual(['users']);
  });
});
