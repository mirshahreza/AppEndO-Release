import type { WorkflowModel } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { ValidationIssue } from '../validationTypes';
import type { WorkflowGraph } from '../graphAnalysis';

/**
 * Structured single-level parallel topology validation — doc 05 sections 22, 32; doc 03 section 24.
 * Only runs on an acyclic reachable graph (callers skip this when structuralValidation already
 * detected a cycle). Rejects nested, overlapping, crossing and detached parallel regions.
 */

export type ParallelRegionMembership = {
  /** nodeKey -> {splitNodeKey, branchEdgeKey} for every node strictly inside a validated branch (excludes the split/join nodes themselves). */
  nodeToBranch: Map<string, { splitNodeKey: string; branchEdgeKey: string }>;
  /** splitNodeKey -> resolved joinNodeKey, only present for splits that resolved to exactly one valid join. */
  splitToJoin: Map<string, string>;
};

function isSplitLike(node: WorkflowModel['nodes'][number]): boolean {
  return node.kind === 'PARALLEL_SPLIT' || (node.kind === 'DECISION' && node.mode === 'MULTI_MATCH');
}

function splitDisplayName(split: WorkflowModel['nodes'][number]): string {
  return split.kind === 'DECISION' ? `DECISION "${split.key}" (MULTI_MATCH)` : `PARALLEL_SPLIT "${split.key}"`;
}

function splitBranchEdges(graph: WorkflowGraph, split: WorkflowModel['nodes'][number]) {
  const outgoing = graph.outgoing.get(split.key) ?? [];
  if (split.kind === 'DECISION') {
    return outgoing.filter((e) => e.selector.type === 'DECISION' || e.selector.type === 'DECISION_DEFAULT');
  }
  return outgoing.filter((e) => e.selector.type === 'UNCONDITIONAL');
}

export function runParallelValidation(model: WorkflowModel, graph: WorkflowGraph, reachable: Set<string>): { issues: ValidationIssue[]; membership: ParallelRegionMembership } {
  const issues: ValidationIssue[] = [];
  const fail = (nodeKey: string | undefined, message: string) =>
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_PARALLEL_STRUCTURE, severity: 'ERROR', message, nodeKey });

  const nodeToBranch = new Map<string, { splitNodeKey: string; branchEdgeKey: string }>();
  const splitToJoin = new Map<string, string>();
  const joinOwnedBySplit = new Map<string, string>();

  const splitNodes = model.nodes.filter((n) => isSplitLike(n) && reachable.has(n.key));
  const joinNodes = model.nodes.filter((n) => n.kind === 'PARALLEL_JOIN' && reachable.has(n.key));

  for (const split of splitNodes) {
    const branchEdges = splitBranchEdges(graph, split);
    const branchRegions: Array<{ branchEdgeKey: string; nodes: Set<string>; terminalJoinKey: string | null }> = [];
    let structurallyValid = true;

    for (const branchEdge of branchEdges) {
      const regionNodes = new Set<string>();
      let terminalJoinKey: string | null = null;
      const queue = [branchEdge.toNodeKey];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const node = graph.nodeByKey.get(current);
        if (!node) continue;

        if (node.kind === 'PARALLEL_JOIN') {
          if (terminalJoinKey !== null && terminalJoinKey !== current) {
            fail(split.key, `${splitDisplayName(split)} branch "${branchEdge.key}" reaches more than one PARALLEL_JOIN — crossing parallel region.`);
            structurallyValid = false;
          }
          terminalJoinKey = current;
          continue; // do not walk past the join in this branch's local traversal
        }
        if (isSplitLike(node)) {
          fail(split.key, `${splitDisplayName(split)} branch "${branchEdge.key}" passes through another split ("${current}") before reaching its join — nested parallel regions are rejected.`);
          structurallyValid = false;
          continue;
        }
        if (node.kind === 'END' || node.kind === 'FAIL') {
          fail(split.key, `${splitDisplayName(split)} branch "${branchEdge.key}" terminates at "${current}" without reaching the split's join.`);
          structurallyValid = false;
          continue;
        }

        regionNodes.add(current);
        for (const outEdge of graph.outgoing.get(current) ?? []) {
          queue.push(outEdge.toNodeKey);
        }
      }

      if (terminalJoinKey === null) {
        fail(split.key, `${splitDisplayName(split)} branch "${branchEdge.key}" never reaches a PARALLEL_JOIN.`);
        structurallyValid = false;
      }

      branchRegions.push({ branchEdgeKey: branchEdge.key, nodes: regionNodes, terminalJoinKey });
    }

    if (!structurallyValid) continue;

    const joinKeys = new Set(branchRegions.map((r) => r.terminalJoinKey).filter((k): k is string => k !== null));
    if (joinKeys.size !== 1) {
      fail(split.key, `${splitDisplayName(split)} branches do not all converge on exactly one PARALLEL_JOIN.`);
      continue;
    }
    const joinKey = Array.from(joinKeys)[0];

    // Containment: no node in any branch region may have an edge leaving to somewhere other than
    // another node in the SAME branch or the owning join; no node in a branch region may have an
    // incoming edge from outside that branch region (except the direct split->entry edge).
    let containmentOk = true;
    const allRegionNodeKeys = new Set<string>();
    for (const region of branchRegions) for (const key of region.nodes) allRegionNodeKeys.add(key);

    for (const region of branchRegions) {
      for (const nodeKey of region.nodes) {
        for (const outEdge of graph.outgoing.get(nodeKey) ?? []) {
          const target = outEdge.toNodeKey;
          if (target !== joinKey && !region.nodes.has(target)) {
            fail(split.key, `Node "${nodeKey}" inside ${splitDisplayName(split)} branch "${region.branchEdgeKey}" has an edge leaving the branch to "${target}", which is not the owning join.`);
            containmentOk = false;
          }
        }
        for (const inEdge of graph.incoming.get(nodeKey) ?? []) {
          const source = inEdge.fromNodeKey;
          const isDirectBranchEntry = source === split.key;
          if (!isDirectBranchEntry && !region.nodes.has(source)) {
            fail(split.key, `Node "${nodeKey}" inside ${splitDisplayName(split)} branch "${region.branchEdgeKey}" has an incoming edge from "${source}", which is outside the branch — externally entered parallel region.`);
            containmentOk = false;
          }
        }
      }
    }
    if (!containmentOk) continue;

    // The join's total incoming edges must be exactly the branch-terminal edges of this split (no
    // extra edges from outside the region, no fewer than the declared branch count).
    const joinIncoming = graph.incoming.get(joinKey) ?? [];
    if (joinIncoming.length !== branchRegions.length) {
      fail(split.key, `PARALLEL_JOIN "${joinKey}" has ${joinIncoming.length} incoming edges but ${splitDisplayName(split)} declares ${branchRegions.length} branches.`);
      continue;
    }

    // WFV2-18 — THRESHOLD's count is only meaningful bounded by this split's actual branch count,
    // which is not known until this point in the walk (an authoring-time-only check could not see it).
    const joinDef = model.nodes.find((n) => n.key === joinKey);
    if (joinDef?.kind === 'PARALLEL_JOIN' && joinDef.mode === 'THRESHOLD') {
      const threshold = joinDef.thresholdCount;
      if (threshold === undefined || threshold < 1 || threshold > branchRegions.length) {
        fail(split.key, `PARALLEL_JOIN "${joinKey}" mode THRESHOLD requires 1 <= thresholdCount <= ${branchRegions.length} (${splitDisplayName(split)}'s branch count), got ${threshold === undefined ? 'undefined' : threshold}.`);
        continue;
      }
    }
    for (const inEdge of joinIncoming) {
      const fromRegion = branchRegions.find((r) => r.nodes.has(inEdge.fromNodeKey));
      if (!fromRegion) {
        fail(split.key, `PARALLEL_JOIN "${joinKey}" has an incoming edge from "${inEdge.fromNodeKey}", which is not part of any branch owned by ${splitDisplayName(split)}.`);
        containmentOk = false;
      }
    }
    if (!containmentOk) continue;

    if (joinOwnedBySplit.has(joinKey)) {
      fail(split.key, `PARALLEL_JOIN "${joinKey}" is claimed as the resolved join by more than one split ("${joinOwnedBySplit.get(joinKey)}" and "${split.key}") — overlapping parallel regions.`);
      continue;
    }
    joinOwnedBySplit.set(joinKey, split.key);
    splitToJoin.set(split.key, joinKey);
    for (const region of branchRegions) {
      for (const nodeKey of region.nodes) nodeToBranch.set(nodeKey, { splitNodeKey: split.key, branchEdgeKey: region.branchEdgeKey });
    }
  }

  for (const join of joinNodes) {
    if (!joinOwnedBySplit.has(join.key)) {
      fail(join.key, `PARALLEL_JOIN "${join.key}" is not the resolved join of any PARALLEL_SPLIT or MULTI_MATCH DECISION — detached parallel region.`);
    }
  }

  for (const node of model.nodes) {
    if (node.kind !== 'PARALLEL_JOIN' || !reachable.has(node.key)) continue;
    if (node.cancelRemaining && node.mode !== 'ANY' && node.mode !== 'THRESHOLD') {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `PARALLEL_JOIN "${node.key}" sets cancelRemaining=true but mode is "${node.mode}" — cancelRemaining is only valid for ANY or THRESHOLD.`, nodeKey: node.key });
    }
  }

  return { issues, membership: { nodeToBranch, splitToJoin } };
}
