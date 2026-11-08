import { createHash } from 'node:crypto';
import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../api/contracts/appendoo/semanticPlan.types';
import type {
  SemanticPlanApprovalBinding,
  SemanticPlanApprovalStatus,
  SemanticPlanStaleReason,
  ValidateApprovalBindingResult,
} from '../../api/contracts/appendoo/semanticPlanApproval.types';

const buildBindingId = (planId: string, planRevision: number): string => (
  `asp-approval:${planId}:r${planRevision}:${Date.now()}`
);

export const computeApprovalFingerprint = (
  plan: Pick<AppEndooSemanticPlan, 'planId' | 'revision' | 'contextPackId'>,
  contextPack: Pick<ContextPack, 'contextPackId' | 'revision' | 'indexVersions'>,
): string => {
  const payload = JSON.stringify({
    planId: plan.planId,
    planRevision: plan.revision,
    contextPackId: contextPack.contextPackId,
    contextPackRevision: contextPack.revision,
    indexVersions: contextPack.indexVersions,
  });
  return createHash('sha256').update(payload).digest('hex');
};

export const detectApprovalStaleReason = (
  binding: SemanticPlanApprovalBinding,
  plan: AppEndooSemanticPlan,
  contextPack: ContextPack,
): SemanticPlanStaleReason | undefined => {
  if (plan.revision !== binding.planRevision || contextPack.revision !== binding.contextPackRevision) {
    return 'CONTEXT_STALE';
  }

  const boundCapability = binding.intelligenceVersions.capabilitySnapshot;
  const currentCapability = contextPack.indexVersions.capabilitySnapshot;
  if (boundCapability && currentCapability && boundCapability !== currentCapability) {
    return 'CAPABILITY_STALE';
  }

  return undefined;
};

export const createPendingApprovalBinding = (
  plan: AppEndooSemanticPlan,
  contextPack: ContextPack,
): SemanticPlanApprovalBinding => ({
  bindingId: buildBindingId(plan.planId, plan.revision),
  planId: plan.planId,
  planRevision: plan.revision,
  contextPackId: contextPack.contextPackId,
  contextPackRevision: contextPack.revision,
  intelligenceVersions: { ...contextPack.indexVersions },
  fingerprint: computeApprovalFingerprint(plan, contextPack),
  status: 'pending',
  createdAt: new Date().toISOString(),
});

export const approveApprovalBinding = (
  binding: SemanticPlanApprovalBinding,
  approvedBy: string,
): SemanticPlanApprovalBinding => ({
  ...binding,
  status: 'approved',
  approvedAt: new Date().toISOString(),
  approvedBy,
  staleReason: undefined,
});

export const markApprovalBindingStale = (
  binding: SemanticPlanApprovalBinding,
  staleReason: SemanticPlanStaleReason,
): SemanticPlanApprovalBinding => ({
  ...binding,
  status: 'stale',
  staleReason,
});

export const validateApprovalBindingForExecution = (
  binding: SemanticPlanApprovalBinding,
  plan: AppEndooSemanticPlan,
  contextPack: ContextPack,
): ValidateApprovalBindingResult => {
  const errors: string[] = [];
  const fingerprint = computeApprovalFingerprint(plan, contextPack);

  if (binding.fingerprint !== fingerprint) {
    const staleReason = detectApprovalStaleReason(binding, plan, contextPack) ?? 'CONTEXT_STALE';
    return {
      ok: false,
      status: 'stale',
      staleReason,
      errors: [`Approval binding is ${staleReason.toLowerCase().replace('_', ' ')}.`],
    };
  }

  if (binding.planId !== plan.planId) {
    errors.push('planId mismatch.');
  }

  if (binding.status === 'pending') {
    errors.push('ASP approval is pending.');
  }

  if (binding.status === 'revoked') {
    errors.push('ASP approval was revoked.');
  }

  if (binding.status === 'stale') {
    errors.push(`ASP approval is stale (${binding.staleReason ?? 'CONTEXT_STALE'}).`);
  }

  const staleReason = detectApprovalStaleReason(binding, plan, contextPack);
  if (staleReason) {
    return {
      ok: false,
      status: 'stale',
      staleReason,
      errors: [`Upstream drift detected: ${staleReason}.`],
    };
  }

  const status: SemanticPlanApprovalStatus = binding.status === 'approved' ? 'approved' : binding.status;

  return {
    ok: errors.length === 0 && status === 'approved',
    status,
    errors,
  };
};
