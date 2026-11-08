import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGeSfUi001ContextPack,
  GE_SF_UI_001_PROMPT,
} from '../../../../shared/lib/appendoo/goldenEvalServerFunctionUi';
import { serverFunctionsScope } from '../../ai/__tests__/e2eEngineeringPipeline.helpers';

describe('engineeringPipeline repair revision flow', () => {
  let originalEnv = '';

  beforeEach(() => {
    originalEnv = process.env.APPENDOO_FORCE_VERIFICATION_FAILURE ?? '';
    process.env.APPENDOO_FORCE_VERIFICATION_FAILURE = '1';
    vi.resetModules();
  });

  afterEach(() => {
    process.env.APPENDOO_FORCE_VERIFICATION_FAILURE = originalEnv;
    vi.resetModules();
  });

  it('opens repair revision R2 when verification fails (R1 fail → R2 repair)', async () => {
    const { engineeringPipelineService } = await import('../engineeringPipeline.service');
    const { semanticPlanApprovalService } = await import('../semanticPlanApproval.service');

    engineeringPipelineService.resetForTests();

    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      contextPack: buildGeSfUi001ContextPack(),
      userPrompt: GE_SF_UI_001_PROMPT,
      requiresApproval: true,
    });

    const bindingId = scaffold.approvalBinding?.bindingId;
    expect(bindingId).toBeTruthy();

    semanticPlanApprovalService.approve(bindingId!, 'repair-flow-test');
    const executed = engineeringPipelineService.executeApprovedBinding(bindingId!);

    expect(executed.deployable).toBe(false);
    expect(executed.verificationRunId).toMatch(/^verify:/);
    expect(executed.failedRevisionId).toBeTruthy();
    expect(executed.repairRevisionId).toMatch(/^rev:/);
    expect(executed.repairRevisionNumber).toBe(2);
    expect(executed.revisionId).toBe(executed.repairRevisionId);
    expect(executed.promotionRunId).toBeUndefined();
    expect(executed.workspaceLineageLabel).toContain('repair');
  });

  it('re-executes repair revision R2 and promotes when verification passes', async () => {
    const { engineeringPipelineService } = await import('../engineeringPipeline.service');
    const { semanticPlanApprovalService } = await import('../semanticPlanApproval.service');

    engineeringPipelineService.resetForTests();

    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      contextPack: buildGeSfUi001ContextPack(),
      userPrompt: GE_SF_UI_001_PROMPT,
      requiresApproval: true,
    });

    const bindingId = scaffold.approvalBinding?.bindingId;
    expect(bindingId).toBeTruthy();

    semanticPlanApprovalService.approve(bindingId!, 'repair-reexecute-test');
    const failed = engineeringPipelineService.executeApprovedBinding(bindingId!);

    expect(failed.deployable).toBe(false);
    expect(failed.repairRevisionId).toBeTruthy();
    expect(failed.workspaceId).toBeTruthy();

    process.env.APPENDOO_FORCE_VERIFICATION_FAILURE = '';

    const repaired = engineeringPipelineService.executeRepairRevision({
      bindingId: bindingId!,
      workspaceId: failed.workspaceId!,
      repairRevisionId: failed.repairRevisionId!,
    });

    expect(repaired.repairReExecuted).toBe(true);
    expect(repaired.deployable).toBe(true);
    expect(repaired.promotionState).toBe('DEPLOYED');
    expect(repaired.promotionRunId).toMatch(/^promote:/);
  });
});
