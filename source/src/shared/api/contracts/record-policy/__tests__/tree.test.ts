import { describe, expect, it } from 'vitest';
import {
  adjustPathAfterRemoval,
  moveTreeNode,
  resolvePolicyTree,
  type RecordPolicyTreeNode,
} from '../tree';

const policy = (id: string): RecordPolicyTreeNode => ({ kind: 'policy', policyId: id });

const group = (
  id: string,
  children: RecordPolicyTreeNode[],
  op: 'and' | 'or' = 'and',
): RecordPolicyTreeNode => ({ kind: 'group', id, op, children });

const ids = (node: RecordPolicyTreeNode): string[] => {
  if (node.kind === 'policy') {
    return [node.policyId];
  }
  return node.children.flatMap(ids);
};

describe('moveTreeNode', () => {
  it('reorders siblings like arrayMove', () => {
    const tree = group('root', [policy('a'), policy('b'), policy('c')]);
    expect(ids(moveTreeNode(tree, [0], [], 2))).toEqual(['b', 'c', 'a']);
    expect(ids(moveTreeNode(tree, [2], [], 0))).toEqual(['c', 'a', 'b']);
    expect(ids(moveTreeNode(tree, [0], [], 1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveTreeNode(tree, [2], [], 1))).toEqual(['a', 'c', 'b']);
  });

  it('moves a policy into another group', () => {
    const tree = group('root', [
      group('g1', [policy('a')]),
      group('g2', [policy('b')]),
    ]);
    const next = moveTreeNode(tree, [0, 0], [1], 0);
    expect(next).toEqual(group('root', [
      group('g1', []),
      group('g2', [policy('a'), policy('b')]),
    ]));
  });

  it('moves a group into a later sibling and adjusts the dest path', () => {
    const tree = group('root', [
      group('g1', [policy('a')]),
      group('g2', [policy('b')]),
    ]);
    const next = moveTreeNode(tree, [0], [1], 0);
    expect(next).toEqual(group('root', [
      group('g2', [group('g1', [policy('a')]), policy('b')]),
    ]));
  });

  it('does not move a group into itself or a descendant', () => {
    const tree = group('root', [
      group('g1', [group('g2', [policy('a')])]),
    ]);
    expect(moveTreeNode(tree, [0], [0], 0)).toEqual(tree);
    expect(moveTreeNode(tree, [0], [0, 0], 0)).toEqual(tree);
  });
});

describe('adjustPathAfterRemoval', () => {
  it('decrements a later sibling dest after removing an earlier sibling', () => {
    expect(adjustPathAfterRemoval([0], [1])).toEqual([0]);
    expect(adjustPathAfterRemoval([0], [])).toEqual([]);
    expect(adjustPathAfterRemoval([1, 0], [1])).toEqual([1]);
  });
});

describe('resolvePolicyTree', () => {
  it('assigns a stable root group id', () => {
    const resolved = resolvePolicyTree(undefined, ['a']);
    expect(resolved.kind).toBe('group');
    if (resolved.kind === 'group') {
      expect(resolved.id).toBe('root');
    }
  });
});
