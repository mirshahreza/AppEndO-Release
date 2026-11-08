import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type {
  AppEndooSemanticPlan,
  BuildSemanticPlanInput,
  SemanticPlanArtifact,
} from '../../api/contracts/appendoo/semanticPlan.types';
import { SEMANTIC_PLAN_COMPILER_VERSION } from '../../api/contracts/appendoo/semanticPlan.types';
import { detectUIIntent } from '../detectCodingIntent';
import { compileChangeGraphScaffold } from './engineeringWorkspaceScaffold';
import type { PlanningBlocker } from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import {
  buildCompositionCandidates,
  computeReuseSummary,
  validateSemanticPlanScaffold,
} from './semanticPlanCompositionScaffold';
import { buildServerFunctionUiPlan } from './serverFunctionUiPlanner';
import { buildCreateServerFunctionPlan } from './createServerFunctionPlanner';
import { computeEvidenceMetrics } from './semanticPlanAuthorityGates';
import { deriveContextItemRefsForPlan } from './planContextCitations';

const buildPlanId = (contextPackId: string): string => `asp:${contextPackId}:${Date.now()}`;

const slugifyUiTarget = (functionRef: string): string => (
  `${functionRef.trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')}-calculator`
);

const buildArtifactsFromContext = (
  contextPack: ContextPack,
  userPrompt?: string,
): SemanticPlanArtifact[] => {
  const functionTarget = contextPack.primaryTargets.find((target) => target.kind === 'function');
  const uiIntent = Boolean(userPrompt?.trim() && detectUIIntent(userPrompt));

  if (uiIntent && functionTarget?.ref?.trim()) {
    const functionRef = functionTarget.ref.trim();
    const uiTargetRef = slugifyUiTarget(functionRef);
    return [{
      artifactId: `artifact:page:${uiTargetRef}`,
      kind: 'page',
      title: `UI for ${functionTarget.label || functionRef}`,
      action: 'create',
      targetRef: uiTargetRef,
      evidenceIds: [
        functionTarget.targetId,
        `function:${functionRef}`,
      ],
    }];
  }

  const artifacts: SemanticPlanArtifact[] = contextPack.primaryTargets.map((target) => ({
    artifactId: `artifact:${target.targetId}`,
    kind: target.kind === 'function'
      ? 'server_function'
      : target.kind === 'page'
        ? 'page'
        : target.kind === 'component'
          ? 'component'
          : 'configuration',
    title: target.label,
    action: 'modify',
    targetRef: target.ref,
    evidenceIds: contextPack.selectionExplanations
      .filter((explanation) => explanation.evidenceId === target.targetId)
      .map((explanation) => explanation.evidenceId),
  }));

  if (artifacts.length === 0 && userPrompt?.trim()) {
    artifacts.push({
      artifactId: 'artifact:prompt-derived',
      kind: 'configuration',
      title: userPrompt.trim().slice(0, 120),
      action: 'modify',
      evidenceIds: [],
    });
  }

  return artifacts;
};

const buildScaffoldBlockingIssues = (): PlanningBlocker[] => ([{
  code: 'PLANNING_NOT_IMPLEMENTED',
  stage: 'PLANNING',
  materiality: 'BLOCKING',
  evidenceRefs: [],
}]);

/**
 * Primary planner entry — authoritative vertical-slice planners first, scaffold only as
 * non-authoritative fallback. V5 P06 § 8.2/EV-1 added `buildCreateServerFunctionPlan` as a
 * second authoritative path (existing-function→UI was the only one before this phase) so that
 * "create a new server function" no longer falls through to the scaffold.
 */
export const buildSemanticPlan = (input: BuildSemanticPlanInput): AppEndooSemanticPlan => {
  const verticalSlicePlan = buildServerFunctionUiPlan(input) ?? buildCreateServerFunctionPlan(input);
  if (verticalSlicePlan) {
    const withEvidence: AppEndooSemanticPlan = {
      ...verticalSlicePlan,
      evidenceMetrics: computeEvidenceMetrics(verticalSlicePlan),
    };
    return {
      ...withEvidence,
      contextItemRefs: deriveContextItemRefsForPlan(input.contextPack, withEvidence),
    };
  }
  const scaffoldPlan = buildSemanticPlanScaffold(input);
  return {
    ...scaffoldPlan,
    contextItemRefs: deriveContextItemRefsForPlan(input.contextPack, scaffoldPlan),
  };
};

/** AE-6.2 scaffold — ASP from ContextPack + scope with composition and validation depth. */
export const buildSemanticPlanScaffold = (input: BuildSemanticPlanInput): AppEndooSemanticPlan => {
  const scopeKey = input.applicationScope?.scopeKey ?? input.contextPack.applicationScopeRef;
  const proposedArtifacts = buildArtifactsFromContext(input.contextPack, input.userPrompt);
  const changeSetId = `cs:${input.contextPack.contextPackId}`;
  const compositionCandidates = buildCompositionCandidates(input.contextPack, input.userPrompt);

  const basePlan: AppEndooSemanticPlan = {
    planId: buildPlanId(input.contextPack.contextPackId),
    revision: 1,
    applicationScopeRef: scopeKey,
    contextPackId: input.contextPack.contextPackId,
    objective: input.userPrompt?.trim() || 'Implement the requested engineering change',
    scope: scopeKey,
    resolvedTargets: input.contextPack.primaryTargets.map((target) => target.targetId),
    requirements: input.contextPack.governance,
    assumptions: [],
    nonGoals: [],
    proposedArtifacts,
    artifactModifications: proposedArtifacts.filter((artifact) => artifact.action === 'modify'),
    permissions: input.contextPack.permissions,
    requiredCapabilities: input.contextPack.capabilityEvidence,
    capabilityGaps: input.contextPack.capabilityGaps.map((gap, index) => ({
      gapId: `gap:${index + 1}`,
      capabilityId: gap,
      description: gap,
      resolution: 'unresolved',
    })),
    appliedStandards: input.contextPack.engineeringStandards.map((standard) => standard.sourceId),
    selectedPatterns: input.contextPack.trustedPatterns,
    acceptanceCriteria: input.contextPack.businessRules,
    risks: input.contextPack.conflicts,
    conflicts: input.contextPack.conflicts,
    requestedOutcomes: compositionCandidates[0]?.requestedOutcomeRefs ?? [],
    compositionCandidates,
    changeGraphProposal: compileChangeGraphScaffold({
      changeSetId,
      applicationScope: input.applicationScope,
    }),
    createdAt: new Date().toISOString(),
  };

  const { reuseSummary } = computeReuseSummary(input.contextPack, basePlan);
  const validation = validateSemanticPlanScaffold(basePlan, input.contextPack);

  return {
    ...basePlan,
    reuseSummary,
    validation: {
      ...validation,
      ok: false,
    },
    authority: 'SCAFFOLD',
    status: 'DRAFT',
    producer: 'scaffold',
    blockingIssues: buildScaffoldBlockingIssues(),
  };
};

export const summarizeSemanticPlan = (plan: AppEndooSemanticPlan): {
  planId: string;
  revision: number;
  artifactCount: number;
  capabilityGapCount: number;
  compilerVersion: string;
} => ({
  planId: plan.planId,
  revision: plan.revision,
  artifactCount: plan.proposedArtifacts.length,
  capabilityGapCount: plan.capabilityGaps.length,
  compilerVersion: SEMANTIC_PLAN_COMPILER_VERSION,
});
