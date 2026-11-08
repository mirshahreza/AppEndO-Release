import { aiManager } from '../../../core/ai/AiManager';
import type { AgentMessage } from '../../../core/ai/agent/types';
import type { AgentMode, AgentRunRequest, AgentStreamEvent } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { FunctionDocAccessPrincipal } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';
import type { AiAgentCapabilityScope, AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { AiMcpServerConfig } from '../../../shared/api/contracts/ai/types';
import type { McpAccessContextSnapshot } from '../../../shared/api/contracts/ai/mcpAccess';
import { insertAgentTraces } from '../../domain/ai/agentTraceRepository';
import { updateChatSessionContextHistorySummary } from '../../domain/ai/chatHistoryRepository';
import { registerBuiltinCapabilityPacks } from './mcp/builtin';
import { registerMcpTools, type McpRegistrationWarning } from './mcp/mcpToolAdapter';
import { buildEngineeringPipelineStreamEvent } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import { buildSemanticPlanFromChangeSets } from '../../../shared/lib/appendoo/semanticPlanFromChangeSets';
import { buildPageContextPreload } from './pageContextPreload.service';
import { resolveTurnExecutionProfile, type AgentPlanActMode } from '../../../core/ai/agent/turnExecutionProfile';
import { resolveEffectiveUserIntent, detectContinuationIntent } from '../../../shared/lib/detectCodingIntent';
import { appendooGatewayService } from './appendooGateway.service';
import { contextIntelligenceService } from '../appendoo/contextIntelligence.service';
import { engineeringPipelineService } from '../appendoo/engineeringPipeline.service';
import { semanticPlanApprovalService } from '../appendoo/semanticPlanApproval.service';
import {
  extractPromptEngineeringTargets,
  mergePromptTargetsIntoPageContext,
  resolvePromptEngineeringTargets,
} from '../../../shared/lib/appendoo/promptEngineeringTargets';
import {
  buildEngineeringPipelineStreamPayload,
  formatEngineeringPipelineAgentResultMessage,
  shouldAutoExecuteEngineeringPipelineInAgent,
  shouldBuildEngineeringContextPack,
} from '../appendoo/engineeringPipelineAgentRun';
import {
  describePreloadedRetrieveSources,
  formatEngineeringPipelineStatus,
  formatReverseAuditNote,
  formatScaffoldSeedActivity,
  resolveUserDisplayLocale,
} from '../../../shared/lib/appendoo/agentActivityLabels';
import { DEFAULT_AUTONOMY_TIER, isAutoApplyAllowedForTier, type AutonomyTier } from '../../../core/ai/agent/autonomyTier';

export type AgentTrajectoryInput = {
  request: AgentRunRequest;
  messages: AgentMessage[];
  cleanMessagesForIntent: { role: AgentMessage['role']; content: string }[];
  actorUserId: number;
  effectiveMcpServers: AiMcpServerConfig[];
  runCapabilityScope: AiAgentCapabilityScope;
  mcpAccessContext?: McpAccessContextSnapshot;
  persistedHistorySummary?: string;
  docAccessPrincipal?: FunctionDocAccessPrincipal;
  /** V5 Phase P11 § V5-17 — role-resolved autonomy dial; defaults to AUTOPILOT (today's existing behavior) when omitted. */
  autonomyTier?: AutonomyTier;
  onEvent: (event: AgentStreamEvent) => void;
};

export type AgentTrajectoryResult = {
  body: {
    text: string;
    modelId: string;
    iterationCount: number;
    sessionId?: number;
  };
};

/**
 * V5 Phase P08 — sole owner of a single chat turn's trajectory: intent/routing resolution,
 * the engineering-pipeline-vs-agent-loop dispatch decision, and result/trace finalization.
 * Extracted verbatim (zero logic change) from `AgentService.runStream`'s try block so that
 * `agent.service.ts` itself no longer contains the pipeline-vs-orchestrator branch — it now
 * calls this module exactly once. `agent.service.ts` keeps request validation/authorization
 * and the HTTP error-mapping/MCP-disconnect shell, which are request-layer concerns, not
 * trajectory-ownership concerns.
 *
 * NOTE (honest, not glossed over): this is a structural-ownership fix, not a behavioral one.
 * The dual-call structure this class inherits from `runStream` is unchanged — in most branches
 * (see `agentPipelineRouting.characterization.test.ts`), `engineeringPipelineService.runScaffold`
 * and `aiManager.processAgentRun` (AgentOrchestrator) both still run for the same turn. Only the
 * "auto-execute succeeded" branch short-circuits before the agent loop. Whether that dual-call
 * product behavior (show pipeline scaffold, then also continue conversationally) is *correct*
 * is a product/architecture question this extraction does not decide — seePHASE-EVIDENCE-REPORT-P08.md.
 */
export class AgentRuntime {
  async runTrajectory(input: AgentTrajectoryInput): Promise<AgentTrajectoryResult> {
    const {
      request,
      messages,
      cleanMessagesForIntent,
      actorUserId,
      effectiveMcpServers,
      runCapabilityScope,
      mcpAccessContext,
      persistedHistorySummary,
      docAccessPrincipal,
      autonomyTier = DEFAULT_AUTONOMY_TIER,
      onEvent,
    } = input;

    const mcpRegistrationWarnings: McpRegistrationWarning[] = [];
    const lastUserIntent = [...cleanMessagesForIntent].reverse().find((message) => message.role === 'user')?.content?.trim() ?? '';
    // p-63 — user-facing labels follow the user's language, never a hardcoded locale.
    const displayLocale = resolveUserDisplayLocale(lastUserIntent);
    const preliminaryTargets = resolvePromptEngineeringTargets(
      extractPromptEngineeringTargets(lastUserIntent),
    );
    const preliminaryPageContext = mergePromptTargetsIntoPageContext(
      request.pageContext as AiPageContext | undefined,
      preliminaryTargets,
    );
    const effectiveUserIntent = resolveEffectiveUserIntent(
      cleanMessagesForIntent,
      preliminaryPageContext,
    ) || lastUserIntent;
    const routingPrompt = detectContinuationIntent(lastUserIntent) ? effectiveUserIntent : lastUserIntent;
    const promptTargets = resolvePromptEngineeringTargets(
      extractPromptEngineeringTargets(routingPrompt),
    );
    const mergedPageContext = mergePromptTargetsIntoPageContext(
      request.pageContext as AiPageContext | undefined,
      promptTargets,
    );
    // p-61 Phase B (B2) — no pre-flight LLM intent classification. Profile resolution is
    // deterministic from explicit user choices (mode + Plan/Act toggle); whether to answer or
    // implement is the model's own decision inside the agent loop. This removes 1–2 blocking
    // LLM round-trips per turn and the misrouting they caused on non-English requests.
    const llmIntentClass = null;

    const executionProfile = resolveTurnExecutionProfile(
      request.mode as AgentMode,
      routingPrompt,
      mergedPageContext,
      { agentPlanActMode: request.agentPlanActMode as AgentPlanActMode | undefined },
    );

    const { routing, applicationScope } = appendooGatewayService.resolveRunRouting({
      mode: request.mode as AgentMode,
      userPrompt: routingPrompt,
      executionProfile,
      pageContext: mergedPageContext,
      modelId: request.modelId,
      llmIntentClass,
    });

    const shouldRunEngineeringPipeline = routing.useEngineeringPipeline;

    const shouldBuildContextPack = shouldBuildEngineeringContextPack(routing);

    const contextPack = shouldBuildContextPack
      ? contextIntelligenceService.buildRunContextPack({
        applicationScope,
        pageContext: mergedPageContext,
        userPrompt: routingPrompt,
      })
      : null;

    onEvent({
      type: 'request_routing',
      requestClass: routing.requestClass,
      taskProfile: routing.taskProfile,
      routerVersion: routing.routerVersion,
      routingReason: routing.routingReason,
      useEngineeringPipeline: routing.useEngineeringPipeline,
      applicationScopeKey: applicationScope?.scopeKey,
      applicationScopeKind: applicationScope?.kind,
      contextPackId: contextPack?.contextPackId,
      contextPackTargetCount: contextPack?.primaryTargets.length,
      contextPackStandardsCount: contextPack?.engineeringStandards.length,
      contextPackSelectionExplanations: contextPack?.selectionExplanations
        .slice(0, 6)
        .map((explanation) => ({
          reasonCode: explanation.reasonCode,
          summary: explanation.summary,
        })),
    });

    // V5 Phase P11 § V5-17 — DoD: an ADVISOR_ONLY role must not auto-apply even when everything
    // else (mode/profile/policy) would otherwise allow it. ANDed onto the existing decision,
    // never widens it — AUTOPILOT (the default) preserves today's exact behavior.
    const shouldAutoExecutePipeline = shouldAutoExecuteEngineeringPipelineInAgent({
      mode: request.mode as AgentMode,
      executionProfile,
      useEngineeringPipeline: routing.useEngineeringPipeline,
    }) && isAutoApplyAllowedForTier(autonomyTier);

    let pipelineResult: ReturnType<typeof engineeringPipelineService.runScaffold> | undefined;
    let pipelineExecuted: ReturnType<typeof engineeringPipelineService.executeApprovedBinding> | undefined;
    let pipelineAutoExecuteError: string | undefined;

    const isGovernedImplement = executionProfile === 'agent_implement_governed';

    if (shouldBuildContextPack && contextPack && shouldRunEngineeringPipeline) {
      if (shouldAutoExecutePipeline) {
        onEvent({ type: 'thinking', status: formatEngineeringPipelineStatus('understanding_contract', displayLocale) });
      }

      pipelineResult = engineeringPipelineService.runScaffold({
        applicationScope,
        pageContext: mergedPageContext,
        userPrompt: routingPrompt,
        contextPack,
        executeBuilders: false,
        requiresApproval: !isGovernedImplement && routing.useEngineeringPipeline,
        requiresPromotionApproval: isGovernedImplement && routing.useEngineeringPipeline,
      });

      if (shouldAutoExecutePipeline && pipelineResult.planActionPolicy.canApprove) {
        onEvent({ type: 'thinking', status: formatEngineeringPipelineStatus('designing_and_building', displayLocale) });
        try {
          semanticPlanApprovalService.approve(
            pipelineResult.approvalBinding!.bindingId,
            String(actorUserId),
          );
          pipelineExecuted = engineeringPipelineService.executeApprovedBinding(
            pipelineResult.approvalBinding!.bindingId,
          );
        } catch (error) {
          pipelineAutoExecuteError = error instanceof Error ? error.message : String(error);
          onEvent({ type: 'thinking', status: `Build failed: ${pipelineAutoExecuteError}` });
        }
      }

      onEvent(buildEngineeringPipelineStreamEvent(
        buildEngineeringPipelineStreamPayload({
          scaffold: pipelineResult,
          contextPack,
          executed: pipelineExecuted,
          requiresApproval: !isGovernedImplement && routing.useEngineeringPipeline && !shouldAutoExecutePipeline,
          requiresPromotionApproval: isGovernedImplement && routing.useEngineeringPipeline,
          approvalStatus: pipelineExecuted ? 'approved' : pipelineResult.approvalBinding?.status,
        }),
      ));
    }

    if (shouldAutoExecutePipeline && pipelineExecuted) {
      const finalizeText = pipelineAutoExecuteError
        ? `Build failed: ${pipelineAutoExecuteError}`
        : formatEngineeringPipelineAgentResultMessage(pipelineExecuted);

      onEvent({
        type: 'text_delta',
        text: finalizeText,
      });
      onEvent({
        type: 'done',
        text: finalizeText,
        modelId: request.modelId ?? 'appendoo-pipeline',
        iterationCount: 0,
        sessionId: request.sessionId,
      });

      return {
        body: {
          text: finalizeText,
          modelId: request.modelId ?? 'appendoo-pipeline',
          iterationCount: 0,
          sessionId: request.sessionId,
        },
      };
    }

    // p-98 — dual-pipeline exclusivity: a scaffold that only needs explicit approval (not more
    // conversational context) is already a complete turn result. Returning early here stops
    // aiManager.processAgentRun from also running an orchestrator loop for the same message.
    // Gated on !shouldAutoExecutePipeline so PIPELINE_NEEDS_MORE_CONTEXT (below, requires
    // shouldAutoExecutePipeline === true) is unaffected — that case legitimately needs the agent
    // loop to converse with the user about what's missing.
    if (shouldRunEngineeringPipeline && shouldBuildContextPack && contextPack && !shouldAutoExecutePipeline) {
      const finalizeText = formatEngineeringPipelineStatus('awaiting_approval', displayLocale);
      onEvent({ type: 'text_delta', text: finalizeText });
      onEvent({
        type: 'done',
        text: finalizeText,
        modelId: request.modelId ?? 'appendoo-pipeline',
        iterationCount: 0,
        sessionId: request.sessionId,
      });
      return {
        body: {
          text: finalizeText,
          modelId: request.modelId ?? 'appendoo-pipeline',
          iterationCount: 0,
          sessionId: request.sessionId,
        },
      };
    }

    if (shouldAutoExecutePipeline && pipelineResult && !pipelineResult.planActionPolicy.canApprove) {
      onEvent({
        type: 'thinking',
        status: formatEngineeringPipelineStatus('needs_more_context', displayLocale),
      });
    }

    const pagePreload = await buildPageContextPreload(
      mergedPageContext,
      routingPrompt,
      executionProfile,
    );

    if (pagePreload.block?.trim()) {
      const seedLabel = formatScaffoldSeedActivity(
        describePreloadedRetrieveSources(pagePreload.preloadedRetrieve, displayLocale),
        displayLocale,
      );
      onEvent({
        type: 'activity_note',
        noteKind: 'scaffold_seed',
        title: seedLabel.title,
        detail: seedLabel.detail ?? seedLabel.intention,
      });
    }

    const result = await aiManager.processAgentRun({
      messages,
      mode: request.mode as AgentMode,
      executionProfile,
      useEngineeringPipeline: routing.useEngineeringPipeline,
      modelId: request.modelId,
      pageContext: mergedPageContext,
      contextResources: request.contextResources,
      enabledMcpServerIds: runCapabilityScope.mcpServerIds,
      enabledCapabilityPackIds: runCapabilityScope.packIds as AiCapabilityPackId[],
      persistedHistorySummary,
      planDocumentPath: request.planDocumentPath,
      docAccessPrincipal,
      mcpAccessContext,
      pageContextPreload: pagePreload.block ?? undefined,
      preloadedRetrieve: pagePreload.preloadedRetrieve,
      prepareRegistry: async (registry) => {
        registerBuiltinCapabilityPacks(registry, runCapabilityScope.packIds);
        const mcpResult = await registerMcpTools(
          registry,
          effectiveMcpServers,
          runCapabilityScope.mcpServerIds,
        );
        mcpRegistrationWarnings.push(...mcpResult.warnings);
        mcpResult.warnings.forEach((warning) => {
          onEvent({
            type: 'mcp_warning',
            serverId: warning.serverId,
            serverLabel: warning.serverLabel,
            message: warning.message,
          });
        });
      },
      onEvent,
    });

    if (routing.useEngineeringPipeline && result.changeSets?.length) {
      const reversePlan = buildSemanticPlanFromChangeSets({
        changeSets: result.changeSets,
        userPrompt: routingPrompt,
        applicationScope,
        contextPackId: contextPack?.contextPackId,
      });
      if (reversePlan) {
        const reverseAuditNote = formatReverseAuditNote(
          reversePlan.proposedArtifacts.length,
          reversePlan.objective,
          displayLocale,
        );
        onEvent({
          type: 'activity_note',
          noteKind: 'reverse_audit',
          title: reverseAuditNote.title,
          detail: reverseAuditNote.detail,
        });
      }
    }

    await insertAgentTraces({
      sessionId: request.sessionId,
      userId: actorUserId,
      mode: request.mode,
      traces: [
        ...mcpRegistrationWarnings.map((warning) => ({
          iteration: 0,
          modelId: result.modelId,
          policyAction: 'stop' as const,
          summary: 'mcp_registration_warning',
          toolName: warning.serverId,
          error: warning.message,
        })),
        ...result.traces,
      ],
    });

    if (
      request.sessionId
      && result.contextHistorySummary?.trim()
      && result.contextHistorySummary.trim() !== persistedHistorySummary?.trim()
    ) {
      await updateChatSessionContextHistorySummary({
        sessionId: request.sessionId,
        userId: actorUserId,
        actorId: actorUserId,
        contextHistorySummary: result.contextHistorySummary.trim(),
      });
    }

    onEvent({
      type: 'done',
      text: result.text,
      modelId: result.modelId,
      iterationCount: result.iterationCount,
      sessionId: request.sessionId,
      tokensEstimate: result.tokensEstimate,
      tokensBudget: result.tokensBudget,
      retrievalOperationCount: result.retrievalOperationCount,
      draftToolCount: result.draftToolCount,
    });

    return {
      body: {
        text: result.text,
        modelId: result.modelId,
        iterationCount: result.iterationCount,
        sessionId: request.sessionId,
      },
    };
  }
}

export const agentRuntime = new AgentRuntime();
