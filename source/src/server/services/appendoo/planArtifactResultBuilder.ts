import type { DesignerHandoffPayload } from '../../../shared/api/contracts/ai/agentTypes';
import type { EngineeringVerificationGraderPreview } from '../../../shared/api/contracts/ai/agentTypes';
import type { ChangeGraph } from '../../../shared/api/contracts/appendoo/changeGraph.types';
import type { ContextPack } from '../../../shared/api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../../shared/api/contracts/appendoo/semanticPlan.types';
import type { SemanticPlanApprovalBinding } from '../../../shared/api/contracts/appendoo/semanticPlanApproval.types';
import type { PromotionState } from '../../../shared/api/contracts/appendoo/promotion.types';
import type {
  EngineeringWorkspace,
  WorkspaceRevision,
  WorkspaceStorageRef,
} from '../../../shared/api/contracts/appendoo/engineeringWorkspace.types';
import { summarizeChangeGraph } from '../../../shared/lib/appendoo/changeGraphCompiler';
import { resolvePlanActionPolicy } from '../../../shared/lib/appendoo/semanticPlanAuthorityGates';
import { summarizeSemanticPlan } from '../../../shared/lib/appendoo/semanticPlanBuilder';
import type { EngineeringPipelineRunResult } from './engineeringPipeline.service';

/**
 * V5 Phase P08 § V5-12 — extracted from `EngineeringPipelineService.buildResult` (a private
 * method, verbatim moved, zero behavior change). This is the doc's named low-risk decomposition
 * candidate: a pure, side-effect-free result assembler with no shared mutable state — the doc's
 * "PlanArtifactService" concern, minus the parts of that name that would imply it also OWNS
 * plan-building (it doesn't; `semanticPlanBuilder.ts` still owns that). `EngineeringPipelineService`
 * now delegates to this at all 5 of its original call sites instead of holding this logic inline.
 */
export type PlanArtifactResultInput = {
  plan: AppEndooSemanticPlan;
  planActionPolicy?: ReturnType<typeof resolvePlanActionPolicy>;
  changeGraph?: ChangeGraph;
  contextPack: ContextPack;
  approvalBinding?: SemanticPlanApprovalBinding;
  workspaceId?: string;
  revisionId?: string;
  executedNodeCount: number;
  failedNodeCount: number;
  reconciledNodeCount: number;
  verificationRunId?: string;
  deployable?: boolean;
  verificationPassCount?: number;
  verificationFailCount?: number;
  promotionRunId?: string;
  promotionState?: PromotionState;
  promotionPreflightOk?: boolean;
  promotionApprovalRequired?: boolean;
  promotionApprovalBindingId?: string;
  packageSnapshotId?: string;
  packageRoundtripValidated?: boolean;
  verifiedNodeCount?: number;
  runtimeActivatedCount?: number;
  runtimeActivationFailedCount?: number;
  checkpointId?: string;
  revisionFingerprint?: string;
  mutationPathCount?: number;
  mutationPathPreview?: string[];
  workspaceStorageKind?: WorkspaceStorageRef['kind'];
  revisionNumber?: number;
  parentRevisionId?: string;
  workspaceState?: EngineeringWorkspace['state'];
  revisionState?: WorkspaceRevision['state'];
  workspaceLineageLabel?: string;
  failedRevisionId?: string;
  repairRevisionId?: string;
  repairRevisionNumber?: number;
  repairReExecuted?: boolean;
  verificationGraderSummary?: EngineeringVerificationGraderPreview[];
  changeGraphDriftOk?: boolean;
  changeGraphDriftStaleCount?: number;
  builderOrchestrationErrorCount?: number;
  builderOrchestrationErrors?: string[];
  designerHandoff?: DesignerHandoffPayload[];
};

export const buildEngineeringPipelineRunResult = (
  input: PlanArtifactResultInput,
): EngineeringPipelineRunResult => {
  const planActionPolicy = input.planActionPolicy ?? resolvePlanActionPolicy(input.plan);
  return {
    plan: input.plan,
    planSummary: summarizeSemanticPlan(input.plan),
    planActionPolicy,
    changeGraph: input.changeGraph,
    changeGraphSummary: input.changeGraph ? summarizeChangeGraph(input.changeGraph) : undefined,
    changeSetId: input.changeGraph?.changeSetId,
    contextPack: input.contextPack,
    approvalBinding: input.approvalBinding,
    workspaceId: input.workspaceId,
    revisionId: input.revisionId,
    executedNodeCount: input.executedNodeCount,
    failedNodeCount: input.failedNodeCount,
    reconciledNodeCount: input.reconciledNodeCount,
    verificationRunId: input.verificationRunId,
    deployable: input.deployable,
    verificationPassCount: input.verificationPassCount,
    verificationFailCount: input.verificationFailCount,
    promotionRunId: input.promotionRunId,
    promotionState: input.promotionState,
    promotionPreflightOk: input.promotionPreflightOk,
    promotionApprovalRequired: input.promotionApprovalRequired,
    promotionApprovalBindingId: input.promotionApprovalBindingId,
    packageSnapshotId: input.packageSnapshotId,
    packageRoundtripValidated: input.packageRoundtripValidated,
    verifiedNodeCount: input.verifiedNodeCount,
    runtimeActivatedCount: input.runtimeActivatedCount,
    runtimeActivationFailedCount: input.runtimeActivationFailedCount,
    checkpointId: input.checkpointId,
    revisionFingerprint: input.revisionFingerprint,
    mutationPathCount: input.mutationPathCount,
    mutationPathPreview: input.mutationPathPreview,
    workspaceStorageKind: input.workspaceStorageKind,
    revisionNumber: input.revisionNumber,
    parentRevisionId: input.parentRevisionId,
    workspaceState: input.workspaceState,
    revisionState: input.revisionState,
    workspaceLineageLabel: input.workspaceLineageLabel,
    failedRevisionId: input.failedRevisionId,
    repairRevisionId: input.repairRevisionId,
    repairRevisionNumber: input.repairRevisionNumber,
    repairReExecuted: input.repairReExecuted,
    verificationGraderSummary: input.verificationGraderSummary,
    changeGraphDriftOk: input.changeGraphDriftOk,
    changeGraphDriftStaleCount: input.changeGraphDriftStaleCount,
    builderOrchestrationErrorCount: input.builderOrchestrationErrorCount,
    builderOrchestrationErrors: input.builderOrchestrationErrors,
    designerHandoff: input.designerHandoff,
  };
};
