import type { WorkflowModel, WorkflowNode } from '../types';

const OPERATION_VERSION = '1';

function rewriteNodeKeyReferences(value: unknown, oldKey: string, newKey: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteNodeKeyReferences(item, oldKey, newKey));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.op === 'PATH' && record.path && typeof record.path === 'object') {
      const path = record.path as { root?: { type?: string; nodeKey?: string }; segments?: unknown };
      if (path.root?.type === 'NODE_OUTPUT' && path.root.nodeKey === oldKey) {
        return {
          ...record,
          path: {
            ...path,
            root: { ...path.root, nodeKey: newKey },
          },
        };
      }
    }
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      next[key] = rewriteNodeKeyReferences(nested, oldKey, newKey);
    }
    return next;
  }
  return value;
}

export function validateRenameNodeKey(
  model: WorkflowModel,
  oldKey: string,
  newKey: string,
): string | null {
  const trimmed = newKey.trim();
  if (!trimmed) {
    return 'Node name cannot be empty.';
  }
  if (trimmed === oldKey) {
    return null;
  }
  if (model.nodes.some((node) => node.key === trimmed)) {
    return `Node "${trimmed}" already exists.`;
  }
  return null;
}

/** Draft operations for renaming a node key (ADD + edge/start rewires + expression fixes + REMOVE). */
export function buildRenameNodeOperations(
  model: WorkflowModel,
  oldKey: string,
  newKey: string,
): unknown[] {
  const trimmed = newKey.trim();
  const validationError = validateRenameNodeKey(model, oldKey, trimmed);
  if (validationError) {
    throw new Error(validationError);
  }
  if (trimmed === oldKey) {
    return [];
  }

  const sourceNode = model.nodes.find((node) => node.key === oldKey);
  if (!sourceNode) {
    throw new Error(`Node "${oldKey}" does not exist.`);
  }

  const operations: unknown[] = [];

  for (const node of model.nodes) {
    if (node.key === oldKey) {
      continue;
    }
    const rewritten = rewriteNodeKeyReferences(node, oldKey, trimmed) as WorkflowNode;
    if (JSON.stringify(rewritten) !== JSON.stringify(node)) {
      operations.push({
        operationSchemaVersion: OPERATION_VERSION,
        type: 'MODIFY_NODE',
        nodeKey: node.key,
        replacement: rewritten,
      });
    }
  }

  operations.push({
    operationSchemaVersion: OPERATION_VERSION,
    type: 'ADD_NODE',
    node: { ...sourceNode, key: trimmed },
  });

  for (const edge of model.edges) {
    if (edge.fromNodeKey !== oldKey && edge.toNodeKey !== oldKey) {
      continue;
    }
    operations.push({
      operationSchemaVersion: OPERATION_VERSION,
      type: 'MODIFY_EDGE',
      edgeKey: edge.key,
      replacement: {
        ...edge,
        fromNodeKey: edge.fromNodeKey === oldKey ? trimmed : edge.fromNodeKey,
        toNodeKey: edge.toNodeKey === oldKey ? trimmed : edge.toNodeKey,
      },
    });
  }

  if (model.start.targetNodeKey === oldKey) {
    operations.push({
      operationSchemaVersion: OPERATION_VERSION,
      type: 'CHANGE_START',
      start: { ...model.start, targetNodeKey: trimmed },
    });
  }

  operations.push({
    operationSchemaVersion: OPERATION_VERSION,
    type: 'REMOVE_NODE',
    nodeKey: oldKey,
  });

  return operations;
}
