import { buildSemanticPlan } from './semanticPlanBuilder';
import { buildGeSfUi001ContextPack, GE_SF_UI_001_PROMPT } from './goldenEvalServerFunctionUi';
import { compileChangeGraphFromPlan } from './changeGraphCompiler';
import {
  formatEngineeringUxPhaseLabel,
  listVisibleArchitectViews,
  resolveEngineeringUxPhase,
  shouldShowArchitectWorkspace,
} from './architectUxScaffold';
import { toEngineeringPipelineSnapshot } from '../../api/contracts/appendoo/engineeringPipeline.types';
import { buildEngineeringPipelineStreamEvent } from '../../api/contracts/appendoo/engineeringPipeline.types';
import { runVerificationScaffold } from './verificationEngineScaffold';

export type ArchitectUxHealthProbe = {
  ok: boolean;
  version: string;
  failures: string[];
};

/** AE-10.6 — health probe for architect workspace UX composition. */
export const probeArchitectUxScaffold = (): ArchitectUxHealthProbe => {
  const failures: string[] = [];

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

  const graph = compileChangeGraphFromPlan(plan);
  const verification = runVerificationScaffold({
    workspaceId: 'ws-ux-health',
    revisionId: 'rev-ux-health',
    revisionFingerprint: 'fp-ux-health',
    changeSetId: graph.changeSetId,
    mutationPaths: ['appendoo/ws/cs-1/workspace/server-functions/custom/export.ts'],
  });

  const pipelineEvent = buildEngineeringPipelineStreamEvent({
    planId: plan.planId,
    planRevision: plan.revision,
    planObjective: plan.objective,
    artifactCount: plan.proposedArtifacts.length,
    capabilityGapCount: plan.capabilityGaps.length,
    changeGraphId: graph.changeGraphId,
    changeNodeCount: graph.nodes.length,
    changeGraphReadyCount: graph.nodes.filter((node) => node.state === 'READY').length,
    changeGraphVerifiedCount: 0,
    changeGraphFailedCount: 0,
    changeGraphNodePreview: graph.nodes.slice(0, 4).map((node) => ({
      nodeId: node.nodeId,
      operationType: node.operationType,
      state: node.state,
    })),
    verificationRunId: verification.verificationRunId,
    deployable: verification.deployable,
    verificationPassCount: verification.graderResults.filter((item) => item.grade === 'PASS').length,
    verificationFailCount: verification.graderResults.filter((item) => item.grade === 'FAIL').length,
    verificationGraderSummary: verification.graderResults.map((item) => ({
      graderId: item.graderId,
      grade: item.grade,
      layer: item.layer,
    })),
    executedNodeCount: 0,
    failedNodeCount: 0,
    requiresApproval: true,
    approvalStatus: plan.status === 'READY_FOR_APPROVAL' ? 'pending' : undefined,
    planStatus: plan.status,
    planAuthority: plan.authority,
    planActionPolicy: {
      canApprove: plan.status === 'READY_FOR_APPROVAL',
      canRevise: false,
      canExecute: false,
      blockingReasonCodes: [],
    },
  });

  const snapshot = toEngineeringPipelineSnapshot({
    type: 'request_routing',
    requestClass: 'ENGINEERING_CHANGE',
    taskProfile: 'engineering_change',
    routerVersion: '1.0.0',
    routingReason: 'Engineering change detected.',
    useEngineeringPipeline: true,
    applicationScopeKey: 'platform:studio:page:server-functions',
    applicationScopeKind: 'platform',
    contextPackId: contextPack.contextPackId,
    contextPackTargetCount: contextPack.primaryTargets.length,
    contextPackStandardsCount: contextPack.engineeringStandards.length,
  });

  const views = listVisibleArchitectViews(snapshot, pipelineEvent);
  if (!views.includes('plan') || !views.includes('change_graph')) {
    failures.push('Expected plan and change_graph views for engineering pipeline.');
  }

  const phase = resolveEngineeringUxPhase(pipelineEvent);
  if (formatEngineeringUxPhaseLabel(phase).length === 0) {
    failures.push('UX phase label missing.');
  }

  if (!shouldShowArchitectWorkspace(snapshot, pipelineEvent)) {
    failures.push('Architect workspace should be visible for engineering pipeline.');
  }

  if ((pipelineEvent.verificationGraderSummary?.length ?? 0) < 10) {
    failures.push('Verification grader summary too short for matrix panel.');
  }

  return {
    ok: failures.length === 0,
    version: '1.0.0',
    failures,
  };
};
