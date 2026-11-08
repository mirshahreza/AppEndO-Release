import type { WorkflowModel } from '../../awm/types';
import { canonicalJsonFingerprint } from '../../canonicalJson';
import { getActionDefinition } from '../../actions/registry';
import { buildGraph, reachableFrom } from '../../publication/graphAnalysis';
import type { ResolvedActionNodeBinding } from '../../publication/validationTypes';
import type { WorkflowSimulationFixtureSet } from './simulationTypes';

/** Stable fixture-set identity for `WorkflowSimulationRun.fixtureSetFingerprint` (doc 08 section 8: "fixture identity"). */
export function fixtureSetFingerprint(fixtureSet: WorkflowSimulationFixtureSet): string {
  return canonicalJsonFingerprint(fixtureSet as unknown);
}

/** A node kind whose creation-phase completion is externally decided and therefore requires a fixture to resolve deterministically in simulation. */
const FIXTURE_REQUIRING_KINDS = new Set(['ACTION', 'FOR_EACH', 'LOOP', 'WAIT_EVENT', 'WORK_ITEM', 'SUBFLOW']);

const isApprovedPureSafeAction = (actionKey: string, actionVersion: string): boolean => {
  const registered = getActionDefinition(actionKey, actionVersion);
  if (!registered) return false;
  const def = registered.definition;
  return def.availability === 'AVAILABLE' && def.sideEffectClass === 'PURE' && def.secretReferenceFields.length === 0;
};

/**
 * doc 09 section 5's "approved pure/safe Action may execute only under explicit registered
 * simulation policy" — the registered policy this repository ships is exactly "PURE sideEffectClass
 * with zero secret-reference fields" (an Action contract already closed and audited in Slice 3;
 * introducing a second, separate simulation-only allowlist would duplicate that authority rather
 * than reuse it).
 */
export const canExecuteLiveUnderSimulationPolicy = isApprovedPureSafeAction;

/**
 * Structural pre-flight scan (doc 08 section 8: "Panel lists missing fixture paths and exact Action
 * key/version"). Walks every node reachable from `startNodeKey` via the graph's edges — without
 * evaluating any expression, since conditions cannot be evaluated without a concrete run context —
 * and reports every fixture-requiring node that has neither a supplied fixture nor (for ACTION) an
 * approved pure/safe live-execution exemption. This is deliberately over-inclusive versus one actual
 * run (which only ever reaches nodes along the single path its fixtures/conditions actually select)
 * so the authoring panel can warn about missing fixtures the author has not reached yet.
 */
export function computeMissingFixturePaths(
  model: WorkflowModel,
  actionBindings: readonly ResolvedActionNodeBinding[],
  fixtureSet: WorkflowSimulationFixtureSet,
  startNodeKey: string,
): Array<{ nodeKey: string; resolvedActionRef?: { actionKey: string; actionVersion: string } }> {
  const graph = buildGraph(model);
  const reachable = reachableFrom(graph, startNodeKey);
  const bindingByNode = new Map(actionBindings.map((b) => [b.nodeKey, b]));
  const missing: Array<{ nodeKey: string; resolvedActionRef?: { actionKey: string; actionVersion: string } }> = [];

  for (const nodeKey of reachable) {
    const node = graph.nodeByKey.get(nodeKey);
    if (!node || !FIXTURE_REQUIRING_KINDS.has(node.kind)) continue;
    if (fixtureSet.fixtures[nodeKey]) continue;

    if (node.kind === 'ACTION' || node.kind === 'FOR_EACH' || node.kind === 'LOOP') {
      // WFV2-2 — FOR_EACH has no fixture shape of its own (see simulationEngine.ts's FOR_EACH case);
      // it is only ever simulatable when its per-item Action is itself approved PURE/safe, same
      // check as ACTION's fixture-free live-execution exemption.
      const binding = bindingByNode.get(nodeKey);
      const actionRef = binding?.actionRef.action;
      if (actionRef && isApprovedPureSafeAction(actionRef.actionKey, actionRef.actionVersion)) continue;
      missing.push({ nodeKey, resolvedActionRef: actionRef });
      continue;
    }

    missing.push({ nodeKey });
  }

  return missing;
}
