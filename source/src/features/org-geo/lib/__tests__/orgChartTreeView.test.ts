import { describe, expect, it } from 'vitest';
import type { OrgChartTreeNode } from '../../types';
import {
  buildOrgChartPathOnlyTree,
  collectOrgChartCollapsedBeyondDepth,
  findOrgChartPathToNode,
  orgChartNodeHasChildren,
  pruneOrgChartCollapsed,
} from '../orgChartTreeView';

const n = (
  id: string,
  children?: OrgChartTreeNode[],
  hasChildren?: boolean,
): OrgChartTreeNode => ({
  id,
  label: id,
  ...(hasChildren ? { hasChildren: true } : {}),
  ...(children?.length ? { children } : {}),
});

const tree: OrgChartTreeNode = n('root', [
  n('a', [
    n('a1', [n('a1a')]),
    n('a2'),
  ]),
  n('b', undefined, true),
  n('c'),
]);

describe('orgChartTreeView', () => {
  it('treats unloaded branches as collapsible', () => {
    expect(orgChartNodeHasChildren(n('b', undefined, true))).toBe(true);
    expect(orgChartNodeHasChildren(n('c'))).toBe(false);
    expect(orgChartNodeHasChildren(n('a', [n('a1')]))).toBe(true);
  });

  it('collapses every node below the first open depth', () => {
    expect(collectOrgChartCollapsedBeyondDepth(tree, 1).sort()).toEqual(['a', 'a1', 'b']);
  });

  it('keeps the view root open even when it is in the collapsed set', () => {
    const pruned = pruneOrgChartCollapsed(tree, new Set(['root', 'a', 'b']));
    expect(pruned.children?.map((child) => child.id)).toEqual(['a', 'b', 'c']);
    expect(pruned.children?.find((child) => child.id === 'a')?.children).toBeUndefined();
  });

  it('drops children of collapsed descendants', () => {
    const pruned = pruneOrgChartCollapsed(tree, new Set(['a1']));
    const a = pruned.children?.find((child) => child.id === 'a');
    expect(a?.children?.map((child) => child.id)).toEqual(['a1', 'a2']);
    expect(a?.children?.find((child) => child.id === 'a1')?.children).toBeUndefined();
  });

  it('finds the ancestor path to a node', () => {
    const path = findOrgChartPathToNode(tree, 'a1a');
    expect(path?.map((node) => node.id)).toEqual(['root', 'a', 'a1', 'a1a']);
    expect(findOrgChartPathToNode(tree, 'missing')).toBeNull();
  });

  it('builds a single branch without sibling branches but keeps target children', () => {
    const richTree: OrgChartTreeNode = n('root', [
      n('a', [
        n('a1', [n('a1a', [n('kid-1'), n('kid-2')])]),
        n('a2'),
      ]),
      n('b'),
    ]);
    const path = findOrgChartPathToNode(richTree, 'a1a');
    expect(path).not.toBeNull();
    const isolated = buildOrgChartPathOnlyTree(path!);
    expect(isolated.children?.map((child) => child.id)).toEqual(['a']);
    expect(isolated.children?.[0]?.children?.map((child) => child.id)).toEqual(['a1']);
    const focused = isolated.children?.[0]?.children?.[0]?.children?.[0];
    expect(focused?.id).toBe('a1a');
    expect(focused?.children?.map((child) => child.id)).toEqual(['kid-1', 'kid-2']);
  });
});
