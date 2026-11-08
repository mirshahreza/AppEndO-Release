import { describe, expect, it } from 'vitest';
import {
  composeStudioSidebarNav,
  filterNavGroupsByItemRegion,
  filterNavGroupsForRegion,
  splitLeadingUngroupedNavGroups,
  splitShellNavByItemRegion,
} from '../navTreeFilter';
import type { AdminShellNavGroup } from '../../../layouts/adminShell/types';

const sampleGroups: AdminShellNavGroup[] = [
  {
    heading: 'Operations',
    items: [
      { label: 'Home', path: '/us/ops/home' },
      { label: 'Reports', path: '/us/ops/reports' },
    ],
  },
];

const mixedGroups: AdminShellNavGroup[] = [
  {
    heading: 'Ops',
    items: [
      { label: 'Workflows', path: '/us/studio/workflows' },
      { label: 'Help', path: '/us/studio/help', region: 'sidebar-footer', icon: 'tabler:IconHelp' },
      {
        label: 'Settings',
        path: '/us/studio/settings',
        children: [
          { label: 'Account', path: '/us/studio/account', region: 'header', icon: 'tabler:IconUser' },
        ],
      },
    ],
  },
];

describe('filterNavGroupsForRegion', () => {
  it('keeps groups for side region', () => {
    expect(filterNavGroupsForRegion('side', sampleGroups)).toEqual(sampleGroups);
  });

  it('excludes sidebar-footer and header items from the side tree', () => {
    const side = filterNavGroupsForRegion('side', mixedGroups);
    expect(side[0]?.items.map((item) => item.label)).toEqual(['Workflows', 'Settings']);
  });

  it('keeps groups for top region', () => {
    const top = filterNavGroupsForRegion('top', sampleGroups);
    expect(top).toHaveLength(1);
    expect(top[0]?.items).toHaveLength(2);
  });
});

describe('filterNavGroupsByItemRegion', () => {
  it('keeps omitted region items in the main sidebar tree', () => {
    const side = filterNavGroupsByItemRegion(mixedGroups, 'side');
    expect(side).toHaveLength(1);
    expect(side[0]?.items.map((item) => item.label)).toEqual(['Workflows', 'Settings']);
    expect(side[0]?.items[1]?.children).toBeUndefined();
  });

  it('flattens sidebar-footer items and hoists header descendants out of the tree', () => {
    const footer = filterNavGroupsByItemRegion(mixedGroups, 'sidebar-footer');
    expect(footer[0]?.items.map((item) => item.label)).toEqual(['Help']);

    const header = filterNavGroupsByItemRegion(mixedGroups, 'header');
    expect(header[0]?.items.map((item) => item.label)).toEqual(['Account']);
  });
});

describe('splitShellNavByItemRegion', () => {
  it('splits the three live shell locations without empty chrome lists', () => {
    const split = splitShellNavByItemRegion(mixedGroups);
    expect(split.sideGroups[0]?.items.map((item) => item.label)).toEqual(['Workflows', 'Settings']);
    expect(split.sidebarFooterItems.map((item) => item.label)).toEqual(['Help']);
    expect(split.headerItems.map((item) => item.label)).toEqual(['Account']);
  });

  it('hides footer and header lists when no items are assigned', () => {
    const split = splitShellNavByItemRegion(sampleGroups);
    expect(split.sidebarFooterItems).toEqual([]);
    expect(split.headerItems).toEqual([]);
    expect(split.sideGroups).toHaveLength(1);
  });
});

describe('splitLeadingUngroupedNavGroups', () => {
  it('extracts leading ungrouped items and leaves headed groups in the tree', () => {
    const groups: AdminShellNavGroup[] = [
      {
        heading: null,
        items: [{ label: 'Home', path: '/studio', icon: 'Home' }],
      },
      {
        heading: 'Development',
        items: [{ label: 'Data Studio', path: '/studio/data-studio' }],
      },
    ];

    const split = splitLeadingUngroupedNavGroups(groups);
    expect(split.leadingItems.map((item) => item.label)).toEqual(['Home']);
    expect(split.restGroups).toHaveLength(1);
    expect(split.restGroups[0]?.heading).toBe('Development');
  });
});

describe('composeStudioSidebarNav', () => {
  it('puts Home and footer utilities in the top strip and keeps headed groups in the tree', () => {
    const groups: AdminShellNavGroup[] = [
      {
        heading: null,
        items: [{ label: 'Home', path: '/studio', icon: 'Home' }],
      },
      {
        heading: 'Development',
        items: [
          { label: 'Data Studio', path: '/studio/data-studio' },
          { label: 'Theme Designer', path: '/studio/appearance', region: 'sidebar-footer' },
          { label: 'Settings', path: '/studio/settings', region: 'sidebar-footer' },
        ],
      },
    ];

    const composed = composeStudioSidebarNav(groups);
    expect(composed.quickNavItems.map((item) => item.label)).toEqual([
      'Home',
      'Theme Designer',
      'Settings',
    ]);
    expect(composed.treeGroups).toHaveLength(1);
    expect(composed.treeGroups[0]?.items.map((item) => item.label)).toEqual(['Data Studio']);
  });
});
