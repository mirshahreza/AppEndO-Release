import type { EngineeringPipelineViewModel } from '../../api/contracts/appendoo/engineeringPipeline.types';

export const PROMOTION_APPROVAL_BINDING_PREFIX = 'promo-approval:';

export const isPromotionApprovalBinding = (bindingId: string): boolean => (
  bindingId.startsWith(PROMOTION_APPROVAL_BINDING_PREFIX)
);

export const isPromotionApprovalPipeline = (
  pipeline: EngineeringPipelineViewModel,
): boolean => Boolean(
  pipeline.promotionApprovalRequired && pipeline.promotionApprovalBindingId,
);

export const resolveEngineeringPipelineApprovalBinding = (
  pipeline: EngineeringPipelineViewModel,
): string | undefined => {
  if (isPromotionApprovalPipeline(pipeline)) {
    return pipeline.promotionApprovalBindingId;
  }
  return pipeline.approvalBindingId;
};

/** Manual approval is Ask/Plan only — Agent implement auto-builds without a confirm step. */
export const shouldShowSemanticPlanApprovalBar = (
  pipeline: EngineeringPipelineViewModel,
  options?: { hasApproveHandler?: boolean },
): boolean => {
  if (!options?.hasApproveHandler) {
    return false;
  }
  if (pipeline.promotionApprovalRequired && pipeline.promotionApprovalBindingId) {
    return true;
  }
  if (pipeline.requiresApproval !== true) {
    return false;
  }
  if (pipeline.approvalStatus !== 'pending') {
    return false;
  }
  if (!pipeline.approvalBindingId) {
    return false;
  }
  if ((pipeline.executedNodeCount ?? 0) > 0) {
    return false;
  }
  if (pipeline.promotionState === 'DEPLOYED') {
    return false;
  }
  return pipeline.planActionPolicy?.canApprove ?? false;
};
