import { aiManager } from '../../../core/ai/AiManager';
import type { AgentMessage } from '../../../core/ai/agent/types';
import type { AgentRunRequest, AgentStreamEvent } from '../../../shared/api/contracts/ai/agentTypes';
import {
  normalizeAgentApplyRequest,
  normalizeAgentChatLatencyRequest,
  normalizeAgentProposalFeedbackRequest,
  normalizeAgentRollbackRequest,
  normalizeAgentRunRequest,
} from '../../../shared/api/contracts/ai/agentValidators';
import { AiValidationError } from '../../../shared/api/contracts/ai/errors';
import type { FunctionDocAccessPrincipal } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';
import type { AiMcpServerConfig, AiSettings } from '../../../shared/api/contracts/ai/types';
import type { AiAgentCapabilityScope, AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { McpAccessContextSnapshot } from '../../../shared/api/contracts/ai/mcpAccess';
import type { AutonomyTier } from '../../../core/ai/agent/autonomyTier';
import { findChatSessionForUser } from '../../domain/ai/chatHistoryRepository';
import { HttpError } from '../../errors/HttpError';
import { disconnectMcpServers } from './mcp/mcpToolAdapter';
import { resolveEnabledMcpServers } from './mcp/McpBridge';
import { resolveEffectiveMcpServers } from './mcp/packageMcpRegistry';
import {
  assertAgentRunWithinMcpAccess,
  intersectAgentRunCapabilityScope,
  mcpAccessService,
  resolveEffectiveMcpAccessForUser,
} from './mcpAccess.service';
import { changeSetService } from './changeSet.service';
import { enrichAgentMessageContent } from '../../../shared/api/contracts/ai/agentMessageAttachments';
import { ASK_AGENT_CAPABILITY_SCOPE } from '../../../shared/api/contracts/ai/capabilityPacks';
import { engineeringPipelineService } from '../appendoo/engineeringPipeline.service';
import { isV1DirectWriteBlocked, V1_DIRECT_WRITE_BLOCKED_MESSAGE } from '../../../shared/lib/appendoo/appendooCutover';
import { isPromotionApprovalBinding } from '../../../shared/lib/appendoo/engineeringPipelineApprovalUi';
import { ingestPerceivedLatencySample } from '../../../shared/lib/appendoo/chatPerceivedLatencyTelemetry';
import { semanticPlanApprovalService } from '../appendoo/semanticPlanApproval.service';
import { agentRuntime } from './AgentRuntime';
import { getUserRolesForRequest } from '../../domain/users/userRoleRepository';
import { resolveAutonomyTierForRoles } from '../../../core/ai/agent/autonomyTier';

export type ResolvedAgentRunContext = {
  settings: AiSettings;
  messages: AgentMessage[];
  cleanMessagesForIntent: { role: AgentMessage['role']; content: string }[];
  effectiveMcpServers: AiMcpServerConfig[];
  runCapabilityScope: AiAgentCapabilityScope;
  enabledMcpServers: AiMcpServerConfig[];
  mcpAccessContext?: McpAccessContextSnapshot;
  autonomyTier: AutonomyTier;
  persistedHistorySummary?: string;
};

/**
 * p-102 — extracted from `AgentService.runStream` so a background job (`agentTaskJobExecutor.ts`)
 * can resolve tool access exactly the same way the synchronous chat path does, instead of the
 * shortcut it used to take (a bare `aiManager.processAgentRun` call with no capability-pack/MCP
 * resolution at all — confirmed during design that this left background runs with almost no
 * usable tools). Same discipline as the rest of p-98: one resolver, not a second divergent path.
 */
export const resolveAgentRunContext = async (
  request: AgentRunRequest,
  actorUserId: number,
): Promise<ResolvedAgentRunContext> => {
  const settings = aiManager.getSettings();
  if (!settings?.enabled) {
    throw new HttpError(503, 'AI is disabled in platform settings.');
  }

  const messages: AgentMessage[] = request.messages.map((message) => ({
    role: message.role,
    content: enrichAgentMessageContent(message.content, message.attachments),
    toolCallId: message.toolCallId,
    name: message.name,
  }));

  // Intent/routing must use clean UI content — never the model-enriched payload
  // (which can embed multi-hundred-KB data URLs from image attachments).
  const cleanMessagesForIntent = request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const effectiveMcpServers = resolveEffectiveMcpServers(settings.mcpServers);

  const mcpAccess = await resolveEffectiveMcpAccessForUser(actorUserId, {
    settingsMcpServers: settings.mcpServers,
    mcpSettings: settings.mcp,
  });

  let sessionScope = undefined;
  let persistedHistorySummary: string | undefined;

  if (request.sessionId) {
    const session = await findChatSessionForUser(request.sessionId, actorUserId);
    if (session) {
      if (request.mode !== 'ask') {
        sessionScope = session.agentCapabilityScope;
      }
      persistedHistorySummary = session.contextHistorySummary ?? undefined;
    }
  }

  const runCapabilityScope = request.mode === 'ask'
    ? ASK_AGENT_CAPABILITY_SCOPE
    : intersectAgentRunCapabilityScope(
      {
        enabledCapabilityPackIds: request.enabledCapabilityPackIds as AiCapabilityPackId[] | undefined,
        enabledMcpServerIds: request.enabledMcpServerIds,
      },
      sessionScope,
      mcpAccess,
    );

  if (request.mode !== 'ask') {
    assertAgentRunWithinMcpAccess(
      runCapabilityScope,
      {
        enabledCapabilityPackIds: request.enabledCapabilityPackIds as AiCapabilityPackId[] | undefined,
        enabledMcpServerIds: request.enabledMcpServerIds,
      },
      mcpAccess,
      { userId: actorUserId, sessionId: request.sessionId },
    );
  }

  const enabledMcpServers = request.mode === 'ask'
    ? []
    : resolveEnabledMcpServers(
      effectiveMcpServers,
      runCapabilityScope.mcpServerIds,
    );

  const mcpAccessContext = request.mode === 'ask'
    ? undefined
    : await mcpAccessService.buildMcpAccessContextSnapshotForScope(
      runCapabilityScope,
      settings.mcpServers,
    );

  // V5 Phase P11 § V5-17 — reuses the same real role lookup already used by
  // mcpAccess.service.ts/login.service.ts, not a new/duplicate role-resolution path.
  const actorRoles = await getUserRolesForRequest(actorUserId);
  const autonomyTier = resolveAutonomyTierForRoles(actorRoles);

  return {
    settings,
    messages,
    cleanMessagesForIntent,
    effectiveMcpServers,
    runCapabilityScope,
    enabledMcpServers,
    mcpAccessContext,
    autonomyTier,
    persistedHistorySummary,
  };
};

export class AgentService {
  async runStream(
    body: unknown,
    actorUserId: number,
    onEvent: (event: AgentStreamEvent) => void,
    options?: { docAccessPrincipal?: FunctionDocAccessPrincipal },
  ) {
    let request;
    try {
      request = normalizeAgentRunRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    if (
      (request.mode === 'ask' || request.mode === 'agent' || request.mode === 'plan')
      && !aiManager.isModelToolsCapable(request.modelId)
    ) {
      throw new HttpError(
        400,
        `${request.mode === 'ask' ? 'Ask' : request.mode === 'plan' ? 'Plan' : 'Agent'} mode requires a model with Tools capability.`,
      );
    }

    const {
      messages,
      cleanMessagesForIntent,
      effectiveMcpServers,
      runCapabilityScope,
      enabledMcpServers,
      mcpAccessContext,
      autonomyTier,
      persistedHistorySummary,
    } = await resolveAgentRunContext(request, actorUserId);

    try {
      return await agentRuntime.runTrajectory({
        request,
        messages,
        cleanMessagesForIntent,
        actorUserId,
        effectiveMcpServers,
        runCapabilityScope,
        mcpAccessContext,
        autonomyTier,
        persistedHistorySummary,
        docAccessPrincipal: options?.docAccessPrincipal,
        onEvent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent run failed.';
      if (/does not support tool calling/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    } finally {
      await disconnectMcpServers(enabledMcpServers.map((server) => server.id));
    }
  }

  async apply(body: unknown, actorUserId: number) {
    let request;
    try {
      request = normalizeAgentApplyRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    if (isV1DirectWriteBlocked()) {
      throw new HttpError(403, V1_DIRECT_WRITE_BLOCKED_MESSAGE);
    }

    const result = await changeSetService.apply(request, actorUserId, settings.agent);
    return { body: { success: true as const, ...result } };
  }

  async rollback(body: unknown, actorUserId: number) {
    let request;
    try {
      request = normalizeAgentRollbackRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    const result = await changeSetService.rollback(request, actorUserId);
    return { body: { success: true as const, ...result } };
  }

  async recordProposalFeedback(body: unknown) {
    let request;
    try {
      request = normalizeAgentProposalFeedbackRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    const result = changeSetService.recordDismissedProposal(request);
    return { body: { success: true as const, ...result } };
  }

  async recordChatPerceivedLatency(body: unknown) {
    let request;
    try {
      request = normalizeAgentChatLatencyRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    const sample = ingestPerceivedLatencySample({
      latencyMs: request.latencyMs,
      activityKind: request.activityKind,
    });
    return {
      body: {
        success: true as const,
        latencyMs: sample.latencyMs,
        activityKind: sample.activityKind,
        recordedAt: sample.recordedAt,
      },
    };
  }

  async getLatestApplyId(sessionId: number | undefined, actorUserId: number) {
    const result = await changeSetService.getLatestApplyDetails(sessionId, actorUserId);
    return { body: { success: true as const, ...result } };
  }

  async approveSemanticPlan(body: unknown, actorUserId: number) {
    const bindingId = typeof (body as { bindingId?: unknown })?.bindingId === 'string'
      ? (body as { bindingId: string }).bindingId.trim()
      : '';
    const execute = (body as { execute?: unknown })?.execute === true;

    if (!bindingId) {
      throw new HttpError(400, 'bindingId is required.');
    }

    if (isPromotionApprovalBinding(bindingId)) {
      if (!execute) {
        throw new HttpError(400, 'execute must be true for promotion approval.');
      }

      const promotion = engineeringPipelineService.executeApprovedPromotion(bindingId);
      return {
        body: {
          success: true as const,
          approvalKind: 'promotion' as const,
          execution: {
            promotionRunId: promotion.promotionRunId,
            promotionState: promotion.promotionState,
            promotionPreflightOk: promotion.promotionPreflightOk,
            packageSnapshotId: promotion.packageSnapshotId,
            packageRoundtripValidated: promotion.packageRoundtripValidated,
            runtimeActivatedCount: promotion.runtimeActivatedCount,
            runtimeActivationFailedCount: promotion.runtimeActivationFailedCount,
          },
        },
      };
    }

    const approved = semanticPlanApprovalService.approve(bindingId, String(actorUserId));
    const execution = execute
      ? engineeringPipelineService.executeApprovedBinding(bindingId)
      : undefined;

    return {
      body: {
        success: true as const,
        approvalKind: 'semantic_plan' as const,
        binding: approved,
        execution: execution
          ? {
            workspaceId: execution.workspaceId,
            revisionId: execution.revisionId,
            executedNodeCount: execution.executedNodeCount,
            failedNodeCount: execution.failedNodeCount,
            reconciledNodeCount: execution.reconciledNodeCount,
            verificationRunId: execution.verificationRunId,
            deployable: execution.deployable,
            verificationPassCount: execution.verificationPassCount,
            verificationFailCount: execution.verificationFailCount,
            promotionRunId: execution.promotionRunId,
            promotionState: execution.promotionState,
            promotionPreflightOk: execution.promotionPreflightOk,
            packageSnapshotId: execution.packageSnapshotId,
            packageRoundtripValidated: execution.packageRoundtripValidated,
            runtimeActivatedCount: execution.runtimeActivatedCount,
            runtimeActivationFailedCount: execution.runtimeActivationFailedCount,
            checkpointId: execution.checkpointId,
            changeSetId: execution.changeSetId,
            revisionFingerprint: execution.revisionFingerprint,
            mutationPathCount: execution.mutationPathCount,
            mutationPathPreview: execution.mutationPathPreview,
            workspaceStorageKind: execution.workspaceStorageKind,
            verifiedNodeCount: execution.verifiedNodeCount,
            revisionNumber: execution.revisionNumber,
            parentRevisionId: execution.parentRevisionId,
            workspaceState: execution.workspaceState,
            revisionState: execution.revisionState,
            workspaceLineageLabel: execution.workspaceLineageLabel,
            failedRevisionId: execution.failedRevisionId,
            repairRevisionId: execution.repairRevisionId,
            repairRevisionNumber: execution.repairRevisionNumber,
            changeGraphVerifiedCount: execution.verifiedNodeCount,
            changeGraphFailedCount: execution.failedNodeCount > 0 ? execution.failedNodeCount : undefined,
            verificationGraderSummary: execution.verificationGraderSummary,
            designerHandoff: execution.designerHandoff,
          }
          : undefined,
      },
    };
  }

  async executeRepairRevision(body: unknown, actorUserId: number) {
    const bindingId = typeof (body as { bindingId?: unknown })?.bindingId === 'string'
      ? (body as { bindingId: string }).bindingId.trim()
      : '';
    const workspaceId = typeof (body as { workspaceId?: unknown })?.workspaceId === 'string'
      ? (body as { workspaceId: string }).workspaceId.trim()
      : '';
    const repairRevisionId = typeof (body as { repairRevisionId?: unknown })?.repairRevisionId === 'string'
      ? (body as { repairRevisionId: string }).repairRevisionId.trim()
      : '';

    if (!bindingId || !workspaceId || !repairRevisionId) {
      throw new HttpError(400, 'bindingId, workspaceId, and repairRevisionId are required.');
    }

    void actorUserId;

    const execution = engineeringPipelineService.executeRepairRevision({
      bindingId,
      workspaceId,
      repairRevisionId,
    });

    return {
      body: {
        success: true as const,
        execution: {
          workspaceId: execution.workspaceId,
          revisionId: execution.revisionId,
          executedNodeCount: execution.executedNodeCount,
          failedNodeCount: execution.failedNodeCount,
          reconciledNodeCount: execution.reconciledNodeCount,
          verificationRunId: execution.verificationRunId,
          deployable: execution.deployable,
          verificationPassCount: execution.verificationPassCount,
          verificationFailCount: execution.verificationFailCount,
          promotionRunId: execution.promotionRunId,
          promotionState: execution.promotionState,
          promotionPreflightOk: execution.promotionPreflightOk,
          packageSnapshotId: execution.packageSnapshotId,
          packageRoundtripValidated: execution.packageRoundtripValidated,
          runtimeActivatedCount: execution.runtimeActivatedCount,
          runtimeActivationFailedCount: execution.runtimeActivationFailedCount,
          checkpointId: execution.checkpointId,
          changeSetId: execution.changeSetId,
          revisionFingerprint: execution.revisionFingerprint,
          mutationPathCount: execution.mutationPathCount,
          mutationPathPreview: execution.mutationPathPreview,
          workspaceStorageKind: execution.workspaceStorageKind,
          verifiedNodeCount: execution.verifiedNodeCount,
          revisionNumber: execution.revisionNumber,
          parentRevisionId: execution.parentRevisionId,
          workspaceState: execution.workspaceState,
          revisionState: execution.revisionState,
          workspaceLineageLabel: execution.workspaceLineageLabel,
          failedRevisionId: execution.failedRevisionId,
          repairRevisionId: execution.repairRevisionId,
          repairRevisionNumber: execution.repairRevisionNumber,
          repairReExecuted: execution.repairReExecuted,
          changeGraphVerifiedCount: execution.verifiedNodeCount,
          changeGraphFailedCount: execution.failedNodeCount > 0 ? execution.failedNodeCount : undefined,
          verificationGraderSummary: execution.verificationGraderSummary,
        },
      },
    };
  }
}
