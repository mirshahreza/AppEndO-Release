import type { WorkflowNode } from '../types';

const emptyMapping = () => ({ type: 'OBJECT' as const, fields: {} });
const literal = (value: unknown) => ({ op: 'LITERAL' as const, value });

export const NODE_KINDS = ['ACTION', 'FOR_EACH', 'LOOP', 'DECISION', 'SWITCH', 'END', 'FAIL', 'DELAY', 'WAIT_EVENT', 'WORK_ITEM', 'PARALLEL_SPLIT', 'PARALLEL_JOIN', 'SUBFLOW'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  ACTION: 'Action',
  FOR_EACH: 'For each item',
  LOOP: 'Loop while',
  DECISION: 'Decision',
  SWITCH: 'Switch',
  END: 'End',
  FAIL: 'Fail',
  DELAY: 'Delay',
  WAIT_EVENT: 'Wait for event',
  WORK_ITEM: 'Work item (human task)',
  PARALLEL_SPLIT: 'Parallel split',
  PARALLEL_JOIN: 'Parallel join',
  SUBFLOW: 'Subflow',
};

export const NODE_KIND_DESCRIPTIONS: Record<NodeKind, string> = {
  ACTION: 'Runs one registered Action (HTTP, CSV, Data API write, text, AI, email).',
  FOR_EACH: 'Runs one Action once per item in an array, then continues once the join condition is met.',
  LOOP: 'Runs one Action while a condition stays true. Each pass sees the previous output as the current item.',
  DECISION: 'Branches on matching conditions. MULTI_MATCH takes every true path in parallel (inclusive gateway).',
  SWITCH: 'Branches on an exact-match value against outgoing edges.',
  END: 'Terminates the instance successfully with a mapped output.',
  FAIL: 'Terminates the instance with a classified error code and safe message.',
  DELAY: 'Waits for a fixed duration or until an absolute instant.',
  WAIT_EVENT: 'Waits for a correlated external event, with an optional timeout.',
  WORK_ITEM: 'Creates a human task assigned to a user or role.',
  PARALLEL_SPLIT: 'Starts every outgoing branch concurrently.',
  PARALLEL_JOIN: 'Waits for ALL, ANY, or a THRESHOLD count of the branches that actually started. ALL after a MULTI_MATCH Decision gives an inclusive-gateway (Multi-Choice) join; THRESHOLD gives an N-out-of-M (discriminator) join.',
  SUBFLOW: 'Starts and awaits a child workflow instance, with an optional Cancel Region event to abort it without failing the parent.',
};

/** Generates a short, human-readable, collision-resistant node key: `<kind>-<base36 time slice>`. */
export function generateNodeKey(kind: NodeKind, existingKeys: readonly string[]): string {
  const base = kind.toLowerCase().replace(/_/g, '-');
  let candidate = `${base}-${Date.now().toString(36).slice(-5)}`;
  let attempt = 0;
  while (existingKeys.includes(candidate)) {
    attempt += 1;
    candidate = `${base}-${Date.now().toString(36).slice(-5)}-${attempt}`;
  }
  return candidate;
}

/** A structurally valid (schema-passing) default node for each kind — the Node Palette's "one click add" seed. Deep semantic validity (e.g. a real Action key, a real role id) is left for the author to fill in via the form, same as any visual designer's default node. */
export function buildDefaultNode(kind: NodeKind, key: string): WorkflowNode {
  switch (kind) {
    case 'ACTION':
      return {
        kind, key,
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        config: emptyMapping(),
        input: emptyMapping(),
      };
    case 'FOR_EACH':
      return {
        kind, key,
        items: literal([]),
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        config: emptyMapping(),
        input: emptyMapping(),
        joinMode: 'ALL',
      };
    case 'LOOP':
      return {
        kind, key,
        condition: { op: 'LT', left: { op: 'PATH', path: { root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] } }, right: literal(3) },
        actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
        config: emptyMapping(),
        input: emptyMapping(),
        maxIterations: 5,
      };
    case 'DECISION':
      return { kind, key, mode: 'EXACT_ONE' };
    case 'SWITCH':
      return { kind, key, value: literal('') };
    case 'END':
      return { kind, key, output: emptyMapping() };
    case 'FAIL':
      return { kind, key, errorCode: literal('WORKFLOW_FAILED'), safeMessage: literal('The workflow could not complete.') };
    case 'DELAY':
      return { kind, key, delay: { type: 'DURATION_MS', value: literal(60_000) } };
    case 'WAIT_EVENT':
      return { kind, key, eventName: 'event.name', correlation: literal('') };
    case 'WORK_ITEM':
      return {
        kind, key, workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: literal('New work item'),
        input: emptyMapping(),
        outputSchema: { type: 'INLINE', schema: {} },
      };
    case 'PARALLEL_SPLIT':
      return { kind, key };
    case 'PARALLEL_JOIN':
      return { kind, key, mode: 'ALL' };
    case 'SUBFLOW':
      return { kind, key, workflowDefinitionRef: { workflowDefinitionKey: '' }, input: emptyMapping() };
    default:
      return { kind, key };
  }
}
