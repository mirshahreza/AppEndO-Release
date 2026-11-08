import { describe, expect, it, vi } from 'vitest';
import { AgentService } from '../agent.service';
import { HttpError } from '../../../errors/HttpError';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: () => ({
      enabled: true,
      mcpServers: [],
      mcp: { stdioAllowlist: [], inboundHost: { enabled: false, serviceRoleName: 'DEVELOPER' } },
      agent: { maxIterationsAsk: 8 },
    }),
    isModelToolsCapable: () => false,
    processAgentRun: vi.fn(),
  },
}));

vi.mock('../changeSet.service', () => ({
  changeSetService: {
    apply: vi.fn(),
  },
}));

vi.mock('../../appendoo/engineeringPipeline.service', () => ({
  engineeringPipelineService: {
    executeApprovedPromotion: vi.fn(() => ({
      promotionRunId: 'promote:test',
      promotionState: 'DEPLOYED',
      promotionPreflightOk: true,
      packageSnapshotId: 'pkg:test',
      packageRoundtripValidated: true,
      runtimeActivatedCount: 1,
      runtimeActivationFailedCount: 0,
    })),
    executeApprovedBinding: vi.fn(),
  },
}));

vi.mock('../../appendoo/semanticPlanApproval.service', () => ({
  semanticPlanApprovalService: {
    approve: vi.fn(() => ({ bindingId: 'asp-approval:test', status: 'approved' })),
  },
}));

describe('AgentService', () => {
  const service = new AgentService();

  it('rejects ask mode when model lacks tools capability', async () => {
    await expect(service.runStream(
      {
        mode: 'ask',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      1,
      () => {},
    )).rejects.toMatchObject({
      statusCode: 400,
      message: 'Ask mode requires a model with Tools capability.',
    });
  });

  it('rejects invalid payload', async () => {
    await expect(service.runStream({}, 1, () => {})).rejects.toBeInstanceOf(HttpError);
  });

  it('p-63 — v1 apply is reopened and delegates to changeSetService', async () => {
    const { changeSetService } = await import('../changeSet.service');
    const result = await service.apply({
      proposalId: 'proposal-1',
      changeSets: [{
        id: 'cs-test',
        kind: 'file_patch',
        title: 'Test patch',
        path: 'docs/appendoo/decision-log.md',
        content: '# test\n',
      }],
      confirmOverrideWarnings: true,
      mode: 'agent',
    }, 1);

    expect(result.body.success).toBe(true);
    expect(changeSetService.apply).toHaveBeenCalledOnce();
  });

  it('routes promotion approval bindings to executeApprovedPromotion', async () => {
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const result = await service.approveSemanticPlan({
      bindingId: 'promo-approval:cs:test',
      execute: true,
    }, 42);

    expect(engineeringPipelineService.executeApprovedPromotion).toHaveBeenCalledWith('promo-approval:cs:test');
    expect(result.body.approvalKind).toBe('promotion');
    expect(result.body.execution?.promotionState).toBe('DEPLOYED');
  });

  it('records chat perceived latency samples', async () => {
    const result = await service.recordChatPerceivedLatency({
      latencyMs: 24,
      activityKind: 'user_echo',
    });

    expect(result.body.success).toBe(true);
    expect(result.body.latencyMs).toBe(24);
    expect(result.body.activityKind).toBe('user_echo');
  });
});
