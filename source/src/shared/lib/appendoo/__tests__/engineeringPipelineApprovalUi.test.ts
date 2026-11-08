import { describe, expect, it } from 'vitest';
import {
  isPromotionApprovalBinding,
  resolveEngineeringPipelineApprovalBinding,
  shouldShowSemanticPlanApprovalBar,
} from '../engineeringPipelineApprovalUi';

const basePipeline = {
  type: 'engineering_pipeline' as const,
  planId: 'asp:test',
  planRevision: 1,
  planObjective: 'Build UI',
  artifactCount: 1,
  capabilityGapCount: 0,
  changeGraphId: 'cg:test',
  changeNodeCount: 1,
  approvalBindingId: 'asp-approval:test',
  approvalStatus: 'pending' as const,
  executedNodeCount: 0,
  failedNodeCount: 0,
  requiresApproval: true,
  planActionPolicy: {
    canApprove: true,
    canRevise: false,
    canExecute: false,
    blockingReasonCodes: [],
  },
};

describe('engineeringPipelineApprovalUi', () => {
  it('shows approval only for explicit manual-approval flows', () => {
    expect(shouldShowSemanticPlanApprovalBar(basePipeline, { hasApproveHandler: true })).toBe(true);
  });

  it('hides approval in agent auto-build flows', () => {
    expect(shouldShowSemanticPlanApprovalBar({
      ...basePipeline,
      requiresApproval: false,
      approvalStatus: 'approved',
      executedNodeCount: 1,
      promotionState: 'DEPLOYED',
    }, { hasApproveHandler: true })).toBe(false);
  });

  it('hides when planActionPolicy blocks approval', () => {
    expect(shouldShowSemanticPlanApprovalBar({
      ...basePipeline,
      planActionPolicy: {
        canApprove: false,
        canRevise: false,
        canExecute: false,
        blockingReasonCodes: ['PLANNING_NOT_IMPLEMENTED'],
      },
    }, { hasApproveHandler: true })).toBe(false);
  });

  it('shows promotion approval when deployable and pending export', () => {
    expect(shouldShowSemanticPlanApprovalBar({
      ...basePipeline,
      requiresApproval: false,
      promotionApprovalRequired: true,
      promotionApprovalBindingId: 'promo-approval:test',
      deployable: true,
      executedNodeCount: 2,
    }, { hasApproveHandler: true })).toBe(true);
  });

  it('resolves promotion binding ids for governed export approval', () => {
    expect(isPromotionApprovalBinding('promo-approval:cs:test')).toBe(true);
    expect(resolveEngineeringPipelineApprovalBinding({
      ...basePipeline,
      promotionApprovalRequired: true,
      promotionApprovalBindingId: 'promo-approval:cs:test',
    })).toBe('promo-approval:cs:test');
  });
});
