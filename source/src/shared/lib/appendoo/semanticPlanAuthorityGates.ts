import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../api/contracts/appendoo/semanticPlan.types';
import type {
  ArtifactAuthority,
  PlanningBlocker,
  PlanActionPolicy,
  ResolvedTargetBinding,
  SemanticPlanEvidenceMetrics,
  SemanticPlanStatus,
} from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import {
  MIN_AUTHORITY_FOR_APPROVAL,
  MIN_AUTHORITY_FOR_COMPILE,
  MIN_AUTHORITY_FOR_EXECUTE,
} from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import { resolveServerFunctionFixture } from './serverFunctionContractFixtures';
import { runTargetBindingCriticCheck } from './planCriticCheck';

const hasAuthorityAtLeast = (
  authority: ArtifactAuthority,
  minimum: ArtifactAuthority[],
): boolean => minimum.includes(authority);

export const resolveFunctionTargets = (contextPack: ContextPack): ContextPack['primaryTargets'] => (
  contextPack.primaryTargets.filter((target) => target.kind === 'function' && target.ref?.trim())
);

export const resolveExactTargetBinding = (
  contextPack: ContextPack,
): { binding?: ResolvedTargetBinding; blockers: PlanningBlocker[] } => {
  const functionTargets = resolveFunctionTargets(contextPack);
  const blockers: PlanningBlocker[] = [];

  if (functionTargets.length === 0) {
    blockers.push({
      code: 'TARGET_NOT_FOUND',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      question: 'Which server function should this change target?',
      evidenceRefs: [],
    });
    return { blockers };
  }

  if (functionTargets.length > 1) {
    blockers.push({
      code: 'AMBIGUOUS_TARGET',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      question: 'Multiple server functions match — which one should be used?',
      options: functionTargets.map((target) => ({
        optionId: target.targetId,
        label: target.label,
        value: target.ref ?? target.targetId,
      })),
      evidenceRefs: functionTargets.map((target) => target.targetId),
    });
    return { blockers };
  }

  const target = functionTargets[0]!;
  const canonicalId = target.ref!.trim();
  const fixture = resolveServerFunctionFixture(canonicalId);

  return {
    binding: {
      artifactRef: {
        targetKind: 'function',
        targetId: target.targetId,
        ref: canonicalId,
      },
      artifactType: 'SERVER_FUNCTION',
      canonicalId,
      versionOrFingerprint: fixture?.fingerprint ?? `unversioned:${canonicalId}`,
      resolutionMethod: 'EXACT_TARGET',
      evidenceRefs: [
        target.targetId,
        ...contextPack.selectionExplanations
          .filter((explanation) => explanation.evidenceId === target.targetId)
          .map((explanation) => explanation.evidenceId),
      ],
      confidence: 1,
    },
    blockers,
  };
};

export const evaluateContextSufficiencyGate = (
  contextPack: ContextPack,
  binding?: ResolvedTargetBinding,
): PlanningBlocker[] => {
  const blockers: PlanningBlocker[] = [];

  if (!binding) {
    return blockers;
  }

  if (binding.artifactType !== 'SERVER_FUNCTION') {
    return blockers;
  }

  const fixture = resolveServerFunctionFixture(binding.canonicalId);
  if (!fixture) {
    blockers.push({
      code: 'CONTEXT_NOT_SUFFICIENT',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      evidenceRefs: [binding.canonicalId],
    });
    return blockers;
  }

  const hasInputEvidence = contextPack.structuralEvidence.some((entry) => (
    entry.includes(`${binding.canonicalId}:input`) || entry.includes('contract:')
  ));
  const hasPermissionEvidence = contextPack.permissions.some((entry) => (
    fixture.permissions.includes(entry)
  ));
  const hasAnalogousUi = contextPack.similarImplementations.some((entry) => (
    entry.includes(fixture.analogousUiRef) || entry.includes('Calculator')
  ));

  if (!hasInputEvidence) {
    blockers.push({
      code: 'MISSING_REQUIRED_CONTEXT',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      evidenceRefs: [`contract:${binding.canonicalId}:input`],
    });
  }
  if (!hasPermissionEvidence) {
    blockers.push({
      code: 'MISSING_REQUIRED_CONTEXT',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      evidenceRefs: fixture.permissions,
    });
  }
  if (!hasAnalogousUi) {
    blockers.push({
      code: 'MISSING_REQUIRED_CONTEXT',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      evidenceRefs: [fixture.analogousUiRef],
    });
  }

  if (contextPack.conflicts.length > 0) {
    blockers.push({
      code: 'CONFLICTING_AUTHORITY',
      stage: 'CONTEXT',
      materiality: 'BLOCKING',
      evidenceRefs: contextPack.conflicts,
    });
  }

  return blockers;
};

export const computeEvidenceMetrics = (plan: AppEndooSemanticPlan): SemanticPlanEvidenceMetrics => {
  const decisions = plan.planDecisions ?? [];
  const materialDecisions = decisions.filter((decision) => decision.inferenceClass !== 'DETERMINISTIC');
  const tracedMaterial = materialDecisions.filter((decision) => decision.evidenceRefs.length > 0);
  const materialDecisionEvidenceCoverage = materialDecisions.length === 0
    ? 1
    : tracedMaterial.length / materialDecisions.length;

  const requirements = plan.requirements.length + plan.acceptanceCriteria.length;
  const tracedRequirements = plan.acceptanceCriteria.filter((criterion) => criterion.trim().length > 0).length;
  const requirementTraceCoverage = requirements === 0 ? 0 : tracedRequirements / requirements;

  const targetBindingCoverage = plan.resolvedTargetBindings?.length
    ? plan.resolvedTargetBindings.filter((binding) => binding.evidenceRefs.length > 0).length
      / plan.resolvedTargetBindings.length
    : 0;

  const acceptanceCriterionTraceCoverage = plan.acceptanceCriteria.length === 0
    ? 0
    : plan.acceptanceCriteria.filter((criterion) => criterion.startsWith('evidence:')).length
      / plan.acceptanceCriteria.length;

  return {
    materialDecisionEvidenceCoverage,
    requirementTraceCoverage,
    targetBindingCoverage,
    acceptanceCriterionTraceCoverage,
  };
};

export const evaluateAspCompletionGate = (plan: AppEndooSemanticPlan): PlanningBlocker[] => {
  const blockers: PlanningBlocker[] = [...(plan.blockingIssues ?? [])];

  if (plan.authority === 'SCAFFOLD') {
    blockers.push({
      code: 'PLANNING_NOT_IMPLEMENTED',
      stage: 'PLANNING',
      materiality: 'BLOCKING',
      evidenceRefs: [],
    });
    return blockers;
  }

  if (!plan.uiSemanticDesign && plan.proposedArtifacts.some((artifact) => (
    artifact.kind === 'page' && artifact.action === 'create'
  ))) {
    blockers.push({
      code: 'SEMANTIC_DESIGN_INCOMPLETE',
      stage: 'PLANNING',
      materiality: 'BLOCKING',
      evidenceRefs: [],
    });
  }

  if (!plan.validation?.ok) {
    blockers.push({
      code: 'SEMANTIC_DESIGN_INCOMPLETE',
      stage: 'PLANNING',
      materiality: 'BLOCKING',
      evidenceRefs: plan.validation?.issues.map((issue) => issue.code) ?? [],
    });
  }

  const metrics = computeEvidenceMetrics(plan);
  if (metrics.targetBindingCoverage < 1) {
    blockers.push({
      code: 'SEMANTIC_DESIGN_INCOMPLETE',
      stage: 'PLANNING',
      materiality: 'BLOCKING',
      evidenceRefs: ['targetBindingCoverage'],
    });
  }
  if (metrics.materialDecisionEvidenceCoverage < 1) {
    blockers.push({
      code: 'SEMANTIC_DESIGN_INCOMPLETE',
      stage: 'PLANNING',
      materiality: 'BLOCKING',
      evidenceRefs: ['materialDecisionEvidenceCoverage'],
    });
  }

  // V5 Phase P11 § V5-18 — independent critic check, run unconditionally alongside the planner's
  // own gates (not a replacement for them). DoD: a wrong target binding must be rejected here,
  // before approval, not discovered later by a human.
  blockers.push(...runTargetBindingCriticCheck(plan.resolvedTargetBindings));

  return blockers;
};

export const derivePlanStatus = (plan: AppEndooSemanticPlan): SemanticPlanStatus => {
  if (plan.status) {
    return plan.status;
  }
  if (plan.authority === 'SCAFFOLD') {
    return 'DRAFT';
  }
  const blockers = evaluateAspCompletionGate(plan);
  if (blockers.some((blocker) => blocker.materiality === 'BLOCKING')) {
    return plan.blockingIssues?.some((issue) => issue.code === 'NEEDS_CLARIFICATION')
      ? 'NEEDS_CLARIFICATION'
      : 'INVALID';
  }
  if (plan.authority === 'APPROVED') {
    return 'APPROVED';
  }
  if (hasAuthorityAtLeast(plan.authority ?? 'SCAFFOLD', MIN_AUTHORITY_FOR_APPROVAL)) {
    return 'READY_FOR_APPROVAL';
  }
  return 'VALIDATING';
};

export const resolvePlanActionPolicy = (plan: AppEndooSemanticPlan): PlanActionPolicy => {
  const status = derivePlanStatus(plan);
  const blockers = evaluateAspCompletionGate(plan);
  const blockingReasonCodes = blockers
    .filter((blocker) => blocker.materiality === 'BLOCKING')
    .map((blocker) => blocker.code);

  const canApprove = status === 'READY_FOR_APPROVAL'
    && hasAuthorityAtLeast(plan.authority ?? 'SCAFFOLD', MIN_AUTHORITY_FOR_APPROVAL)
    && blockingReasonCodes.length === 0
    && (plan.validation?.ok ?? false);

  const canExecute = status === 'APPROVED'
    && hasAuthorityAtLeast(plan.authority ?? 'SCAFFOLD', MIN_AUTHORITY_FOR_EXECUTE)
    && Boolean(plan.validationFingerprint);

  return {
    canApprove,
    canRevise: blockingReasonCodes.includes('NEEDS_CLARIFICATION')
      || blockingReasonCodes.includes('AMBIGUOUS_TARGET')
      || blockingReasonCodes.includes('UNRESOLVED_OUTCOME'),
    canExecute,
    blockingReasonCodes,
  };
};

export const isScaffoldPlan = (plan: AppEndooSemanticPlan): boolean => (
  plan.authority === 'SCAFFOLD' || plan.producer === 'scaffold'
);

export const assertChangeGraphCompileAllowed = (
  plan: AppEndooSemanticPlan,
  options?: { approvedRevisionId?: number; approvedAuthority?: ArtifactAuthority },
): { ok: true } | { ok: false; code: PlanningBlocker['code']; errors: string[] } => {
  const errors: string[] = [];

  if (isScaffoldPlan(plan)) {
    return { ok: false, code: 'CHANGE_GRAPH_COMPILE_FORBIDDEN', errors: ['Scaffold ASP cannot compile.'] };
  }

  if (!hasAuthorityAtLeast(plan.authority ?? 'SCAFFOLD', MIN_AUTHORITY_FOR_COMPILE)) {
    errors.push(`Plan authority ${plan.authority ?? 'SCAFFOLD'} is insufficient for compile.`);
  }

  const blockers = evaluateAspCompletionGate(plan);
  if (blockers.some((blocker) => blocker.materiality === 'BLOCKING')) {
    errors.push(...blockers.map((blocker) => blocker.code));
  }

  if (options?.approvedRevisionId !== undefined && options.approvedRevisionId !== plan.revision) {
    errors.push('Approved revision mismatch.');
  }

  if (options?.approvedAuthority && plan.authority !== options.approvedAuthority) {
    errors.push('Approved authority mismatch.');
  }

  if (errors.length > 0) {
    return { ok: false, code: 'CHANGE_GRAPH_COMPILE_FORBIDDEN', errors };
  }

  return { ok: true };
};

export const assertBuilderInputSufficient = (
  plan: AppEndooSemanticPlan,
  operationType: string,
): { ok: true } | { ok: false; code: 'BUILDER_INPUT_INSUFFICIENT'; errors: string[] } => {
  if (!['CREATE_PAGE', 'CREATE_COMPONENT', 'MODIFY_PAGE', 'MODIFY_COMPONENT'].includes(operationType)) {
    return { ok: true };
  }

  const errors: string[] = [];
  const design = plan.uiSemanticDesign;

  if (!design) {
    errors.push('UISemanticDesign is required for page/component builders.');
  } else {
    if (design.boundOperations.length === 0) {
      errors.push('Missing bound operations.');
    }
    if (design.inputBindings.length === 0) {
      errors.push('Missing input bindings.');
    }
    if (design.outputBindings.length === 0) {
      errors.push('Missing output bindings.');
    }
    if (!design.states.loading || !design.states.success || !design.states.operationError) {
      errors.push('Incomplete UI state model.');
    }
    if (!design.placement.rationale.trim()) {
      errors.push('Placement decision lacks rationale.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, code: 'BUILDER_INPUT_INSUFFICIENT', errors };
  }

  return { ok: true };
};
