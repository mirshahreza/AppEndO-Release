import type { ChangeOperationType } from '../../api/contracts/appendoo/changeGraph.types';
import { buildSemanticPlan } from './semanticPlanBuilder';
import { buildGeSfUi001ContextPack, GE_SF_UI_001_PROMPT } from './goldenEvalServerFunctionUi';
import { compileChangeGraphFromPlan } from './changeGraphCompiler';
import {
  annotateChangeGraphCapabilitySnapshot,
  validateChangeGraphDrift,
} from './changeGraphDriftScaffold';
import { assertValidChangeNodeTransition } from './changeGraphStateMachine';
import {
  createEngineeringWorkspaceScaffold,
  createRepairRevisionScaffold,
} from './engineeringWorkspaceScaffold';
import { initializeSchedulerGraph, scheduleChangeGraphExecution } from './changeGraphScheduler';
import { summarizeBuilderOrchestration } from './builderOrchestrationScaffold';

export type ChangeGraphWorkspaceHealthProbe = {
  ok: boolean;
  stateMachineVersion: string;
  builderOrchestrationVersion: string;
  failures: string[];
};

/** AE-7.6/AE-8.1 — health probe for change graph + workspace + builder orchestration depth. */
export const probeChangeGraphWorkspaceScaffold = (): ChangeGraphWorkspaceHealthProbe => {
  const failures: string[] = [];

  const transition = assertValidChangeNodeTransition('READY', 'BUILDING');
  if (!transition.ok) {
    failures.push(transition.reason);
  }
  const invalid = assertValidChangeNodeTransition('PLANNED', 'VERIFIED');
  if (invalid.ok) {
    failures.push('State machine should reject PLANNED → VERIFIED.');
  }

  const contextPack = buildGeSfUi001ContextPack();

  const plan = buildSemanticPlan({
    applicationScope: {
      kind: 'platform',
      scopeKey: 'platform:studio:page:server-functions',
      mountId: 'studio',
      pageKey: 'server-functions',
    },
    contextPack,
    userPrompt: GE_SF_UI_001_PROMPT,
  });

  if (plan.authority === 'SCAFFOLD') {
    failures.push('Expected validated vertical-slice plan for change graph health probe.');
  }

  const graph = annotateChangeGraphCapabilitySnapshot(compileChangeGraphFromPlan(plan));
  const drift = validateChangeGraphDrift(graph);
  if (!drift.ok) {
    failures.push(...drift.failures);
  }

  const scheduled = scheduleChangeGraphExecution(
    initializeSchedulerGraph(graph),
    () => ({ ok: true }),
    (result) => result.ok,
    { persistCheckpoint: false },
  );
  if (scheduled.summary.verifiedCount === 0) {
    failures.push('Scheduler did not verify any nodes in sample graph.');
  }

  const workspace = createEngineeringWorkspaceScaffold({
    changeSetId: graph.changeSetId,
    applicationScope: {
      kind: 'platform',
      scopeKey: graph.applicationScopeRef,
      mountId: 'studio',
      pageKey: 'server-functions',
    },
  });
  const repair = createRepairRevisionScaffold(
    workspace.workspace,
    workspace.revision,
    { reason: 'verification_failed' },
  );
  if (repair.revisionNumber !== 2) {
    failures.push('Repair revision should increment to R2.');
  }

  const orchestration = summarizeBuilderOrchestration();
  if (orchestration.registeredBuilderCount < 5) {
    failures.push('Builder registry count too low.');
  }

  const operationCoverage = new Set<ChangeOperationType>(
    graph.nodes.map((node) => node.operationType),
  );
  if (operationCoverage.size === 0) {
    failures.push('Compiled graph has no operations.');
  }

  return {
    ok: failures.length === 0,
    stateMachineVersion: '1.0.0',
    builderOrchestrationVersion: orchestration.version,
    failures,
  };
};
