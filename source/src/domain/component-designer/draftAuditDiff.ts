/**
 * Prop-level draft audit entries (Phase 54 / gap #21).
 * Reuses the same node-id / fingerprint comparison approach as publishDiff.ts,
 * but emits per-prop before/after rows required by the audit log.
 */

import type { DesignerDocument } from './types';

export type DesignerDraftAuditPropChange = {
  kind: 'prop-change';
  nodeId: string;
  propKey: string;
  before: unknown;
  after: unknown;
};

export type DesignerDraftAuditNodeEvent = {
  kind: 'node-added' | 'node-removed' | 'node-type-changed';
  nodeId: string;
  before?: unknown;
  after?: unknown;
};

export type DesignerDraftAuditEntryChange =
  | DesignerDraftAuditPropChange
  | DesignerDraftAuditNodeEvent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const propsOf = (node: { props?: unknown } | undefined): Record<string, unknown> =>
  isRecord(node?.props) ? node.props : {};

/**
 * Diff two documents into discrete audit change rows (who/when are attached by the server).
 */
export function computeDesignerDraftAuditChanges(
  previous: DesignerDocument | null | undefined,
  next: DesignerDocument | null | undefined,
): DesignerDraftAuditEntryChange[] {
  if (!next) {
    return [];
  }

  if (!previous) {
    return Object.keys(next.nodes).map((nodeId) => ({
      kind: 'node-added' as const,
      nodeId,
      after: next.nodes[nodeId]?.type,
    }));
  }

  const changes: DesignerDraftAuditEntryChange[] = [];
  const previousIds = new Set(Object.keys(previous.nodes));
  const nextIds = new Set(Object.keys(next.nodes));

  for (const nodeId of nextIds) {
    if (!previousIds.has(nodeId)) {
      changes.push({
        kind: 'node-added',
        nodeId,
        after: next.nodes[nodeId]?.type,
      });
      continue;
    }

    const prevNode = previous.nodes[nodeId];
    const nextNode = next.nodes[nodeId];
    if (!prevNode || !nextNode) {
      continue;
    }

    if (prevNode.type !== nextNode.type) {
      changes.push({
        kind: 'node-type-changed',
        nodeId,
        before: prevNode.type,
        after: nextNode.type,
      });
    }

    const prevProps = propsOf(prevNode);
    const nextProps = propsOf(nextNode);
    const keys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]);

    for (const propKey of keys) {
      const before = prevProps[propKey];
      const after = nextProps[propKey];
      if (JSON.stringify(before) === JSON.stringify(after)) {
        continue;
      }
      changes.push({
        kind: 'prop-change',
        nodeId,
        propKey,
        before: before === undefined ? null : before,
        after: after === undefined ? null : after,
      });
    }
  }

  for (const nodeId of previousIds) {
    if (!nextIds.has(nodeId)) {
      changes.push({
        kind: 'node-removed',
        nodeId,
        before: previous.nodes[nodeId]?.type,
      });
    }
  }

  return changes;
}
