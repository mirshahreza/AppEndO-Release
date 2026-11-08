import { aiManager } from '../../../core/ai/AiManager';
import type { AgentMessage } from '../../../core/ai/agent/types';
import type { AgentMode, AgentRunRequest } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { TurnExecutionProfile } from '../../../core/ai/agent/turnExecutionProfile';
import type { AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { AgentTaskJobEnvelope } from '../../domain/jobs/jobTypes';
import { logger } from '../../../core/logging/Logger';
import { resolveAgentRunContext } from '../ai/agent.service';
import { disconnectMcpServers } from '../ai/mcp/mcpToolAdapter';
import { registerBuiltinCapabilityPacks } from '../ai/mcp/builtin';
import { registerMcpTools } from '../ai/mcp/mcpToolAdapter';

/**
 * p-98/p-102 V5 Phase P11 section V5-21 async/background execution — executes one agent turn as a
 * background job instead of blocking an HTTP request. Reuses the exact same production entry
 * point the synchronous chat path uses (`aiManager.processAgentRun` → `AgentOrchestrator.run()`)
 * — this is not a second, parallel agent-execution path (`ANTI-SCAFFOLD-RULES.md` q1/q12).
 *
 * p-102 — this used to call `aiManager.processAgentRun` with no `prepareRegistry` at all, meaning
 * a background run only ever got the narrow M2g tool set (prune/artifact tools) — no
 * search_codebase, no read_file, no draft_*, nothing capability-pack- or MCP-provided. Now resolves
 * tool access through `resolveAgentRunContext` — the exact same resolver the synchronous chat path
 * (`agent.service.ts:runStream`) uses — so a background run sees the same tools a foreground run
 * of the same request would.
 *
 * DoD (phase doc, literal): a large task must be able to leave the session UI and later resume/reconstruct
 * results from AgentEventStore (Phase 01). Passing `taskId`/`attemptId` through is what
 * makes that literally true: `AgentEventStore` durably persists every event as it happens (P09 §
 * V5-13), so even if this job process crashes or the caller never polls again immediately, a
 * later `loadEventLog(taskId, attemptId)` + `replayOperationalState` reconstructs exact progress
 * — see `crashRecovery.test.ts` for the same mechanism already proven under a crash scenario.
 *
 * `maxAttempts: 1` on the enqueue side (`jobRepository.ts`) is deliberate: this job type does not
 * lean on the generic job-retry mechanism for its own resilience — P09's `pendingUnknownOutcomes`
 * gate already governs whether a resumed run may safely repeat a specific tool call, at a finer
 * grain than "retry the whole job." A caller wanting to explicitly resume after a failure should
 * enqueue a NEW job with the SAME taskId/attemptId, not rely on `retryFailedJob`.
 */
export type AgentTaskJobResult = {
  text: string;
  taskId: string;
  attemptId: string;
  modelId: string;
  iterationCount: number;
};

export const executeAgentTaskForJob = async (
  envelope: AgentTaskJobEnvelope,
): Promise<AgentTaskJobResult> => {
  const messages: AgentMessage[] = envelope.messages.map((message) => ({
    role: message.role,
    content: message.content,
    toolCallId: message.toolCallId,
    name: message.name,
  }));

  // `pageContext` is stored loosely (`Record<string, unknown>`) on the job envelope since it's
  // opaque JSON round-tripping through the job payload column; it originated from a real
  // `AiPageContext` at enqueue time (see `agent.routes.ts`'s request body), so the cast is safe.
  const pageContext = envelope.pageContext as AiPageContext | undefined;

  // Same shape `agent.service.ts:runStream` normalizes an HTTP body into — reconstructed here
  // from the already-validated envelope, not re-parsed from raw input.
  const request: AgentRunRequest = {
    sessionId: envelope.sessionId,
    mode: envelope.mode,
    messages: envelope.messages,
    modelId: envelope.modelId,
    pageContext,
    enabledCapabilityPackIds: envelope.enabledCapabilityPackIds,
    enabledMcpServerIds: envelope.enabledMcpServerIds,
  };

  const {
    effectiveMcpServers,
    runCapabilityScope,
    enabledMcpServers,
    mcpAccessContext,
    persistedHistorySummary,
  } = await resolveAgentRunContext(request, envelope.actorUserId);

  try {
    const result = await aiManager.processAgentRun({
      messages,
      mode: envelope.mode as AgentMode,
      executionProfile: envelope.executionProfile as TurnExecutionProfile,
      useEngineeringPipeline: envelope.useEngineeringPipeline,
      modelId: envelope.modelId,
      pageContext,
      enabledMcpServerIds: runCapabilityScope.mcpServerIds,
      enabledCapabilityPackIds: runCapabilityScope.packIds as AiCapabilityPackId[],
      mcpAccessContext,
      persistedHistorySummary,
      taskId: envelope.taskId,
      attemptId: envelope.attemptId,
      // No live SSE connection is watching a background job — warnings go to the log instead of
      // an onEvent stream nobody is listening to; the run itself is unaffected either way.
      prepareRegistry: async (registry) => {
        registerBuiltinCapabilityPacks(registry, runCapabilityScope.packIds);
        const mcpResult = await registerMcpTools(
          registry,
          effectiveMcpServers,
          runCapabilityScope.mcpServerIds,
        );
        mcpResult.warnings.forEach((warning) => {
          logger.warn('AgentTaskJob', `MCP registration warning for task ${envelope.taskId}: ${warning.message}`, {
            serverId: warning.serverId,
          });
        });
      },
      onEvent: () => {},
    });

    return {
      text: result.text,
      taskId: envelope.taskId,
      attemptId: envelope.attemptId,
      modelId: result.modelId,
      iterationCount: result.iterationCount,
    };
  } finally {
    await disconnectMcpServers(enabledMcpServers.map((server) => server.id));
  }
};
