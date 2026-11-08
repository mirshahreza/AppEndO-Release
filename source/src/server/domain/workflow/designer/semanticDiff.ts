import type { WorkflowModel, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '../awm/types';
import { normalizeNode } from '../awm/draftOperationApplier';
import { canonicalJsonFingerprint } from '../canonicalJson';

/**
 * Semantic diff / binding-impact projection — doc 11 section 1 item 11b and
 * 08-DESIGNER-AND-AUTHORING.md section 4 ("display semantic diff and binding impact" before
 * publish confirmation). Compares two *normalized* WorkflowModel snapshots (typically the current
 * published revision's model versus a draft/candidate about to be published, or two arbitrary
 * drafts for authoring-time review) purely by canonical fingerprint equality — no independent
 * notion of "changed" exists outside `canonicalJson.ts`, matching doc 03 section 20's "one
 * canonical semantic JSON utility" authority. This module never mutates or validates a draft; it
 * only reports what changed. `awm/draftOperationApplier.ts`'s own `affectedNodeKeys`/
 * `affectedEdgeKeys` (returned from every `ApplyDraftOperations` call) remain the authoritative
 * "what did this exact operation list touch" projection — this module additionally answers "what
 * differs between two arbitrary snapshots", which an operation list alone cannot answer once a
 * draft has been edited across many separate calls.
 */

export type SemanticDiffEntryKind = 'ADDED' | 'REMOVED' | 'MODIFIED';

export type NodeDiffEntry = { kind: SemanticDiffEntryKind; nodeKey: string; nodeKind: string; actionBindingChanged: boolean };
export type EdgeDiffEntry = { kind: SemanticDiffEntryKind; edgeKey: string; fromNodeKey: string; toNodeKey: string };

export type WorkflowLevelDiff = {
  startChanged: boolean;
  inputSchemaChanged: boolean;
  outputSchemaChanged: boolean;
  variablesChanged: boolean;
  policiesChanged: boolean;
  nameChanged: boolean;
  descriptionChanged: boolean;
};

export type SemanticDiffResult = {
  previousFingerprint: string | null;
  nextFingerprint: string;
  identical: boolean;
  nodes: NodeDiffEntry[];
  edges: EdgeDiffEntry[];
  workflowLevel: WorkflowLevelDiff;
  /** Node keys whose ACTION resolution (actionKey/actionVersion/provider/capabilities) actually changed — the "binding impact" doc 08 section 4 requires surfacing before publish confirmation. */
  bindingImpactNodeKeys: string[];
};

const actionBindingSignature = (node: WorkflowNodeDefinition): string | null => {
  if (node.kind !== 'ACTION') return null;
  return canonicalJsonFingerprint(node.actionRef as unknown);
};

function diffNodes(previous: WorkflowNodeDefinition[] | null, next: WorkflowNodeDefinition[]): { entries: NodeDiffEntry[]; bindingImpact: string[] } {
  const prevByKey = new Map((previous ?? []).map((n) => [n.key, n]));
  const nextByKey = new Map(next.map((n) => [n.key, n]));
  const entries: NodeDiffEntry[] = [];
  const bindingImpact: string[] = [];

  for (const node of next) {
    const prevNode = prevByKey.get(node.key);
    if (!prevNode) {
      entries.push({ kind: 'ADDED', nodeKey: node.key, nodeKind: node.kind, actionBindingChanged: false });
      continue;
    }
    const prevFp = canonicalJsonFingerprint(prevNode as unknown);
    const nextFp = canonicalJsonFingerprint(node as unknown);
    if (prevFp !== nextFp) {
      const actionBindingChanged = actionBindingSignature(prevNode) !== actionBindingSignature(node);
      entries.push({ kind: 'MODIFIED', nodeKey: node.key, nodeKind: node.kind, actionBindingChanged });
      if (actionBindingChanged) bindingImpact.push(node.key);
    }
  }
  for (const node of previous ?? []) {
    if (!nextByKey.has(node.key)) {
      entries.push({ kind: 'REMOVED', nodeKey: node.key, nodeKind: node.kind, actionBindingChanged: false });
    }
  }
  return { entries, bindingImpact };
}

function diffEdges(previous: WorkflowEdgeDefinition[] | null, next: WorkflowEdgeDefinition[]): EdgeDiffEntry[] {
  const prevByKey = new Map((previous ?? []).map((e) => [e.key, e]));
  const nextByKey = new Map(next.map((e) => [e.key, e]));
  const entries: EdgeDiffEntry[] = [];

  for (const edge of next) {
    const prevEdge = prevByKey.get(edge.key);
    if (!prevEdge) {
      entries.push({ kind: 'ADDED', edgeKey: edge.key, fromNodeKey: edge.fromNodeKey, toNodeKey: edge.toNodeKey });
      continue;
    }
    if (canonicalJsonFingerprint(prevEdge as unknown) !== canonicalJsonFingerprint(edge as unknown)) {
      entries.push({ kind: 'MODIFIED', edgeKey: edge.key, fromNodeKey: edge.fromNodeKey, toNodeKey: edge.toNodeKey });
    }
  }
  for (const edge of previous ?? []) {
    if (!nextByKey.has(edge.key)) {
      entries.push({ kind: 'REMOVED', edgeKey: edge.key, fromNodeKey: edge.fromNodeKey, toNodeKey: edge.toNodeKey });
    }
  }
  return entries;
}

/**
 * `previous === null` means "no prior snapshot" (first publish of a brand-new definition, or an
 * authoring-time diff against nothing) — every node/edge reports ADDED and every workflow-level
 * flag reports changed, matching how doc 08 section 4's publish UX degrades for the first
 * publication of a definition.
 */
/**
 * Callers may pass an in-memory model that still carries explicit `undefined` on omitted optional
 * fields (e.g. a draft-operation applier candidate, or a hand-built fixture) rather than one that
 * has round-tripped through `JSON.parse` after DB storage. `canonicalJsonFingerprint` requires
 * every value to be JSON-representable, so normalize the same way persistence already implicitly
 * does — `JSON.stringify` drops `undefined` object properties — before fingerprinting.
 */
const jsonClean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function computeSemanticDiff(previous: WorkflowModel | null, next: WorkflowModel): SemanticDiffResult {
  const normalizedNext: WorkflowModel = jsonClean({ ...next, nodes: next.nodes.map(normalizeNode) });
  const normalizedPrevious: WorkflowModel | null = previous ? jsonClean({ ...previous, nodes: previous.nodes.map(normalizeNode) }) : null;

  const previousFingerprint = normalizedPrevious ? canonicalJsonFingerprint(normalizedPrevious as unknown) : null;
  const nextFingerprint = canonicalJsonFingerprint(normalizedNext as unknown);

  const { entries: nodes, bindingImpact } = diffNodes(normalizedPrevious?.nodes ?? null, normalizedNext.nodes);
  const edges = diffEdges(normalizedPrevious?.edges ?? null, normalizedNext.edges);

  const workflowLevel: WorkflowLevelDiff = {
    startChanged: canonicalJsonFingerprint((normalizedPrevious?.start ?? null) as unknown) !== canonicalJsonFingerprint(normalizedNext.start as unknown),
    inputSchemaChanged: canonicalJsonFingerprint((normalizedPrevious?.inputSchema ?? null) as unknown) !== canonicalJsonFingerprint(normalizedNext.inputSchema as unknown),
    outputSchemaChanged: canonicalJsonFingerprint((normalizedPrevious?.outputSchema ?? null) as unknown) !== canonicalJsonFingerprint(normalizedNext.outputSchema as unknown),
    variablesChanged: canonicalJsonFingerprint((normalizedPrevious?.variables ?? null) as unknown) !== canonicalJsonFingerprint(normalizedNext.variables as unknown),
    policiesChanged: canonicalJsonFingerprint((normalizedPrevious?.policies ?? null) as unknown) !== canonicalJsonFingerprint(normalizedNext.policies as unknown),
    nameChanged: (normalizedPrevious?.name ?? null) !== normalizedNext.name,
    descriptionChanged: (normalizedPrevious?.description ?? null) !== (normalizedNext.description ?? null),
  };

  return {
    previousFingerprint,
    nextFingerprint,
    identical: previousFingerprint === nextFingerprint,
    nodes,
    edges,
    workflowLevel,
    bindingImpactNodeKeys: bindingImpact,
  };
}
