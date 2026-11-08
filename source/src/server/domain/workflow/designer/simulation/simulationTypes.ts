import type { JsonValue, WorkflowModel } from '../../awm/types';
import type { ResolvedActionNodeBinding } from '../../publication/validationTypes';

/**
 * Simulation type authority — doc 02 section 8 (`WorkflowSimulationSource`), doc 08 section 8
 * (Simulation UX), doc 09 section 5 (side-effect fence), doc 11 section 6 (mandatory tests). All
 * types here are simulation-scoped evidence shapes; none of them are, or are derived from,
 * production instance/node/attempt/wait/WorkItem storage (doc 02 section 8: "Simulation
 * repositories are isolated from production... state").
 */

export type WorkflowSimulationSource = { type: 'DRAFT'; workflowDefinitionId: number; expectedDraftVersion: number } | { type: 'REVISION'; sourceRevisionId: number };

export type WorkflowSimulationModeInput =
  | { mode: 'FULL'; workflowInput: JsonValue }
  | { mode: 'NODE'; nodeKey: string; workflowInput: JsonValue; variables: Record<string, JsonValue>; nodeOutputs: Record<string, JsonValue>; currentNodeInput: JsonValue }
  | { mode: 'FROM_NODE'; nodeKey: string; workflowInput: JsonValue; variables: Record<string, JsonValue>; nodeOutputs: Record<string, JsonValue>; currentNodeInput: JsonValue };

/**
 * Per-node fixture (doc 08 section 8: "Panel lists missing fixture paths and exact Action
 * key/version"). Keyed by semantic node key — the natural authoring unit — because a DRAFT
 * simulation resolves exact Action key/version *before* fixture lookup (doc 11 section 6), so the
 * exact Action identity is already known and reported alongside a missing-fixture diagnostic
 * without needing it as the lookup key itself.
 */
export type NodeSimulationFixture =
  | { kind: 'ACTION_RESULT'; output: JsonValue }
  | { kind: 'ACTION_FAILURE'; errorCode: string; errorClass: string; safeMessage: string }
  | { kind: 'WAIT_EVENT_RESOLUTION'; outcome: 'EVENT'; eventPayload: JsonValue }
  | { kind: 'WAIT_EVENT_RESOLUTION'; outcome: 'TIMEOUT' }
  | { kind: 'WORK_ITEM_RESOLUTION'; outcomeKey: string; output: JsonValue }
  | { kind: 'SUBFLOW_RESOLUTION'; status: 'SUCCEEDED'; output: JsonValue }
  | { kind: 'SUBFLOW_RESOLUTION'; status: 'FAILED'; errorCode: string }
  /** p-99/WFT-9 — Cancel Region: only legal when the SUBFLOW node declares `cancelEvent`. */
  | { kind: 'SUBFLOW_RESOLUTION'; status: 'CANCELLED_BY_REGION_EVENT'; eventPayload: JsonValue };

export type WorkflowSimulationFixtureSet = { fixtures: Record<string, NodeSimulationFixture> };

export type SimulationResolvedSource = {
  model: WorkflowModel;
  actionBindings: ResolvedActionNodeBinding[];
  simulationResolvedSnapshotFingerprint: string;
  sourceDraftVersion: number | null;
  sourceRevisionId: number | null;
};

export type SimulationEvidenceEntry = {
  sequence: number;
  type:
    | 'WORKFLOW_INPUT_RECORDED'
    | 'NODE_ENTERED'
    | 'NODE_DATA_RECORDED'
    | 'EXPRESSION_EVALUATED'
    | 'EDGE_SELECTED'
    | 'ACTION_FIXTURE_APPLIED'
    | 'ACTION_LIVE_PURE_EXECUTED'
    | 'FOR_EACH_EXECUTED'
    | 'LOOP_EXECUTED'
    | 'WAIT_RESOLVED_BY_FIXTURE'
    | 'INSTANCE_SUCCEEDED'
    | 'INSTANCE_FAILED';
  nodeKey: string | null;
  simulation: true;
  detail: Record<string, JsonValue | null>;
};

export type SimulationExecutionOutcome =
  | { status: 'SUCCEEDED'; output: JsonValue }
  | { status: 'FAILED'; errorCode: string; safeMessage: string }
  | { status: 'STOPPED_AT_NODE'; nodeKey: string };

export type SimulationExecutionResult = {
  outcome: SimulationExecutionOutcome;
  evidence: SimulationEvidenceEntry[];
  missingFixturePaths: Array<{ nodeKey: string; resolvedActionRef?: { actionKey: string; actionVersion: string } }>;
};
