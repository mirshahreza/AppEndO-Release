import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { DesignerHandoffPayload } from '../../../shared/api/contracts/ai/agentTypes';
import type { ApplicationScopeRef } from '../../../shared/api/contracts/appendoo/applicationScope.types';
import type { ChangeGraph } from '../../../shared/api/contracts/appendoo/changeGraph.types';
import type { ContextPack } from '../../../shared/api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../../shared/api/contracts/appendoo/semanticPlan.types';
import type { SemanticPlanApprovalBinding } from '../../../shared/api/contracts/appendoo/semanticPlanApproval.types';
import { summarizeChangeGraph } from '../../../shared/lib/appendoo/changeGraphCompiler';
import {
  annotateChangeGraphCapabilitySnapshot,
  validateChangeGraphDrift,
} from '../../../shared/lib/appendoo/changeGraphDriftScaffold';
import {
  buildSemanticPlan,
  buildSemanticPlanScaffold,
  summarizeSemanticPlan,
} from '../../../shared/lib/appendoo/semanticPlanBuilder';
import { buildEngineeringPipelineRunResult } from './planArtifactResultBuilder';
import { compileChangeGraphFromPlan, ChangeGraphCompileForbiddenError } from '../../../shared/lib/appendoo/changeGraphCompiler';
import { enrichContextPackForServerFunctionUiPlanning } from '../../../shared/lib/appendoo/serverFunctionUiPlanner';
import {
  resolvePlanActionPolicy,
} from '../../../shared/lib/appendoo/semanticPlanAuthorityGates';
import { scheduleChangeGraphExecution } from '../../../shared/lib/appendoo/changeGraphScheduler';
import { changeGraphCheckpointStore } from '../../../shared/lib/appendoo/changeGraphCheckpointStore';
import { workspaceArtifactStore } from '../../../shared/lib/appendoo/workspaceArtifactStore';
import { runtimeActivationService } from './runtimeActivation.service';
import { buildDesignerHandoffFromActivationBatch } from './engineeringDesignerHandoff';
import { builderProtocolService } from './builderProtocol.service';
import { engineeringWorkspaceService } from './engineeringWorkspace.service';
import { semanticPlanApprovalService } from './semanticPlanApproval.service';
import { semanticPlanningService } from './semanticPlanning.service';
import { verificationEngineService } from './verificationEngine.service';
import { promotionService } from './promotion.service';
import { packageSnapshotStore } from '../../../shared/lib/appendoo/packageSnapshotStore';
import { summarizeWorkspaceMutationDiff } from '../../../shared/lib/appendoo/workspaceDiffScaffold';
import { summarizeWorkspaceLineage } from '../../../shared/lib/appendoo/workspaceLineageScaffold';
import { repairWorkspaceAfterVerificationFailure } from '../../../shared/lib/appendoo/workspaceRepairScaffold';
import { validateRepairRevisionForReExecute } from '../../../shared/lib/appendoo/workspaceRepairReExecuteScaffold';
import type { PromotionState } from '../../../shared/api/contracts/appendoo/promotion.types';
import type {
  EngineeringVerificationGraderPreview,
} from '../../../shared/api/contracts/ai/agentTypes';
import type { VerificationGraderResult, VerificationRun } from '../../../shared/api/contracts/appendoo/verificationEngine.types';
import type {
  EngineeringWorkspace,
  WorkspaceRevision,
  WorkspaceStorageRef,
} from '../../../shared/api/contracts/appendoo/engineeringWorkspace.types';

export type RunEngineeringPipelineInput = {
  applicationScope: ApplicationScopeRef | null;
  pageContext?: AiPageContext;
  userPrompt?: string;
  executeBuilders?: boolean;
  requiresApproval?: boolean;
  requiresPromotionApproval?: boolean;
  approvalBindingId?: string;
  contextPack?: ContextPack;
};

export type EngineeringPipelineRunResult = {
  plan: AppEndooSemanticPlan;
  planSummary: ReturnType<typeof summarizeSemanticPlan>;
  planActionPolicy: ReturnType<typeof resolvePlanActionPolicy>;
  changeGraph?: ChangeGraph;
  changeGraphSummary?: ReturnType<typeof summarizeChangeGraph>;
  changeSetId?: string;
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
  runtimeActivatedCount?: number;
  runtimeActivationFailedCount?: number;
  checkpointId?: string;
  verifiedNodeCount?: number;
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

type PendingPromotionApproval = {
  bindingId: string;
  workspaceId: string;
  revisionId: string;
  changeSetId: string;
  mutationPaths: string[];
  mutationRecords: Array<{ path?: string; artifactId: string }>;
  verificationRun: VerificationRun;
};

/** Builder execution + optional verify/promote slice (union branches share this shape for callers). */
type ExecuteChangeGraphResult = {
  approvalBinding?: SemanticPlanApprovalBinding;
  workspaceId?: string;
  revisionId?: string;
  executedNodeCount: number;
  failedNodeCount: number;
  reconciledNodeCount: number;
  verifiedNodeCount: number;
  checkpointId?: string;
  workspaceStorageKind?: WorkspaceStorageRef['kind'];
  mutationPathCount?: number;
  mutationPathPreview?: string[];
  revisionNumber?: number;
  parentRevisionId?: string;
  workspaceState?: EngineeringWorkspace['state'];
  revisionState?: WorkspaceRevision['state'];
  workspaceLineageLabel?: string;
  builderOrchestrationErrors?: string[];
  builderOrchestrationErrorCount?: number;
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
  runtimeActivatedCount?: number;
  runtimeActivationFailedCount?: number;
  revisionFingerprint?: string;
  verificationGraderSummary?: EngineeringVerificationGraderPreview[];
  failedRevisionId?: string;
  repairRevisionId?: string;
  repairRevisionNumber?: number;
  designerHandoff?: DesignerHandoffPayload[];
};

export class EngineeringPipelineService {
  private readonly pendingPromotionApprovals = new Map<string, PendingPromotionApproval>();

  runScaffold(input: RunEngineeringPipelineInput): EngineeringPipelineRunResult {
    let contextPack = input.contextPack;
    let plan: AppEndooSemanticPlan;

    if (contextPack) {
      contextPack = enrichContextPackForServerFunctionUiPlanning(contextPack);
      plan = buildSemanticPlan({
        applicationScope: input.applicationScope,
        contextPack,
        userPrompt: input.userPrompt,
      });
    } else {
      const built = semanticPlanningService.buildPlanFromContextInput({
        applicationScope: input.applicationScope,
        pageContext: input.pageContext,
        userPrompt: input.userPrompt,
      });
      contextPack = enrichContextPackForServerFunctionUiPlanning(built.contextPack);
      plan = built.plan;
    }

    const planActionPolicy = resolvePlanActionPolicy(plan);
    let changeGraph: ChangeGraph | undefined;
    let changeGraphSummary: ReturnType<typeof summarizeChangeGraph> | undefined;
    let compileErrors: string[] | undefined;

    if (planActionPolicy.canApprove || plan.authority === 'APPROVED') {
      try {
        changeGraph = annotateChangeGraphCapabilitySnapshot(compileChangeGraphFromPlan(plan));
        changeGraphSummary = summarizeChangeGraph(changeGraph);
      } catch (error) {
        if (error instanceof ChangeGraphCompileForbiddenError) {
          compileErrors = error.errors;
        } else {
          throw error;
        }
      }
    }

    const driftValidation = changeGraph
      ? validateChangeGraphDrift(changeGraph)
      : { ok: true, staleNodeIds: [], failures: [] as string[] };
    const requiresApproval = input.requiresApproval ?? false;
    const requiresPromotionApproval = input.requiresPromotionApproval ?? false;

    const approvalBinding = planActionPolicy.canApprove && changeGraph
      ? semanticPlanApprovalService.registerPipelineRun({
        plan,
        changeGraph,
        contextPack,
        applicationScope: input.applicationScope,
        requiresApproval,
      })
      : undefined;

    if (input.executeBuilders && requiresApproval && !input.approvalBindingId) {
      return buildEngineeringPipelineRunResult({
        plan,
        planActionPolicy,
        changeGraph,
        contextPack,
        approvalBinding,
        executedNodeCount: 0,
        failedNodeCount: 0,
        reconciledNodeCount: 0,
        changeGraphDriftOk: driftValidation.ok,
        changeGraphDriftStaleCount: driftValidation.staleNodeIds.length,
        builderOrchestrationErrors: compileErrors ?? driftValidation.failures,
        builderOrchestrationErrorCount: (compileErrors ?? driftValidation.failures).length,
      });
    }

    if (input.executeBuilders) {
      if (!changeGraph) {
        throw new Error('Cannot execute builders without a compiled change graph.');
      }
      const executeResult = this.executeChangeGraph({
        changeGraph,
        contextPack,
        applicationScope: input.applicationScope,
        approvalBindingId: input.approvalBindingId,
        requiresApproval,
        requiresPromotionApproval,
        plan,
      });

      return buildEngineeringPipelineRunResult({
        plan,
        planActionPolicy,
        changeGraph,
        contextPack,
        approvalBinding: executeResult.approvalBinding ?? approvalBinding,
        workspaceId: executeResult.workspaceId,
        revisionId: executeResult.revisionId,
        executedNodeCount: executeResult.executedNodeCount,
        failedNodeCount: executeResult.failedNodeCount,
        reconciledNodeCount: executeResult.reconciledNodeCount,
        verificationRunId: executeResult.verificationRunId,
        deployable: executeResult.deployable,
        verificationPassCount: executeResult.verificationPassCount,
        verificationFailCount: executeResult.verificationFailCount,
        promotionRunId: executeResult.promotionRunId,
        promotionState: executeResult.promotionState,
        promotionPreflightOk: executeResult.promotionPreflightOk,
        promotionApprovalRequired: executeResult.promotionApprovalRequired,
        promotionApprovalBindingId: executeResult.promotionApprovalBindingId,
        packageSnapshotId: executeResult.packageSnapshotId,
        packageRoundtripValidated: executeResult.packageRoundtripValidated,
        verifiedNodeCount: executeResult.verifiedNodeCount,
        runtimeActivatedCount: executeResult.runtimeActivatedCount,
        runtimeActivationFailedCount: executeResult.runtimeActivationFailedCount,
        checkpointId: executeResult.checkpointId,
        revisionFingerprint: executeResult.revisionFingerprint,
        mutationPathCount: executeResult.mutationPathCount,
        mutationPathPreview: executeResult.mutationPathPreview,
        workspaceStorageKind: executeResult.workspaceStorageKind,
        revisionNumber: executeResult.revisionNumber,
        parentRevisionId: executeResult.parentRevisionId,
        workspaceState: executeResult.workspaceState,
        revisionState: executeResult.revisionState,
        workspaceLineageLabel: executeResult.workspaceLineageLabel,
        failedRevisionId: executeResult.failedRevisionId,
        repairRevisionId: executeResult.repairRevisionId,
        repairRevisionNumber: executeResult.repairRevisionNumber,
        changeGraphDriftOk: driftValidation.ok,
        changeGraphDriftStaleCount: driftValidation.staleNodeIds.length,
        builderOrchestrationErrors: executeResult.builderOrchestrationErrors,
        builderOrchestrationErrorCount: executeResult.builderOrchestrationErrorCount,
        verificationGraderSummary: executeResult.verificationGraderSummary,
        designerHandoff: executeResult.designerHandoff,
      });
    }

    return buildEngineeringPipelineRunResult({
      plan,
      planActionPolicy,
      changeGraph,
      contextPack,
      approvalBinding,
      executedNodeCount: 0,
      failedNodeCount: 0,
      reconciledNodeCount: 0,
      changeGraphDriftOk: driftValidation.ok,
      changeGraphDriftStaleCount: driftValidation.staleNodeIds.length,
      builderOrchestrationErrors: compileErrors ?? driftValidation.failures,
      builderOrchestrationErrorCount: (compileErrors ?? driftValidation.failures).length,
    });
  }

  executeApprovedBinding(bindingId: string): EngineeringPipelineRunResult {
    const stored = semanticPlanApprovalService.getStoredRun(bindingId);
    if (!stored) {
      throw new Error(`Approval binding ${bindingId} not found.`);
    }

    const validation = semanticPlanApprovalService.validateForExecution(bindingId);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }

    const driftValidation = validateChangeGraphDrift(stored.changeGraph);

    const executeResult = this.executeChangeGraph({
      changeGraph: stored.changeGraph,
      contextPack: stored.contextPack,
      applicationScope: stored.applicationScope,
      approvalBindingId: bindingId,
      requiresApproval: true,
      requiresPromotionApproval: false,
      plan: stored.plan,
    });

    return buildEngineeringPipelineRunResult({
      plan: stored.plan,
      planActionPolicy: resolvePlanActionPolicy({
        ...stored.plan,
        authority: 'APPROVED',
        status: 'APPROVED',
      }),
      changeGraph: stored.changeGraph,
      contextPack: stored.contextPack,
      approvalBinding: semanticPlanApprovalService.getBinding(bindingId),
      workspaceId: executeResult.workspaceId,
      revisionId: executeResult.revisionId,
      executedNodeCount: executeResult.executedNodeCount,
      failedNodeCount: executeResult.failedNodeCount,
      reconciledNodeCount: executeResult.reconciledNodeCount,
      verificationRunId: executeResult.verificationRunId,
      deployable: executeResult.deployable,
      verificationPassCount: executeResult.verificationPassCount,
      verificationFailCount: executeResult.verificationFailCount,
      promotionRunId: executeResult.promotionRunId,
      promotionState: executeResult.promotionState,
      promotionPreflightOk: executeResult.promotionPreflightOk,
      packageSnapshotId: executeResult.packageSnapshotId,
      packageRoundtripValidated: executeResult.packageRoundtripValidated,
      verifiedNodeCount: executeResult.verifiedNodeCount,
      runtimeActivatedCount: executeResult.runtimeActivatedCount,
      runtimeActivationFailedCount: executeResult.runtimeActivationFailedCount,
      checkpointId: executeResult.checkpointId,
      revisionFingerprint: executeResult.revisionFingerprint,
      mutationPathCount: executeResult.mutationPathCount,
      mutationPathPreview: executeResult.mutationPathPreview,
      workspaceStorageKind: executeResult.workspaceStorageKind,
      revisionNumber: executeResult.revisionNumber,
      parentRevisionId: executeResult.parentRevisionId,
      workspaceState: executeResult.workspaceState,
      revisionState: executeResult.revisionState,
      workspaceLineageLabel: executeResult.workspaceLineageLabel,
      failedRevisionId: executeResult.failedRevisionId,
      repairRevisionId: executeResult.repairRevisionId,
      repairRevisionNumber: executeResult.repairRevisionNumber,
      changeGraphDriftOk: driftValidation.ok,
      changeGraphDriftStaleCount: driftValidation.staleNodeIds.length,
      builderOrchestrationErrorCount: executeResult.builderOrchestrationErrorCount,
      builderOrchestrationErrors: executeResult.builderOrchestrationErrors,
      verificationGraderSummary: executeResult.verificationGraderSummary,
      designerHandoff: executeResult.designerHandoff,
    });
  }

  /** AE-10.6 — re-run builders + verify/promote on OPEN repair revision (R2 re-execute). */
  executeRepairRevision(input: {
    bindingId: string;
    workspaceId: string;
    repairRevisionId: string;
  }): EngineeringPipelineRunResult {
    const stored = semanticPlanApprovalService.getStoredRun(input.bindingId);
    if (!stored) {
      throw new Error(`Approval binding ${input.bindingId} not found.`);
    }

    const validation = validateRepairRevisionForReExecute(
      engineeringWorkspaceService,
      input.workspaceId,
      input.repairRevisionId,
    );
    if (validation.ok === false) {
      throw new Error(validation.reason);
    }

    const executeResult = this.executeChangeGraph({
      changeGraph: stored.changeGraph,
      contextPack: stored.contextPack,
      applicationScope: stored.applicationScope,
      approvalBindingId: input.bindingId,
      requiresApproval: true,
      plan: stored.plan,
      existingWorkspace: {
        workspaceId: input.workspaceId,
        revisionId: input.repairRevisionId,
      },
    });

    return buildEngineeringPipelineRunResult({
      plan: stored.plan,
      planActionPolicy: resolvePlanActionPolicy({
        ...stored.plan,
        authority: 'APPROVED',
        status: 'APPROVED',
      }),
      changeGraph: stored.changeGraph,
      contextPack: stored.contextPack,
      approvalBinding: semanticPlanApprovalService.getBinding(input.bindingId),
      workspaceId: executeResult.workspaceId,
      revisionId: executeResult.revisionId,
      executedNodeCount: executeResult.executedNodeCount,
      failedNodeCount: executeResult.failedNodeCount,
      reconciledNodeCount: executeResult.reconciledNodeCount,
      verificationRunId: executeResult.verificationRunId,
      deployable: executeResult.deployable,
      verificationPassCount: executeResult.verificationPassCount,
      verificationFailCount: executeResult.verificationFailCount,
      promotionRunId: executeResult.promotionRunId,
      promotionState: executeResult.promotionState,
      promotionPreflightOk: executeResult.promotionPreflightOk,
      packageSnapshotId: executeResult.packageSnapshotId,
      packageRoundtripValidated: executeResult.packageRoundtripValidated,
      verifiedNodeCount: executeResult.verifiedNodeCount,
      runtimeActivatedCount: executeResult.runtimeActivatedCount,
      runtimeActivationFailedCount: executeResult.runtimeActivationFailedCount,
      checkpointId: executeResult.checkpointId,
      revisionFingerprint: executeResult.revisionFingerprint,
      mutationPathCount: executeResult.mutationPathCount,
      mutationPathPreview: executeResult.mutationPathPreview,
      workspaceStorageKind: executeResult.workspaceStorageKind,
      revisionNumber: executeResult.revisionNumber,
      parentRevisionId: executeResult.parentRevisionId,
      workspaceState: executeResult.workspaceState,
      revisionState: executeResult.revisionState,
      workspaceLineageLabel: executeResult.workspaceLineageLabel,
      failedRevisionId: executeResult.failedRevisionId,
      repairRevisionId: executeResult.repairRevisionId,
      repairRevisionNumber: executeResult.repairRevisionNumber,
      repairReExecuted: true,
    });
  }

  executeApprovedPromotion(bindingId: string): Pick<
    EngineeringPipelineRunResult,
    | 'promotionRunId'
    | 'promotionState'
    | 'promotionPreflightOk'
    | 'packageSnapshotId'
    | 'packageRoundtripValidated'
    | 'runtimeActivatedCount'
    | 'runtimeActivationFailedCount'
  > {
    const pending = this.pendingPromotionApprovals.get(bindingId);
    if (!pending) {
      throw new Error(`Promotion approval binding ${bindingId} not found.`);
    }

    const promotion = promotionService.startPromotion({
      changeSetId: pending.changeSetId,
      workspaceId: pending.workspaceId,
      revisionId: pending.revisionId,
      revisionFingerprint: pending.verificationRun.revisionFingerprint,
      verificationRunId: pending.verificationRun.verificationRunId,
    }, pending.verificationRun);

    const executed = promotionService.executePromotion(promotion.run, pending.mutationPaths);
    const activation = runtimeActivationService.activateFromMutations(pending.mutationRecords);

    this.pendingPromotionApprovals.delete(bindingId);

    return {
      promotionRunId: executed.run.promotionRunId,
      promotionState: executed.run.state,
      promotionPreflightOk: executed.summary.preflightOk,
      packageSnapshotId: executed.run.packageSnapshotId,
      packageRoundtripValidated: executed.roundtripValidated,
      runtimeActivatedCount: activation.activatedCount + activation.validatedCount,
      runtimeActivationFailedCount: activation.failedCount,
    };
  }

  private executeChangeGraph(input: {
    changeGraph: ChangeGraph;
    contextPack: ContextPack;
    applicationScope: ApplicationScopeRef | null;
    approvalBindingId?: string;
    requiresApproval: boolean;
    requiresPromotionApproval?: boolean;
    plan?: AppEndooSemanticPlan;
    existingWorkspace?: {
      workspaceId: string;
      revisionId: string;
    };
  }): ExecuteChangeGraphResult {
    if (input.requiresApproval) {
      if (!input.approvalBindingId) {
        throw new Error('Approved binding id is required before builder execution.');
      }

      const validation = semanticPlanApprovalService.validateForExecution(input.approvalBindingId);
      if (!validation.ok) {
        throw new Error(validation.errors.join(' '));
      }
    }

    let workspaceId: string | undefined;
    let revisionId: string | undefined;
    let workspaceStorageKind: WorkspaceStorageRef['kind'] | undefined;
    let executedNodeCount = 0;
    let failedNodeCount = 0;
    let reconciledNodeCount = 0;
    let verifiedNodeCount = 0;
    const mutationPaths: string[] = [];
    const mutationRecords: Array<{ path?: string; artifactId: string }> = [];
    const builderOrchestrationErrors: string[] = [];

    if (input.changeGraph.nodes.length === 0) {
      return {
        approvalBinding: input.approvalBindingId
          ? semanticPlanApprovalService.getBinding(input.approvalBindingId)
          : undefined,
        workspaceId,
        revisionId,
        executedNodeCount,
        failedNodeCount,
        reconciledNodeCount,
        verifiedNodeCount,
      };
    }

    const workspace = input.existingWorkspace
      ? {
        workspace: engineeringWorkspaceService.getWorkspace(input.existingWorkspace.workspaceId)!,
        revision: engineeringWorkspaceService.getRevision(
          input.existingWorkspace.workspaceId,
          input.existingWorkspace.revisionId,
        )!,
      }
      : engineeringWorkspaceService.createWorkspace({
        changeSetId: input.changeGraph.changeSetId,
        applicationScope: input.applicationScope,
      });

    if (!workspace.workspace || !workspace.revision) {
      throw new Error('Engineering workspace revision is unavailable for builder execution.');
    }

    const executionGraph = annotateChangeGraphCapabilitySnapshot(input.changeGraph);
    const drift = validateChangeGraphDrift(executionGraph);
    if (!drift.ok) {
      throw new Error(drift.failures.join(' '));
    }

    workspaceId = workspace.workspace.workspaceId;
    revisionId = workspace.revision.revisionId;
    workspaceStorageKind = workspace.workspace.storageRef.kind;

    const scheduled = scheduleChangeGraphExecution(
      executionGraph,
      (node) => {
        const context = builderProtocolService.createContext({
          workspaceId: workspace.workspace.workspaceId,
          revisionId: workspace.revision.revisionId,
          changeSetId: input.changeGraph.changeSetId,
          changeNode: node,
          applicableStandards: input.contextPack.engineeringStandards,
          validatedCapabilities: node.requiredCapabilityIds.map((capabilityId) => ({
            capabilityId,
            providerBindingId: node.providerBinding?.providerBindingId,
            capabilitySnapshotVersion: node.capabilitySnapshotVersion,
          })),
        });

        const orchestrated = builderProtocolService.runOrchestratedPhases(context, input.plan);
        if (orchestrated.ok) {
          for (const mutation of orchestrated.executeMutations) {
            if (mutation.path) {
              mutationPaths.push(mutation.path);
              mutationRecords.push({ path: mutation.path, artifactId: mutation.artifactId });
            }
          }
          if (orchestrated.reconcileMutations.length > 0) {
            reconciledNodeCount += 1;
          }
        } else {
          builderOrchestrationErrors.push(
            ...orchestrated.failures.map((failure) => `${node.nodeId}: ${failure}`),
          );
        }

        return { orchestrated };
      },
      (result) => result.orchestrated.ok,
    );

    for (const result of scheduled.results) {
      if (result.ok) {
        executedNodeCount += 1;
      } else {
        failedNodeCount += 1;
      }
    }

    verifiedNodeCount = scheduled.summary.verifiedCount;

    const checkpoint = changeGraphCheckpointStore.read(input.changeGraph.changeGraphId);
    const mutationDiff = summarizeWorkspaceMutationDiff(mutationPaths);

    const verificationPromotion: Partial<ExecuteChangeGraphResult> = executedNodeCount > 0 && workspaceId && revisionId
      ? this.verifyAndPromote({
        workspaceId,
        revisionId,
        changeSetId: input.changeGraph.changeSetId,
        mutationPaths,
        mutationRecords,
        requiresPromotionApproval: input.requiresPromotionApproval ?? false,
      })
      : {};

    const workspaceRecord = workspaceId
      ? engineeringWorkspaceService.getWorkspace(workspaceId)
      : null;
    const revisionRecord = workspaceId && revisionId
      ? engineeringWorkspaceService.getRevision(workspaceId, revisionId)
      : null;
    const priorRevisionCount = workspaceId
      ? Math.max(0, engineeringWorkspaceService.listRevisions(workspaceId).length - 1)
      : 0;
    const lineage = workspaceRecord && revisionRecord
      ? summarizeWorkspaceLineage(workspaceRecord, revisionRecord, priorRevisionCount)
      : undefined;

    return {
      approvalBinding: input.approvalBindingId
        ? semanticPlanApprovalService.getBinding(input.approvalBindingId)
        : undefined,
      workspaceId,
      revisionId,
      executedNodeCount,
      failedNodeCount,
      reconciledNodeCount,
      verifiedNodeCount,
      checkpointId: checkpoint?.checkpointId,
      workspaceStorageKind,
      mutationPathCount: mutationDiff.addedCount,
      mutationPathPreview: mutationDiff.previewPaths,
      revisionNumber: lineage?.revisionNumber,
      parentRevisionId: lineage?.parentRevisionId,
      workspaceState: lineage?.workspaceState,
      revisionState: lineage?.revisionState,
      workspaceLineageLabel: lineage?.lineageLabel,
      builderOrchestrationErrors,
      builderOrchestrationErrorCount: builderOrchestrationErrors.length,
      ...verificationPromotion,
    };
  }

  /** AE-9.2/9.4 — freeze revision, verify, promote, and activate runtime primitives. */
  private verifyAndPromote(input: {
    workspaceId: string;
    revisionId: string;
    changeSetId: string;
    mutationPaths: string[];
    mutationRecords: Array<{ path?: string; artifactId: string }>;
    requiresPromotionApproval?: boolean;
  }): Partial<ExecuteChangeGraphResult> {
    const verifyResult = verificationEngineService.verifyWorkspaceRevision(
      input.workspaceId,
      input.revisionId,
      {
        changeSetId: input.changeSetId,
        mutationPaths: input.mutationPaths,
      },
    );

    if (!verifyResult) {
      return {};
    }

    const base = {
      verificationRunId: verifyResult.run.verificationRunId,
      deployable: verifyResult.run.deployable,
      verificationPassCount: verifyResult.summary.passCount,
      verificationFailCount: verifyResult.summary.failCount,
      revisionFingerprint: verifyResult.run.revisionFingerprint,
      mutationPathCount: input.mutationPaths.length,
      mutationPathPreview: summarizeWorkspaceMutationDiff(input.mutationPaths).previewPaths,
      verificationGraderSummary: verifyResult.run.graderResults.map((result: VerificationGraderResult) => ({
        graderId: result.graderId,
        grade: result.grade,
        layer: result.layer,
      })),
    };

    if (!verifyResult.run.deployable) {
      const repair = repairWorkspaceAfterVerificationFailure(
        engineeringWorkspaceService,
        input.workspaceId,
        input.revisionId,
      );

      if (!repair) {
        return base;
      }

      const repairWorkspace = engineeringWorkspaceService.getWorkspace(input.workspaceId);
      const repairLineage = repairWorkspace
        ? summarizeWorkspaceLineage(repairWorkspace, repair.repairRevision, repair.repairRevisionNumber - 1)
        : undefined;

      return {
        ...base,
        failedRevisionId: repair.failedRevisionId,
        repairRevisionId: repair.repairRevision.revisionId,
        repairRevisionNumber: repair.repairRevisionNumber,
        revisionId: repair.repairRevision.revisionId,
        revisionNumber: repair.repairRevision.revisionNumber,
        parentRevisionId: repair.repairRevision.parentRevisionId,
        workspaceState: repairWorkspace?.state,
        revisionState: repair.repairRevision.state,
        workspaceLineageLabel: repairLineage?.lineageLabel ?? repair.lineageLabel,
      };
    }

    if (input.requiresPromotionApproval) {
      const bindingId = `promo-approval:${input.changeSetId}:${Date.now()}`;
      this.pendingPromotionApprovals.set(bindingId, {
        bindingId,
        workspaceId: input.workspaceId,
        revisionId: input.revisionId,
        changeSetId: input.changeSetId,
        mutationPaths: input.mutationPaths,
        mutationRecords: input.mutationRecords,
        verificationRun: verifyResult.run,
      });

      return {
        ...base,
        promotionApprovalRequired: true,
        promotionApprovalBindingId: bindingId,
      };
    }

    const promotion = promotionService.startPromotion({
      changeSetId: input.changeSetId,
      workspaceId: input.workspaceId,
      revisionId: input.revisionId,
      revisionFingerprint: verifyResult.run.revisionFingerprint,
      verificationRunId: verifyResult.run.verificationRunId,
    }, verifyResult.run);

    const executed = promotionService.executePromotion(promotion.run, input.mutationPaths);

    const activation = runtimeActivationService.activateFromMutations(input.mutationRecords);
    const designerHandoff = buildDesignerHandoffFromActivationBatch(activation);

    return {
      ...base,
      promotionRunId: executed.run.promotionRunId,
      promotionState: executed.run.state,
      promotionPreflightOk: executed.summary.preflightOk,
      packageSnapshotId: executed.run.packageSnapshotId,
      packageRoundtripValidated: executed.roundtripValidated,
      runtimeActivatedCount: activation.activatedCount + activation.validatedCount,
      runtimeActivationFailedCount: activation.failedCount,
      designerHandoff: designerHandoff.length > 0 ? designerHandoff : undefined,
    };
  }

  // V5 P08 § V5-12 — `buildResult` extracted to `planArtifactResultBuilder.ts`
  // (`buildEngineeringPipelineRunResult`), a pure function with zero shared state. All 5
  // original call sites now call the extracted function directly.

  resetForTests(): void {
    this.pendingPromotionApprovals.clear();
    engineeringWorkspaceService.resetForTests();
    semanticPlanApprovalService.resetForTests();
    workspaceArtifactStore.resetForTests();
    changeGraphCheckpointStore.resetForTests();
    packageSnapshotStore.resetForTests();
  }
}

export const engineeringPipelineService = new EngineeringPipelineService();
