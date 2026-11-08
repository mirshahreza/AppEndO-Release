import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../api/contracts/appendoo/semanticPlan.types';
import type { SemanticPlanApprovalBinding } from '../../api/contracts/appendoo/semanticPlanApproval.types';

export const REUSE_METRIC_VERSION = '1.0.0';
export const COMPOSITION_CONTRACT_VERSION = '1.0.0';

export type SemanticPlanCompositionCandidate = {
  compositionCandidateId: string;
  requestedOutcomeRefs: string[];
  capabilityRefs: string[];
  providerBindings: string[];
  fitnessScore: number;
  trustScore: number;
  compositionContractVersion: string;
};

export type SemanticPlanReuseAnalysis = {
  reuseMetricVersion: string;
  reusedResponsibilities: string[];
  adaptedResponsibilities: string[];
  newResponsibilities: string[];
  rejectedReuseCandidates: string[];
};

export type SemanticPlanValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning';
};

export type SemanticPlanValidationResult = {
  ok: boolean;
  issues: SemanticPlanValidationIssue[];
};

export const buildCompositionCandidates = (
  contextPack: ContextPack,
  userPrompt?: string,
): SemanticPlanCompositionCandidate[] => {
  const outcome = userPrompt?.trim() || contextPack.primaryTargets[0]?.label || 'engineering-change';
  const capabilities = contextPack.capabilityEvidence.length > 0
    ? contextPack.capabilityEvidence
    : ['capability:appendo-files', 'capability:appendo-codebase'];

  return [{
    compositionCandidateId: `composition:${contextPack.contextPackId}:1`,
    requestedOutcomeRefs: [outcome],
    capabilityRefs: capabilities,
    providerBindings: capabilities.map((capability) => `${capability}:platform-runtime`),
    fitnessScore: contextPack.primaryTargets.length > 0 ? 0.85 : 0.6,
    trustScore: contextPack.trustedPatterns.length > 0 ? 0.9 : 0.7,
    compositionContractVersion: COMPOSITION_CONTRACT_VERSION,
  }];
};

export const computeReuseSummary = (
  contextPack: ContextPack,
  plan: AppEndooSemanticPlan,
): {
  reuseSummary: NonNullable<AppEndooSemanticPlan['reuseSummary']>;
  reuseAnalysis: SemanticPlanReuseAnalysis;
} => {
  const applicableCapabilities = Math.max(contextPack.capabilityEvidence.length, 1);
  const reusedCapabilities = contextPack.capabilityEvidence.filter((capability) => (
    plan.requiredCapabilities.includes(capability)
  ));
  const capabilityReuseRatio = reusedCapabilities.length / applicableCapabilities;

  const applicableArtifacts = Math.max(plan.proposedArtifacts.length, 1);
  const reusedArtifacts = plan.proposedArtifacts.filter((artifact) => artifact.evidenceIds.length > 0);
  const artifactReuseRatio = reusedArtifacts.length / applicableArtifacts;

  const responsibilities = plan.proposedArtifacts.map((artifact) => artifact.artifactId);
  const reusedResponsibilities = reusedArtifacts.map((artifact) => artifact.artifactId);
  const newResponsibilities = responsibilities.filter((id) => !reusedResponsibilities.includes(id));

  const changeScopeReuseRatio = reusedResponsibilities.length / Math.max(responsibilities.length, 1);
  const compositeReuseScore = (
    capabilityReuseRatio * 0.4
    + artifactReuseRatio * 0.35
    + changeScopeReuseRatio * 0.25
  );

  return {
    reuseSummary: {
      capabilityReuseRatio,
      artifactReuseRatio,
      changeScopeReuseRatio,
      compositeReuseScore,
    },
    reuseAnalysis: {
      reuseMetricVersion: REUSE_METRIC_VERSION,
      reusedResponsibilities,
      adaptedResponsibilities: contextPack.trustedPatterns,
      newResponsibilities,
      rejectedReuseCandidates: contextPack.excludedCandidates,
    },
  };
};

export const validateSemanticPlanScaffold = (
  plan: AppEndooSemanticPlan,
  contextPack: ContextPack,
): SemanticPlanValidationResult => {
  const issues: SemanticPlanValidationIssue[] = [];

  if (plan.proposedArtifacts.length === 0) {
    issues.push({
      code: 'ASP-001',
      message: 'Semantic plan must propose at least one artifact.',
      severity: 'error',
    });
  }

  for (const artifact of plan.proposedArtifacts) {
    if (!artifact.evidenceIds.length) {
      issues.push({
        code: 'ASP-002',
        message: `Artifact ${artifact.artifactId} lacks Context Pack evidence IDs.`,
        severity: 'warning',
      });
    }
  }

  if (plan.appliedStandards.length === 0 && contextPack.engineeringStandards.length > 0) {
    issues.push({
      code: 'ASP-003',
      message: 'Normative standards exist in context but were not applied to the plan.',
      severity: 'warning',
    });
  }

  if (plan.capabilityGaps.some((gap) => gap.resolution === 'unresolved')) {
    issues.push({
      code: 'ASP-004',
      message: 'Plan contains unresolved capability gaps.',
      severity: 'warning',
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
};

/** AE-6.2 — validate reuse attribution aligns with immutable approval binding. */
export const validateApprovalBindingAttribution = (
  plan: AppEndooSemanticPlan,
  contextPack: ContextPack,
  binding?: Pick<
    SemanticPlanApprovalBinding,
    'planId' | 'planRevision' | 'contextPackId' | 'contextPackRevision' | 'fingerprint'
  >,
): SemanticPlanValidationResult => {
  const issues: SemanticPlanValidationIssue[] = [];

  if (!binding) {
    return { ok: true, issues };
  }

  if (binding.planId !== plan.planId) {
    issues.push({
      code: 'ASP-BIND-01',
      message: 'Approval binding planId does not match semantic plan.',
      severity: 'error',
    });
  }

  if (binding.planRevision !== plan.revision) {
    issues.push({
      code: 'ASP-BIND-02',
      message: 'Approval binding planRevision drift detected.',
      severity: 'error',
    });
  }

  if (binding.contextPackId !== contextPack.contextPackId) {
    issues.push({
      code: 'ASP-BIND-03',
      message: 'Approval binding contextPackId does not match context pack.',
      severity: 'error',
    });
  }

  if (binding.contextPackRevision !== contextPack.revision) {
    issues.push({
      code: 'ASP-BIND-04',
      message: 'Approval binding contextPackRevision drift detected.',
      severity: 'error',
    });
  }

  const { reuseSummary } = computeReuseSummary(contextPack, plan);
  if (reuseSummary.compositeReuseScore < 0.2 && plan.proposedArtifacts.length > 1) {
    issues.push({
      code: 'ASP-BIND-05',
      message: 'Reuse attribution below threshold for multi-artifact plan.',
      severity: 'warning',
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
};
