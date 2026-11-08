import { describe, expect, it } from 'vitest';
import type { AdminShellNavGroup } from '../../../layouts/adminShell/types';
import {
  filterAdminShellNavByQuery,
  splitNavGroupsAtSearchSlot,
} from '../filterAdminShellNavByQuery';

const menu: AdminShellNavGroup[] = [
  {
    heading: null,
    items: [{ label: 'Home', path: '/studio', description: 'Studio dashboard' }],
  },
  {
    heading: 'Platform',
    items: [
      { label: 'Workflows', path: '/studio/workflows' },
      {
        label: 'Settings',
        path: '/studio/settings',
        children: [
          { label: 'Users', path: '/studio/users' },
          { label: 'Roles', path: '/studio/roles' },
        ],
      },
    ],
  },
  {
    heading: 'Data',
    items: [{ label: 'Data Studio', path: '/studio/data-studio' }],
  },
];

describe('filterAdminShellNavByQuery', () => {
  it('returns the original groups when the query is empty', () => {
    expect(filterAdminShellNavByQuery(menu, '   ')).toEqual(menu);
  });

  it('keeps matching ungrouped items and headed groups', () => {
    const filtered = filterAdminShellNavByQuery(menu, 'home');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.heading).toBeNull();
    expect(filtered[0]?.items.map((item) => item.label)).toEqual(['Home']);
  });

  it('matches a group heading and flattens every item in that group', () => {
    const filtered = filterAdminShellNavByQuery(menu, 'platform');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.heading).toBeNull();
    expect(filtered[0]?.items.map((item) => item.label)).toEqual([
      'Workflows',
      'Settings',
      'Users',
      'Roles',
    ]);
  });

  it('lifts a nested child into the flat result list', () => {
    const filtered = filterAdminShellNavByQuery(menu, 'users');
    expect(filtered[0]?.heading).toBeNull();
    expect(filtered[0]?.items.map((item) => item.label)).toEqual(['Users']);
    expect(filtered[0]?.items[0]?.children).toBeUndefined();
  });

  it('matches item descriptions', () => {
    const filtered = filterAdminShellNavByQuery(menu, 'dashboard');
    expect(filtered[0]?.items[0]?.label).toBe('Home');
  });
});

describe('splitNavGroupsAtSearchSlot', () => {
  it('splits leading ungrouped groups from headed sections', () => {
    const split = splitNavGroupsAtSearchSlot(menu);
    expect(split.beforeSearch).toHaveLength(1);
    expect(split.beforeSearch[0]?.items[0]?.label).toBe('Home');
    expect(split.afterSearch.map((group) => group.heading)).toEqual(['Platform', 'Data']);
  });

  it('places the search slot at the start when every group is headed', () => {
    const split = splitNavGroupsAtSearchSlot(menu.slice(1));
    expect(split.beforeSearch).toEqual([]);
    expect(split.afterSearch).toHaveLength(2);
  });
});
