import type { WorkflowNode } from '../types';

/**
 * Client-side mirror of doc 05 section 25's outgoing-edge cardinality/selector matrix (server
 * authority: `src/server/domain/workflow/publication/rules/structuralValidation.ts`'s
 * `validateEdgeCardinality`). Used only to narrow the drag-to-connect popover's choices to what the
 * source node's kind can actually carry — the server re-validates independently on save regardless,
 * this is a UX narrowing, not a second authority.
 */
export type EdgeSelectorType = 'UNCONDITIONAL' | 'DECISION' | 'DECISION_DEFAULT' | 'SWITCH_CASE' | 'SWITCH_DEFAULT' | 'WORK_ITEM_OUTCOME' | 'WAIT_TIMEOUT' | 'ON_ERROR' | 'CANCEL_REGION';

export const EDGE_SELECTOR_LABELS: Record<EdgeSelectorType, string> = {
  UNCONDITIONAL: 'Always',
  DECISION: 'If condition is true',
  DECISION_DEFAULT: 'Otherwise (default)',
  SWITCH_CASE: 'Case value',
  SWITCH_DEFAULT: 'Default case',
  WORK_ITEM_OUTCOME: 'On outcome',
  WAIT_TIMEOUT: 'On timeout',
  ON_ERROR: 'On error (catch)',
  CANCEL_REGION: 'On cancel event (region)',
};

/** Selector types the popover offers for a connection dragged from `sourceNode`. `END`/`FAIL` never
 * appear here — their source Handle is hidden entirely in `GraphCanvas` since they allow zero
 * outgoing edges. */
export function allowedSelectorTypesForSource(sourceNode: WorkflowNode): EdgeSelectorType[] {
  switch (sourceNode.kind) {
    case 'ACTION':
    case 'FOR_EACH':
    case 'LOOP':
      // WFV2-1/WFV2-2 — an ACTION or FOR_EACH node may additionally carry one ON_ERROR/CATCH edge
      // alongside its required UNCONDITIONAL success edge (server-enforced cardinality in
      // structuralValidation.ts).
      return ['UNCONDITIONAL', 'ON_ERROR'];
    case 'DELAY':
    case 'PARALLEL_JOIN':
    case 'PARALLEL_SPLIT':
      return ['UNCONDITIONAL'];
    case 'SUBFLOW':
      // p-99/WFT-9 — a SUBFLOW may additionally carry one CANCEL_REGION edge when it declares a
      // cancelEvent (server-enforced exact-correspondence in structuralValidation.ts).
      return sourceNode.cancelEvent ? ['UNCONDITIONAL', 'CANCEL_REGION'] : ['UNCONDITIONAL'];
    case 'WAIT_EVENT':
      return sourceNode.timeout ? ['UNCONDITIONAL', 'WAIT_TIMEOUT'] : ['UNCONDITIONAL'];
    case 'WORK_ITEM':
      return ['WORK_ITEM_OUTCOME'];
    case 'DECISION':
      return ['DECISION', 'DECISION_DEFAULT'];
    case 'SWITCH':
      return ['SWITCH_CASE', 'SWITCH_DEFAULT'];
    default:
      return ['UNCONDITIONAL'];
  }
}

/** Generates a short, human-readable, collision-resistant edge key — same spirit as
 * `nodeTemplates.ts`'s `generateNodeKey`. */
export function generateEdgeKey(fromNodeKey: string, toNodeKey: string, existingKeys: readonly string[]): string {
  const base = `${fromNodeKey}-to-${toNodeKey}`;
  let candidate = base;
  let attempt = 0;
  while (existingKeys.includes(candidate)) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}
