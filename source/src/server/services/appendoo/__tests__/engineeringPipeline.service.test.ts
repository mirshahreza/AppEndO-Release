import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { engineeringPipelineService } from '../engineeringPipeline.service';
import { semanticPlanApprovalService } from '../semanticPlanApproval.service';
import { closeSharedCheckpointDb } from '../../../../shared/lib/appendoo/changeGraphCheckpointSqliteBacking';
import {
  GE_SF_UI_001_PROMPT,
  serverFunctionsScope,
  sumTwoNumbersPageContext,
} from '../../ai/__tests__/e2eEngineeringPipeline.helpers';

describe('engineeringPipelineService', () => {
  beforeEach(() => {
    engineeringPipelineService.resetForTests();
    semanticPlanApprovalService.resetForTests();
  });

  afterEach(() => {
    closeSharedCheckpointDb();
  });

  it('runs planning scaffold without builder execute for query class input', () => {
    const result = engineeringPipelineService.runScaffold({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      userPrompt: 'Explain user management architecture',
      executeBuilders: false,
    });

    expect(result.plan.planId).toMatch(/^asp:/);
    expect(result.planActionPolicy.canApprove).toBe(false);
    expect(result.changeGraph).toBeUndefined();
    expect(result.workspaceId).toBeUndefined();
    expect(result.executedNodeCount).toBe(0);
    expect(result.approvalBinding).toBeUndefined();
  });

  it('wires change graph drift validation into scaffold result', () => {
    const result = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      executeBuilders: false,
      requiresApproval: true,
    });

    expect(result.planActionPolicy.canApprove).toBe(true);
    expect(result.changeGraph).toBeDefined();
    expect(result.changeGraphDriftOk).toBe(true);
    expect(result.changeGraphDriftStaleCount).toBe(0);
  });

  it('registers pending approval binding for engineering change without executing builders', () => {
    const result = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      executeBuilders: true,
      requiresApproval: true,
    });

    expect(result.approvalBinding?.status).toBe('pending');
    expect(result.workspaceId).toBeUndefined();
    expect(result.executedNodeCount).toBe(0);
  });

  it('executes builder scaffold after approval binding is approved', () => {
    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      requiresApproval: true,
    });

    const bindingId = scaffold.approvalBinding?.bindingId;
    expect(bindingId).toBeTruthy();

    semanticPlanApprovalService.approve(bindingId!, 'test-user');

    const executed = engineeringPipelineService.executeApprovedBinding(bindingId!);
    expect(executed.workspaceId).toMatch(/^ws:/);
    expect(executed.executedNodeCount).toBe(executed.changeGraph!.nodes.length);
    expect(executed.reconciledNodeCount).toBe(executed.executedNodeCount);
    expect(executed.failedNodeCount).toBe(0);
    expect(executed.verificationRunId).toMatch(/^verify:/);
    expect(executed.deployable).toBe(true);
    expect(executed.promotionRunId).toMatch(/^promote:/);
    expect(executed.promotionState).toBe('DEPLOYED');
    expect(executed.promotionPreflightOk).toBe(true);
    expect(executed.verifiedNodeCount).toBe(executed.changeGraph!.nodes.length);
    expect(executed.runtimeActivatedCount).toBeGreaterThan(0);
    expect(executed.runtimeActivationFailedCount).toBe(0);
  });

  it('executes builder scaffold immediately when approval is not required', () => {
    const result = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      executeBuilders: true,
      requiresApproval: false,
    });

    expect(result.workspaceId).toMatch(/^ws:/);
    expect(result.executedNodeCount).toBe(result.changeGraph!.nodes.length);
    expect(result.failedNodeCount).toBe(0);
  });

  it('executeApprovedPromotion throws when binding is missing', () => {
    expect(() => engineeringPipelineService.executeApprovedPromotion('missing-binding')).toThrow();
  });

  it('defers promotion until promotion approval when requiresPromotionApproval is set', () => {
    const result = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      executeBuilders: true,
      requiresApproval: false,
      requiresPromotionApproval: true,
    });

    expect(result.deployable).toBe(true);
    expect(result.promotionApprovalRequired).toBe(true);
    expect(result.promotionApprovalBindingId).toMatch(/^promo-approval:/);
    expect(result.promotionRunId).toBeUndefined();

    const promoted = engineeringPipelineService.executeApprovedPromotion(result.promotionApprovalBindingId!);
    expect(promoted.promotionRunId).toMatch(/^promote:/);
    expect(promoted.promotionState).toBe('DEPLOYED');
  });
});
