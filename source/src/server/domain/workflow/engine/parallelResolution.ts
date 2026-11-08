import { buildGraph, reachableFrom } from '../publication/graphAnalysis';
import { runParallelValidation } from '../publication/rules/parallelValidation';
import { WorkflowDomainError } from '../errors';
import type { WorkflowModel } from '../awm/types';

/**
 * Runtime split→join resolution (doc 03 section 24: "The resolved revision stores a stable
 * joinGroupKey, exact owning split node key and exact required branch edge/token descriptors for
 * every join"). Repository Reality Audit: `resolvedSnapshot.ts` (Slice 4) stores only the
 * normalized model/action bindings/fingerprint — no separate persisted join-topology projection
 * exists. Rather than add one, this module re-derives split→join ownership at dispatch time by
 * reusing Slice 4's already-tested `runParallelValidation` graph walk, the same way every other
 * Slice 5/6 dispatch decision re-derives edges/limits/retry policy live from the pinned
 * `definitionJson` instead of a cached projection. Safe because a *published* model is guaranteed
 * (by that same validator) to have valid single-level parallel topology — this is a re-walk of
 * already-proven-valid structure, not a fresh validation pass.
 */
export function resolveSplitJoin(model: WorkflowModel, splitNodeKey: string): string {
  const graph = buildGraph(model);
  const reachable = reachableFrom(graph, model.start.targetNodeKey);
  const { membership } = runParallelValidation(model, graph, reachable);
  const joinNodeKey = membership.splitToJoin.get(splitNodeKey);
  if (!joinNodeKey) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Split node "${splitNodeKey}" has no resolved PARALLEL_JOIN — publication should have rejected this shape.`, { splitNodeKey });
  }
  return joinNodeKey;
}

/** Cheap per-edge lookup — a completing node's own resolved edge target may be a PARALLEL_JOIN (doc 05 section 32); this needs only the target's own node definition, not a full region walk. */
export function resolveJoinTargetInfo(model: WorkflowModel, targetNodeKey: string): { targetIsJoin: boolean; join?: { mode: 'ALL' | 'ANY' | 'THRESHOLD'; thresholdCount?: number; cancelRemaining: boolean } } {
  const targetDef = model.nodes.find((n) => n.key === targetNodeKey);
  if (targetDef?.kind === 'PARALLEL_JOIN') {
    return { targetIsJoin: true, join: { mode: targetDef.mode, thresholdCount: targetDef.thresholdCount, cancelRemaining: targetDef.cancelRemaining ?? false } };
  }
  return { targetIsJoin: false };
}
