import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AgentService } from '../agent.service';
import type { AgentStreamEvent } from '../../../../shared/api/contracts/ai/agentTypes';

/**
 * V5 Phase P08 — full-control-flow characterization of `AgentService.runStream`.
 *
 * Purpose: `agent.service.test.ts` never exercises the routing/dispatch logic at all (the
 * `isModelToolsCapable: () => false` guard rejects every request before reaching it). This file
 * fills that gap by driving `runStream` end-to-end with every collaborator mocked, and proves —
 * with real assertions on call counts, not inference — exactly which of `engineeringPipelineService`
 * and `aiManager.processAgentRun` run, and in what combination, for each of the 5 branches the
 * current sequential-conditional structure can take. This is the regression net P08's original
 * evidence report said was missing before any real unification attempt.
 */

const contextPackFixture = {
  contextPackId: 'cp-fixture',
  revision: 1,
  primaryTargets: [],
  engineeringStandards: [],
  selectionExplanations: [],
};

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: () => ({
      enabled: true,
      mcpServers: [],
      mcp: { stdioAllowlist: [], inboundHost: { enabled: false, serviceRoleName: 'DEVELOPER' } },
      agent: { maxIterationsAsk: 8 },
    }),
    isModelToolsCapable: () => true,
    processAgentRun: vi.fn(async () => ({
      text: 'agent-loop-response',
      modelId: 'test-model',
      iterationCount: 1,
      traces: [],
      changeSets: [],
    })),
  },
}));

vi.mock('../appendooGateway.service', () => ({
  appendooGatewayService: {
    resolveRunRouting: vi.fn(),
  },
}));

vi.mock('../../appendoo/contextIntelligence.service', () => ({
  contextIntelligenceService: {
    buildRunContextPack: vi.fn(() => contextPackFixture),
  },
}));

vi.mock('../../appendoo/engineeringPipeline.service', () => ({
  engineeringPipelineService: {
    runScaffold: vi.fn(),
    executeApprovedBinding: vi.fn(),
    executeApprovedPromotion: vi.fn(),
    executeRepairRevision: vi.fn(),
  },
}));

vi.mock('../../appendoo/semanticPlanApproval.service', () => ({
  semanticPlanApprovalService: {
    approve: vi.fn(() => ({ bindingId: 'asp-approval:test', status: 'approved' })),
  },
}));

vi.mock('../mcpAccess.service', async () => {
  const actual = await vi.importActual<typeof import('../mcpAccess.service')>('../mcpAccess.service');
  return {
    ...actual,
    resolveEffectiveMcpAccessForUser: vi.fn(async () => ({
      adminBypass: false,
      packIds: [],
      mcpServerIds: [],
    })),
    mcpAccessService: {
      ...actual.mcpAccessService,
      buildMcpAccessContextSnapshotForScope: vi.fn(async () => ({ packLabels: [], mcpServerLabels: [] })),
    },
  };
});

vi.mock('../mcp/builtin', async () => {
  const actual = await vi.importActual<typeof import('../mcp/builtin')>('../mcp/builtin');
  return {
    ...actual,
    registerBuiltinCapabilityPacks: vi.fn(),
  };
});

vi.mock('../mcp/mcpToolAdapter', () => ({
  registerMcpTools: vi.fn(async () => ({ warnings: [] })),
  disconnectMcpServers: vi.fn(async () => {}),
}));

vi.mock('../pageContextPreload.service', () => ({
  buildPageContextPreload: vi.fn(async () => ({ block: null, preloadedRetrieve: undefined })),
}));

vi.mock('../../../domain/ai/chatHistoryRepository', () => ({
  findChatSessionForUser: vi.fn(async () => null),
  updateChatSessionContextHistorySummary: vi.fn(async () => {}),
}));

vi.mock('../../../domain/ai/agentTraceRepository', () => ({
  insertAgentTraces: vi.fn(async () => {}),
}));

vi.mock('../../../domain/users/userRoleRepository', () => ({
  getUserRolesForRequest: vi.fn(async () => ['DEVELOPER']),
}));

vi.mock('../../../../core/ai/agent/autonomyTier', async () => {
  const actual = await vi.importActual<typeof import('../../../../core/ai/agent/autonomyTier')>('../../../../core/ai/agent/autonomyTier');
  return {
    ...actual,
    resolveAutonomyTierForRoles: vi.fn(actual.resolveAutonomyTierForRoles),
  };
});

const baseRouting = {
  requestClass: 'ENGINEERING_CHANGE',
  taskProfile: 'implement',
  routerVersion: 'v5-test',
  routingReason: 'test-fixture',
  useEngineeringPipeline: true,
};

const buildScaffoldResult = (overrides: Record<string, unknown> = {}) => ({
  plan: { planId: 'plan-1', revision: 1, objective: 'test', status: 'draft', authority: 'ai', blockingIssues: [] },
  planSummary: { artifactCount: 1, capabilityGapCount: 0 },
  planActionPolicy: { canApprove: true },
  approvalBinding: { bindingId: 'asp-approval:test', status: 'pending' },
  changeGraph: undefined,
  changeGraphSummary: undefined,
  changeGraphDriftOk: true,
  changeGraphDriftStaleCount: 0,
  builderOrchestrationErrors: [],
  workspaceId: 'ws-1',
  revisionId: 'rev-1',
  executedNodeCount: 0,
  failedNodeCount: 0,
  reconciledNodeCount: 0,
  verificationRunId: undefined,
  deployable: false,
  verificationPassCount: 0,
  verificationFailCount: 0,
  ...overrides,
});

describe('V5 P08 — agent.service.runStream full control-flow characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const run = async (mode: 'agent' | 'ask' | 'plan', prompt: string) => {
    const events: AgentStreamEvent[] = [];
    const service = new AgentService();
    await service.runStream(
      { mode, messages: [{ role: 'user', content: prompt }] },
      1,
      (event) => events.push(event),
    );
    return events;
  };

  it('AGENT_LOOP: useEngineeringPipeline=false calls only aiManager.processAgentRun, never the pipeline', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting, useEngineeringPipeline: false, requestClass: 'CONVERSATION' },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });

    await run('agent', 'hello there');

    expect(engineeringPipelineService.runScaffold).not.toHaveBeenCalled();
    expect(aiManager.processAgentRun).toHaveBeenCalledTimes(1);
  });

  it('PIPELINE_SCAFFOLD_AWAITING_APPROVAL: pipeline applicable but not agent_implement — runScaffold runs, processAgentRun does NOT (p-98 exclusivity fix)', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });
    (engineeringPipelineService.runScaffold as ReturnType<typeof vi.fn>).mockReturnValue(buildScaffoldResult());

    // 'plan' mode resolves to the 'plan_authoring' profile (turnExecutionProfile.ts), which
    // shouldAutoExecuteEngineeringPipelineInAgent requires mode==='agent' to auto-execute — so
    // shouldAutoExecutePipeline is false here while useEngineeringPipeline is still forced true
    // via the routing mock above. (mode==='agent' always resolves to 'agent_implement' per
    // turnExecutionProfile.ts's docstring — there is no content-based 'agent_lookup' routing
    // anymore, so this profile can't be reached by prompt wording alone in agent mode.)
    await run('plan', 'what does this component do?');

    expect(engineeringPipelineService.runScaffold).toHaveBeenCalledTimes(1);
    expect(aiManager.processAgentRun).not.toHaveBeenCalled();
  });

  it('PIPELINE_AUTO_EXECUTED: agent_implement + auto-execute success — runScaffold runs, processAgentRun does NOT (early return)', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });
    (engineeringPipelineService.runScaffold as ReturnType<typeof vi.fn>).mockReturnValue(buildScaffoldResult());
    (engineeringPipelineService.executeApprovedBinding as ReturnType<typeof vi.fn>).mockReturnValue(
      buildScaffoldResult({ deployable: true }),
    );

    // 'implement' verb classifies as agent_implement in resolveTurnExecutionProfile's regex path.
    const events = await run('agent', 'implement the export users feature now');

    expect(engineeringPipelineService.runScaffold).toHaveBeenCalledTimes(1);
    expect(engineeringPipelineService.executeApprovedBinding).toHaveBeenCalledTimes(1);
    expect(aiManager.processAgentRun).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'done')).toBe(true);
  });

  it('V5 P11 § V5-17: an ADVISOR_ONLY role blocks auto-execute even under conditions that would otherwise trigger PIPELINE_AUTO_EXECUTED', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    const { resolveAutonomyTierForRoles } = await import('../../../../core/ai/agent/autonomyTier');
    (resolveAutonomyTierForRoles as ReturnType<typeof vi.fn>).mockReturnValueOnce('ADVISOR_ONLY');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });
    (engineeringPipelineService.runScaffold as ReturnType<typeof vi.fn>).mockReturnValue(buildScaffoldResult());

    // Same prompt as the PIPELINE_AUTO_EXECUTED test above — only the role's autonomy tier differs.
    await run('agent', 'implement the export users feature now');

    // Auto-execute must NOT happen: no executeApprovedBinding. The scaffold (requiring explicit
    // approval) is the complete turn result — p-98 exclusivity means it does NOT also fall
    // through to a redundant agent loop.
    expect(engineeringPipelineService.runScaffold).toHaveBeenCalledTimes(1);
    expect(engineeringPipelineService.executeApprovedBinding).not.toHaveBeenCalled();
    expect(aiManager.processAgentRun).not.toHaveBeenCalled();
  });

  it('PIPELINE_NEEDS_MORE_CONTEXT: agent_implement + auto-execute requested but canApprove=false — runScaffold runs, then falls through to processAgentRun too', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });
    (engineeringPipelineService.runScaffold as ReturnType<typeof vi.fn>).mockReturnValue(
      buildScaffoldResult({ planActionPolicy: { canApprove: false } }),
    );

    await run('agent', 'implement the export users feature now');

    expect(engineeringPipelineService.runScaffold).toHaveBeenCalledTimes(1);
    expect(engineeringPipelineService.executeApprovedBinding).not.toHaveBeenCalled();
    expect(aiManager.processAgentRun).toHaveBeenCalledTimes(1);
  });

  it('auto-execute throwing mid-flight silently falls through to processAgentRun as well (latent masking behavior, confirmed live)', async () => {
    const { appendooGatewayService } = await import('../appendooGateway.service');
    const { engineeringPipelineService } = await import('../../appendoo/engineeringPipeline.service');
    const { aiManager } = await import('../../../../core/ai/AiManager');
    (appendooGatewayService.resolveRunRouting as ReturnType<typeof vi.fn>).mockReturnValue({
      routing: { ...baseRouting },
      applicationScope: null,
      modelCapabilities: null,
      taskProfilePolicyOk: true,
      taskProfilePolicyErrors: [],
    });
    (engineeringPipelineService.runScaffold as ReturnType<typeof vi.fn>).mockReturnValue(buildScaffoldResult());
    (engineeringPipelineService.executeApprovedBinding as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('builder execution failed');
    });

    const events = await run('agent', 'implement the export users feature now');

    expect(engineeringPipelineService.runScaffold).toHaveBeenCalledTimes(1);
    expect(engineeringPipelineService.executeApprovedBinding).toHaveBeenCalledTimes(1);
    expect(aiManager.processAgentRun).toHaveBeenCalledTimes(1);
    // p-98 bonus fix — the error is no longer silently swallowed: a thinking event carries it.
    expect(events.some((event) => (
      event.type === 'thinking' && event.status.includes('builder execution failed')
    ))).toBe(true);
  });
});
