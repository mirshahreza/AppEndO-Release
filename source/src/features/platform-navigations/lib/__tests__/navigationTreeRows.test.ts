import { describe, expect, it } from 'vitest';
import type { NavigationManifest } from '../../../../shared/api/contracts/platform/navigation';
import {
  addNavigationGroup,
  addNavigationItem,
  addNavigationItemAtSelection,
  ensureUngroupedGroup,
  navigationManifestToTreeRows,
  removeNavigationItemAtPath,
  updateNavigationItemAtPath,
} from '../navigationTreeRows';

const manifest: NavigationManifest = {
  id: 'demo',
  groups: [
    {
      heading: 'Main',
      items: [
        {
          label: 'Parent',
          pageKey: 'parent',
          children: [{ label: 'Child', pageKey: 'child' }],
        },
      ],
    },
  ],
};

describe('navigationTreeRows', () => {
  it('maps groups and nested items to tree rows', () => {
    const rows = navigationManifestToTreeRows(manifest);
    expect(rows.some((row) => row.nodeKind === 'group' && row.label === 'Main')).toBe(true);
    expect(rows.some((row) => row.label === 'Child' && row.depth === 2)).toBe(true);
  });

  it('updates and removes items by path', () => {
    const updated = updateNavigationItemAtPath(manifest, 0, [0], (item) => ({
      ...item,
      label: 'Updated parent',
    }));
    expect(updated.groups[0]?.items[0]?.label).toBe('Updated parent');

    const withChildRemoved = removeNavigationItemAtPath(updated, 0, [0, 0]);
    expect(withChildRemoved.groups[0]?.items[0]?.children).toEqual([]);
  });

  it('adds groups and items', () => {
    const withGroup = addNavigationGroup(manifest, 'Extra');
    expect(withGroup.groups).toHaveLength(2);

    const withItem = addNavigationItem(withGroup, 1, []);
    expect(withItem.groups[1]?.items).toHaveLength(1);
  });

  it('adds items without a named group via ungrouped bucket', () => {
    const empty: NavigationManifest = { id: 'empty', groups: [] };
    const withItem = addNavigationItemAtSelection(empty, null);

    expect(withItem.groups).toHaveLength(1);
    expect(withItem.groups[0]?.heading).toBeNull();
    expect(withItem.groups[0]?.items).toHaveLength(1);
    expect(withItem.groups[0]?.items[0]?.label).toBe('New item');

    const rows = navigationManifestToTreeRows(withItem);
    expect(rows.some((row) => row.nodeKind === 'group' && row.label === '(ungrouped)')).toBe(true);
  });

  it('reuses existing ungrouped group when adding without selection', () => {
    const { manifest: withUngrouped, groupIndex } = ensureUngroupedGroup(manifest);
    expect(groupIndex).toBe(1);

    const withItem = addNavigationItemAtSelection(withUngrouped, null);
    expect(withItem.groups).toHaveLength(2);
    expect(withItem.groups[1]?.heading).toBeNull();
    expect(withItem.groups[1]?.items).toHaveLength(1);
  });
});
