import { z } from 'zod';

export const RECORD_POLICY_TREE_OPS = ['and', 'or'] as const;
export type RecordPolicyTreeOp = (typeof RECORD_POLICY_TREE_OPS)[number];

export type RecordPolicyTreeNode =
  | { kind: 'policy'; policyId: string }
  | { kind: 'group'; id?: string; op: RecordPolicyTreeOp; children: RecordPolicyTreeNode[] };

export const recordPolicyTreeNodeSchema: z.ZodType<RecordPolicyTreeNode> = z.lazy(() => (
  z.union([
    z.object({
      kind: z.literal('policy'),
      policyId: z.string().min(1),
    }).strict(),
    z.object({
      kind: z.literal('group'),
      id: z.string().min(1).optional(),
      op: z.enum(RECORD_POLICY_TREE_OPS),
      children: z.array(recordPolicyTreeNodeSchema),
    }).strict(),
  ])
));

export const newPolicyTreeGroupId = (): string => (
  `rpg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
);

export const ROOT_POLICY_TREE_GROUP_ID = 'root';

export const ensurePolicyTreeGroupIds = (
  node: RecordPolicyTreeNode,
  isRoot = true,
): RecordPolicyTreeNode => {
  if (node.kind === 'policy') {
    return node;
  }
  return {
    ...node,
    id: node.id || (isRoot ? ROOT_POLICY_TREE_GROUP_ID : newPolicyTreeGroupId()),
    children: node.children.map((child) => ensurePolicyTreeGroupIds(child, false)),
  };
};

export const policyTreeGroupId = (
  node: Extract<RecordPolicyTreeNode, { kind: 'group' }>,
  isRoot = false,
): string => node.id || (isRoot ? ROOT_POLICY_TREE_GROUP_ID : '');

export const getTreeNodeAt = (
  node: RecordPolicyTreeNode,
  path: readonly number[],
): RecordPolicyTreeNode | null => {
  if (path.length === 0) {
    return node;
  }
  if (node.kind !== 'group') {
    return null;
  }
  const [head, ...rest] = path;
  const child = node.children[head];
  if (!child) {
    return null;
  }
  return getTreeNodeAt(child, rest);
};

export const findGroupPathById = (
  node: RecordPolicyTreeNode,
  groupId: string,
  path: readonly number[] = [],
): number[] | null => {
  if (node.kind !== 'group') {
    return null;
  }
  if (policyTreeGroupId(node, path.length === 0) === groupId) {
    return [...path];
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const found = findGroupPathById(node.children[index], groupId, [...path, index]);
    if (found) {
      return found;
    }
  }
  return null;
};

export const findPolicyPath = (
  node: RecordPolicyTreeNode,
  policyId: string,
  path: readonly number[] = [],
): number[] | null => {
  if (node.kind === 'policy') {
    return node.policyId === policyId ? [...path] : null;
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const found = findPolicyPath(node.children[index], policyId, [...path, index]);
    if (found) {
      return found;
    }
  }
  return null;
};

const isPathPrefix = (prefix: readonly number[], path: readonly number[]): boolean => (
  prefix.length <= path.length && prefix.every((value, index) => value === path[index])
);

/** After removing `fromPath`, shift `toPath` if a preceding sibling on the shared parent moved up. */
export const adjustPathAfterRemoval = (
  fromPath: readonly number[],
  toPath: readonly number[],
): number[] => {
  if (fromPath.length === 0 || toPath.length < fromPath.length) {
    return [...toPath];
  }
  const fromParent = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1]!;
  if (!fromParent.every((value, index) => value === toPath[index])) {
    return [...toPath];
  }
  if (toPath.length === fromParent.length) {
    return [...toPath];
  }
  if (toPath[fromParent.length]! > fromIndex) {
    const next = [...toPath];
    next[fromParent.length] -= 1;
    return next;
  }
  return [...toPath];
};

export const insertTreeNodeAt = (
  node: RecordPolicyTreeNode,
  parentPath: readonly number[],
  index: number,
  child: RecordPolicyTreeNode,
): RecordPolicyTreeNode => {
  if (node.kind !== 'group') {
    return node;
  }
  if (parentPath.length === 0) {
    const next = [...node.children];
    const clamped = Math.max(0, Math.min(index, next.length));
    next.splice(clamped, 0, child);
    return { ...node, children: next };
  }
  const [head, ...rest] = parentPath;
  return {
    ...node,
    children: node.children.map((item, itemIndex) => (
      itemIndex === head ? insertTreeNodeAt(item, rest, index, child) : item
    )),
  };
};

/**
 * Move a non-root node to `toParentPath` at `toIndex` (0..len, len = append),
 * using indices from the tree *before* removal.
 */
export const moveTreeNode = (
  tree: RecordPolicyTreeNode,
  fromPath: readonly number[],
  toParentPath: readonly number[],
  toIndex: number,
): RecordPolicyTreeNode => {
  if (tree.kind !== 'group' || fromPath.length === 0) {
    return tree;
  }
  if (isPathPrefix(fromPath, toParentPath)) {
    return tree;
  }
  const moving = getTreeNodeAt(tree, fromPath);
  const dest = getTreeNodeAt(tree, toParentPath);
  if (!moving || !dest || dest.kind !== 'group') {
    return tree;
  }

  const insertAtUnclamped = Math.max(0, Math.min(toIndex, dest.children.length));

  const without = removeTreeNodeAt(tree, fromPath);
  const adjustedParent = adjustPathAfterRemoval(fromPath, toParentPath);
  const parentAfter = getTreeNodeAt(without, adjustedParent);
  if (!parentAfter || parentAfter.kind !== 'group') {
    return tree;
  }
  const insertAt = Math.max(0, Math.min(insertAtUnclamped, parentAfter.children.length));
  return insertTreeNodeAt(without, adjustedParent, insertAt, moving);
};

export const collectPolicyIdsFromTree = (node: RecordPolicyTreeNode): string[] => {
  if (node.kind === 'policy') {
    return [node.policyId];
  }
  return node.children.flatMap(collectPolicyIdsFromTree);
};

export const treeContainsPolicy = (node: RecordPolicyTreeNode, policyId: string): boolean => (
  collectPolicyIdsFromTree(node).includes(policyId)
);

export const createPolicyTreeRoot = (policyIds: readonly string[]): RecordPolicyTreeNode => ({
  kind: 'group',
  op: 'and',
  children: policyIds.map((policyId) => ({ kind: 'policy' as const, policyId })),
});

const pruneNode = (
  node: RecordPolicyTreeNode,
  knownIds: ReadonlySet<string>,
): RecordPolicyTreeNode | null => {
  if (node.kind === 'policy') {
    return knownIds.has(node.policyId) ? node : null;
  }
  const children = node.children
    .map((child) => pruneNode(child, knownIds))
    .filter((child): child is RecordPolicyTreeNode => Boolean(child));
  return { ...node, children };
};

/** Use the stored tree when present; otherwise AND every known policy id. */
export const resolvePolicyTree = (
  tree: RecordPolicyTreeNode | undefined,
  policyIds: readonly string[],
): RecordPolicyTreeNode => {
  const known = new Set(policyIds.filter(Boolean));
  if (!tree) {
    return ensurePolicyTreeGroupIds(createPolicyTreeRoot([...known]));
  }
  const pruned = pruneNode(tree, known) ?? createPolicyTreeRoot([]);
  const inTree = new Set(collectPolicyIdsFromTree(pruned));
  const missing = [...known].filter((id) => !inTree.has(id));
  if (missing.length === 0) {
    return ensurePolicyTreeGroupIds(pruned);
  }
  if (pruned.kind === 'group') {
    return ensurePolicyTreeGroupIds({
      ...pruned,
      children: [...pruned.children, ...missing.map((policyId) => ({ kind: 'policy' as const, policyId }))],
    });
  }
  return ensurePolicyTreeGroupIds({
    kind: 'group',
    op: 'and',
    children: [pruned, ...missing.map((policyId) => ({ kind: 'policy' as const, policyId }))],
  });
};

export const appendPolicyToGroup = (
  node: RecordPolicyTreeNode,
  path: readonly number[],
  policyId: string,
): RecordPolicyTreeNode => {
  if (node.kind !== 'group') {
    return {
      kind: 'group',
      op: 'and',
      children: [node, { kind: 'policy', policyId }],
    };
  }
  if (path.length === 0) {
    if (treeContainsPolicy(node, policyId)) {
      return node;
    }
    return {
      ...node,
      children: [...node.children, { kind: 'policy', policyId }],
    };
  }
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (
      index === head ? appendPolicyToGroup(child, rest, policyId) : child
    )),
  };
};

export const removePolicyFromTree = (
  tree: RecordPolicyTreeNode | undefined,
  policyId: string,
  remainingIds: readonly string[],
): RecordPolicyTreeNode => (
  resolvePolicyTree(tree, remainingIds.filter((id) => id !== policyId))
);

export const updateTreeGroupOp = (
  node: RecordPolicyTreeNode,
  path: readonly number[],
  op: RecordPolicyTreeOp,
): RecordPolicyTreeNode => {
  if (node.kind !== 'group') {
    return node;
  }
  if (path.length === 0) {
    return { ...node, op };
  }
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (
      index === head ? updateTreeGroupOp(child, rest, op) : child
    )),
  };
};

export const addGroupToTree = (
  node: RecordPolicyTreeNode,
  path: readonly number[],
): RecordPolicyTreeNode => {
  if (node.kind !== 'group') {
    return node;
  }
  if (path.length === 0) {
    return {
      ...node,
      children: [...node.children, { kind: 'group', id: newPolicyTreeGroupId(), op: 'or', children: [] }],
    };
  }
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (
      index === head ? addGroupToTree(child, rest) : child
    )),
  };
};

export const removeTreeNodeAt = (
  node: RecordPolicyTreeNode,
  path: readonly number[],
): RecordPolicyTreeNode => {
  if (node.kind !== 'group' || path.length === 0) {
    return node;
  }
  if (path.length === 1) {
    return {
      ...node,
      children: node.children.filter((_, index) => index !== path[0]),
    };
  }
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (
      index === head ? removeTreeNodeAt(child, rest) : child
    )),
  };
};
