import { describe, expect, it } from 'vitest';
import type { NavigationManifest } from '../../../../shared/api/contracts/platform/navigation';
import { navigationManifestToTreeRows } from '../navigationTreeRows';
import {
  canMoveNavigationNode,
  canMoveNavigationNodeStep,
  moveNavigationNode,
  moveNavigationNodeStep,
} from '../navigationTreeMove';

const manifest: NavigationManifest = {
  id: 'demo',
  groups: [
    {
      heading: 'Main',
      items: [
        { label: 'First', pageKey: 'first' },
        {
          label: 'Parent',
          pageKey: 'parent',
          children: [{ label: 'Child', pageKey: 'child' }],
        },
      ],
    },
    {
      heading: 'Other',
      items: [{ label: 'Other item', pageKey: 'other' }],
    },
  ],
};

describe('navigationTreeMove', () => {
  it('reorders groups', () => {
    const rows = navigationManifestToTreeRows(manifest);
    const { manifest: moved, selection } = moveNavigationNode(manifest, 'g0', 'g1', 'after');

    expect(moved.groups.map((group) => group.heading)).toEqual(['Other', 'Main']);
    expect(selection).toEqual({
      groupIndex: 1,
      itemPath: [],
      nodeKind: 'group',
    });
    expect(canMoveNavigationNode(rows, 'g0', 'g1', 'after')).toBe(true);
    expect(canMoveNavigationNode(rows, 'g0', 'g0:0', 'before')).toBe(false);
  });

  it('reorders sibling items', () => {
    const { manifest: moved, selection } = moveNavigationNode(manifest, 'g0:1', 'g0:0', 'before');

    expect(moved.groups[0]?.items.map((item) => item.label)).toEqual(['Parent', 'First']);
    expect(selection?.itemPath).toEqual([0]);
  });

  it('moves an item into another group', () => {
    const { manifest: moved } = moveNavigationNode(manifest, 'g0:0', 'g1', 'inside');

    expect(moved.groups[0]?.items).toHaveLength(1);
    expect(moved.groups[1]?.items.map((item) => item.label)).toEqual(['Other item', 'First']);
  });

  it('moves an item inside another item', () => {
    const { manifest: moved } = moveNavigationNode(manifest, 'g0:0', 'g0:1', 'inside');

    expect(moved.groups[0]?.items.map((item) => item.label)).toEqual(['Parent']);
    expect(moved.groups[0]?.items[0]?.children?.map((item) => item.label)).toEqual([
      'Child',
      'First',
    ]);
  });

  it('blocks moving a node into its descendant', () => {
    const rows = navigationManifestToTreeRows(manifest);
    expect(canMoveNavigationNode(rows, 'g0:1', 'g0:1.0', 'inside')).toBe(false);
  });

  it('moves nodes up and down among siblings', () => {
    const rows = navigationManifestToTreeRows(manifest);
    expect(canMoveNavigationNodeStep(rows, 'g0:1', 'up')).toBe(true);

    const movedUp = moveNavigationNodeStep(manifest, 'g0:1', 'up');
    expect(movedUp.manifest.groups[0]?.items.map((item) => item.label)).toEqual([
      'Parent',
      'First',
    ]);

    const movedDown = moveNavigationNodeStep(movedUp.manifest, 'g0:0', 'down');
    expect(movedDown.manifest.groups[0]?.items.map((item) => item.label)).toEqual([
      'First',
      'Parent',
    ]);
  });
});
