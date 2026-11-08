import { WorkflowDomainError, isWorkflowDomainError } from '../../errors';
import { createSimulationRun, transitionSimulationRunTerminal } from '../../workflowSimulationRunRepository';
import { getWorkflowRevisionById } from '../../workflowRevisionRepository';
import type { WorkflowSimulationRunRecord, WorkflowActorType } from '../../types';
import type { JsonValue } from '../../awm/types';
import { resolveSimulationSource } from './simulationSourceResolution';
import { computeMissingFixturePaths, fixtureSetFingerprint } from './simulationFixtures';
import { runSimulationFull, runSimulationFromNode, runSimulationSingleNode } from './simulationEngine';
import type { WorkflowSimulationSource, WorkflowSimulationFixtureSet, SimulationEvidenceEntry, SimulationExecutionOutcome } from './simulationTypes';

/**
 * `WorkflowSimulationService.RunSimulation` (doc 02 section 13) — orchestrates source resolution
 * (doc 02 section 8), the fixture-driven interpreter (`simulationEngine.ts`) and
 * `WorkflowSimulationRun` persistence (doc 03 section 9, Slice 1). A run is always created RUNNING
 * and transitions to exactly one expected-version terminal (SUCCEEDED/FAILED) — doc 11 section
 * 20A's "creation as RUNNING, one expected-version terminal winner and terminal immutability" is
 * satisfied by reusing the repository's pre-existing CAS transition (Slice 1), not new logic here.
 * `resultSummaryJson` carries the ordered sanitized simulation evidence — the sole persisted
 * artifact of a run; no production instance/node/attempt/wait/WorkItem row is ever touched.
 */

export type RunSimulationInput = {
  source: WorkflowSimulationSource;
  mode: { type: 'FULL'; workflowInput: JsonValue } | { type: 'NODE'; nodeKey: string; workflowInput: JsonValue; variables: Record<string, JsonValue>; nodeOutputs: Record<string, JsonValue>; currentNodeInput: JsonValue } | { type: 'FROM_NODE'; nodeKey: string; workflowInput: JsonValue; variables: Record<string, JsonValue>; nodeOutputs: Record<string, JsonValue>; currentNodeInput: JsonValue };
  fixtureSet: WorkflowSimulationFixtureSet;
  scenarioKey?: string;
  createdBy: { type: WorkflowActorType; id: number | null };
};

export type RunSimulationResult = {
  run: WorkflowSimulationRunRecord;
  outcome: SimulationExecutionOutcome;
  evidence: SimulationEvidenceEntry[];
  missingFixturePaths: Array<{ nodeKey: string; resolvedActionRef?: { actionKey: string; actionVersion: string } }>;
};

export async function runWorkflowSimulation(input: RunSimulationInput): Promise<RunSimulationResult> {
  const resolved = await resolveSimulationSource(input.source);

  const startNodeKey = input.mode.type === 'FULL' ? resolved.model.start.targetNodeKey : input.mode.nodeKey;
  const missingFixturePaths = computeMissingFixturePaths(resolved.model, resolved.actionBindings, input.fixtureSet, startNodeKey);

  const workflowDefinitionId =
    input.source.type === 'DRAFT' ? input.source.workflowDefinitionId : (await getWorkflowRevisionById(input.source.sourceRevisionId))!.workflowDefinitionId;

  const run = await createSimulationRun({
    workflowDefinitionId,
    sourceDraftVersion: resolved.sourceDraftVersion,
    sourceRevisionId: resolved.sourceRevisionId,
    simulationResolvedSnapshotFingerprint: resolved.simulationResolvedSnapshotFingerprint,
    mode: input.mode.type,
    startNodeKey,
    scenarioKey: input.scenarioKey ?? null,
    fixtureSetFingerprint: fixtureSetFingerprint(input.fixtureSet),
    createdByType: input.createdBy.type,
    createdById: input.createdBy.id,
  });

  try {
    const execution =
      input.mode.type === 'FULL'
        ? await runSimulationFull(resolved.model, resolved.actionBindings, input.fixtureSet, input.mode.workflowInput)
        : input.mode.type === 'NODE'
          ? await runSimulationSingleNode(resolved.model, resolved.actionBindings, input.fixtureSet, input.mode.nodeKey, { workflowInput: input.mode.workflowInput, variables: input.mode.variables, nodeOutputs: input.mode.nodeOutputs })
          : await runSimulationFromNode(resolved.model, resolved.actionBindings, input.fixtureSet, input.mode.nodeKey, { workflowInput: input.mode.workflowInput, variables: input.mode.variables, nodeOutputs: input.mode.nodeOutputs });

    const resultSummaryJson = JSON.stringify({ outcome: execution.outcome, evidence: execution.evidence, missingFixturePaths });
    const isSuccess = execution.outcome.status === 'SUCCEEDED' || execution.outcome.status === 'STOPPED_AT_NODE';
    const terminalRun = await transitionSimulationRunTerminal(run.id, run.stateVersion, isSuccess ? 'COMPLETE_SUCCESS' : 'COMPLETE_FAILURE', resultSummaryJson);

    return { run: terminalRun, outcome: execution.outcome, evidence: execution.evidence, missingFixturePaths };
  } catch (error) {
    const isDomainError = isWorkflowDomainError(error);
    const resultSummaryJson = JSON.stringify({
      outcome: { status: 'FAILED', errorCode: isDomainError ? error.code : 'WF_EXEC_ENGINE_INVARIANT', safeMessage: isDomainError ? error.message : 'Simulation failed unexpectedly.' },
      evidence: [],
      missingFixturePaths,
    });
    const terminalRun = await transitionSimulationRunTerminal(run.id, run.stateVersion, 'COMPLETE_FAILURE', resultSummaryJson);
    if (isDomainError) {
      throw new WorkflowDomainError(error.code, error.message, { ...error.details, simulationRunId: terminalRun.id });
    }
    throw error;
  }
}
