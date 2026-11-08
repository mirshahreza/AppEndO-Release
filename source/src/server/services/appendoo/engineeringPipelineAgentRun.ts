import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import type { AgentStreamEngineeringPipelineEvent } from '../../../shared/api/contracts/ai/agentTypes';
import type { ContextPack } from '../../../shared/api/contracts/appendoo/contextPack.types';
import type { TurnExecutionProfile } from '../../../core/ai/agent/turnExecutionProfile';
import {
  mapChangeGraphDriftToStreamFields,
  mapChangeGraphToStreamFields,
} from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import type { EngineeringPipelineRunResult } from './engineeringPipeline.service';
import {
  extractServerFunctionIdFromPlan,
  isServerFunctionUiPipelinePlan,
} from '../../../shared/lib/appendoo/serverFunctionUiPipeline';
import { resolvePlanActionPolicy } from '../../../shared/lib/appendoo/semanticPlanAuthorityGates';

/** Agent implement mode auto-runs the engineering pipeline — no manual Approve & build. */
export const shouldAutoExecuteEngineeringPipelineInAgent = (input: {
  mode: AgentMode;
  executionProfile: TurnExecutionProfile;
  useEngineeringPipeline: boolean;
}): boolean => (
  input.mode === 'agent'
  && input.executionProfile === 'agent_implement'
  && input.useEngineeringPipeline
);

/**
 * V5 Phase P08 § V5-12 — extracted from `agent.service.ts`'s previously-inline condition
 * (`shouldBuildContextPack`, `AgentService.runStream` around the routing-resolution block).
 * Verbatim logic, zero behavior change — same pattern as `shouldAutoExecuteEngineeringPipelineInAgent`
 * above (which was already extracted pre-V5), now real and independently testable.
 */
export const shouldBuildEngineeringContextPack = (routing: {
  useEngineeringPipeline: boolean;
  requestClass: string;
}): boolean => (
  routing.useEngineeringPipeline && (
    routing.requestClass === 'ENGINEERING_CHANGE'
    || routing.requestClass === 'ENGINEERING_QUERY'
    || routing.requestClass === 'CONTEXT_QUERY'
  )
);

/**
 * V5 Phase P08 § V5-12 — names the real, currently-inline decision `agent.service.ts` makes
 * about which of the 4 possible execution paths a turn takes (pipeline-auto-executed /
 * pipeline-needs-more-context / pipeline-scaffold-only-no-autoexecute / agent-loop-fallthrough).
 * This does NOT replace the inline control flow in `agent.service.ts` (see
 * PHASE-EVIDENCE-REPORT-P08.md § Remaining for why: near-zero direct test coverage of that
 * control flow makes a full collapse to a single `AgentRuntime.run()` entry point too risky to
 * do blind this phase) — it gives that decision a real, named, testable shape as the first step
 * toward it, and is used by the new characterization tests
 * (`agentPipelineRouting.characterization.test.ts`) that lock in today's actual behavior.
 */
export type AgentExecutionPath =
  | 'PIPELINE_AUTO_EXECUTED'
  | 'PIPELINE_NEEDS_MORE_CONTEXT'
  | 'PIPELINE_SCAFFOLD_AWAITING_APPROVAL'
  | 'AGENT_LOOP';

export const classifyAgentExecutionPath = (input: {
  shouldBuildContextPack: boolean;
  contextPackBuilt: boolean;
  useEngineeringPipeline: boolean;
  shouldAutoExecutePipeline: boolean;
  pipelineCanApprove?: boolean;
  pipelineAutoExecuted: boolean;
}): AgentExecutionPath => {
  const pipelineRan = input.shouldBuildContextPack && input.contextPackBuilt && input.useEngineeringPipeline;

  if (pipelineRan && input.shouldAutoExecutePipeline && input.pipelineAutoExecuted) {
    return 'PIPELINE_AUTO_EXECUTED';
  }
  if (pipelineRan && input.shouldAutoExecutePipeline && input.pipelineCanApprove === false) {
    return 'PIPELINE_NEEDS_MORE_CONTEXT';
  }
  if (pipelineRan && !input.shouldAutoExecutePipeline) {
    return 'PIPELINE_SCAFFOLD_AWAITING_APPROVAL';
  }
  return 'AGENT_LOOP';
};

export const buildEngineeringPipelineStreamPayload = (input: {
  scaffold: EngineeringPipelineRunResult;
  contextPack: ContextPack;
  executed?: EngineeringPipelineRunResult;
  requiresApproval: boolean;
  requiresPromotionApproval?: boolean;
  approvalStatus?: AgentStreamEngineeringPipelineEvent['approvalStatus'];
}): Omit<AgentStreamEngineeringPipelineEvent, 'type'> => {
  const source = input.executed ?? input.scaffold;
  const planActionPolicy = input.scaffold.planActionPolicy;

  return {
    planId: input.scaffold.plan.planId,
    planRevision: input.scaffold.plan.revision,
    planObjective: input.scaffold.plan.objective,
    planStatus: input.scaffold.plan.status,
    planAuthority: input.scaffold.plan.authority,
    planActionPolicy,
    planningBlockers: input.scaffold.plan.blockingIssues,
    artifactCount: input.scaffold.planSummary.artifactCount,
    capabilityGapCount: input.scaffold.planSummary.capabilityGapCount,
    changeGraphId: input.scaffold.changeGraph?.changeGraphId ?? 'blocked',
    changeNodeCount: input.scaffold.changeGraphSummary?.nodeCount ?? 0,
    ...mapChangeGraphToStreamFields(input.executed?.changeGraph ?? input.scaffold.changeGraph ?? {
      changeGraphId: 'blocked',
      changeSetId: 'blocked',
      applicationScopeRef: input.scaffold.plan.applicationScopeRef,
      revision: input.scaffold.plan.revision,
      compilerVersion: 'blocked',
      nodes: [],
      edges: [],
    }),
    ...mapChangeGraphDriftToStreamFields({
      ok: source.changeGraphDriftOk ?? input.scaffold.changeGraphDriftOk ?? true,
      staleNodeIds: Array.from({ length: source.changeGraphDriftStaleCount ?? input.scaffold.changeGraphDriftStaleCount ?? 0 }),
      failures: source.builderOrchestrationErrors ?? input.scaffold.builderOrchestrationErrors ?? [],
    }),
    changeSetId: input.scaffold.changeGraph?.changeSetId,
    contextPackRevision: input.contextPack.revision,
    approvalBindingId: input.scaffold.approvalBinding?.bindingId,
    approvalStatus: input.approvalStatus ?? (input.executed ? 'approved' : input.scaffold.approvalBinding?.status),
    workspaceId: source.workspaceId,
    revisionId: source.revisionId,
    executedNodeCount: source.executedNodeCount,
    failedNodeCount: source.failedNodeCount,
    reconciledNodeCount: source.reconciledNodeCount,
    verificationRunId: source.verificationRunId,
    deployable: source.deployable,
    verificationPassCount: source.verificationPassCount,
    verificationFailCount: source.verificationFailCount,
    promotionRunId: source.promotionRunId,
    promotionState: source.promotionState,
    promotionPreflightOk: source.promotionPreflightOk,
    packageSnapshotId: source.packageSnapshotId,
    packageRoundtripValidated: source.packageRoundtripValidated,
    runtimeActivatedCount: source.runtimeActivatedCount,
    runtimeActivationFailedCount: source.runtimeActivationFailedCount,
    checkpointId: source.checkpointId,
    revisionFingerprint: source.revisionFingerprint,
    mutationPathCount: source.mutationPathCount,
    mutationPathPreview: source.mutationPathPreview,
    workspaceStorageKind: source.workspaceStorageKind,
    verifiedNodeCount: source.verifiedNodeCount,
    revisionNumber: source.revisionNumber,
    parentRevisionId: source.parentRevisionId,
    workspaceState: source.workspaceState,
    revisionState: source.revisionState,
    workspaceLineageLabel: source.workspaceLineageLabel,
    failedRevisionId: source.failedRevisionId,
    repairRevisionId: source.repairRevisionId,
    repairRevisionNumber: source.repairRevisionNumber,
    repairReExecuted: source.repairReExecuted,
    verificationGraderSummary: source.verificationGraderSummary,
    requiresApproval: input.requiresApproval && (planActionPolicy?.canApprove ?? false),
    requiresPromotionApproval: input.requiresPromotionApproval ?? false,
    promotionApprovalRequired: source.promotionApprovalRequired,
    promotionApprovalBindingId: source.promotionApprovalBindingId,
    designerHandoff: source.designerHandoff,
  };
};

export const formatEngineeringPipelineAgentResultMessage = (
  executed: EngineeringPipelineRunResult,
): string => {
  if (executed.failedNodeCount > 0 || executed.promotionState === 'FAILED') {
    return 'Build failed — review the verification panel below for details.';
  }

  if (executed.deployable && executed.promotionState === 'DEPLOYED') {
    const design = executed.plan.uiSemanticDesign;
    const handoff = executed.designerHandoff?.[0];
    if (handoff?.componentPath && design) {
      const inputSummary = design.inputBindings.map((binding) => binding.label).join(', ');
      return [
        `Built a form UI for **${design.boundOperations[0]?.serverFunctionRef.ref ?? executed.plan.objective}**`,
        inputSummary ? `with inputs: ${inputSummary}.` : '.',
        `Published at \`${handoff.componentPath}\` — open it in Designer below.`,
      ].join(' ');
    }
    if (handoff?.componentPath) {
      return `Done — UI published at ${handoff.componentPath}. Use Open in Designer below.`;
    }
    if (isServerFunctionUiPipelinePlan(executed.plan)) {
      const functionId = extractServerFunctionIdFromPlan(executed.plan);
      return functionId
        ? `Done — UI built and published for ${functionId}.`
        : 'Done — UI built and published.';
    }
    return `Done — ${executed.plan.objective}`;
  }

  return 'Pipeline finished — review the engineering status panel for details.';
};
