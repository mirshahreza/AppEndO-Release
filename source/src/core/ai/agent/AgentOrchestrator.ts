import { createHash } from 'crypto';
import type { ChatWithToolsResult, IAiProvider, ToolDefinition } from '../IAiProvider';
import { logger } from '../../logging/Logger';
import { HTTP_REQUEST_TOOL_NAME, redactHttpRequestArgsForTrace } from '../tools/httpRequestTool';
import { assembleAgentContext, estimateMessagesTokens } from './contextAssembly';
import { resolveSegmentHistorySummary, shouldBuildSegmentHistorySummary } from './historySegmentSummary';
import { AgentContextMemory } from './contextMemory';
import type { OrchestrationPolicy } from './orchestrationPolicy';
import { defaultOrchestrationPolicy } from './orchestrationPolicy';
import type {
  AgentIterationTrace,
  AgentMessage,
  AgentRunConfig,
  AgentRunResult,
  RecentToolInvocation,
} from './types';
import type { AgentStreamEvent, AgentPlanPayload } from '../../../shared/api/contracts/ai/agentTypes';
import { buildChangeSetsFromDrafts, createProposalId } from '../validation/changeSetBuilder';
import { validateProposal } from '../validation/proposalValidator';
import { putProposalContext } from '../validation/proposalContextStore';
import type { ProposalValidationOptions } from '../validation/proposalValidator';
import { clearAgentDrafts } from '../tools/native/agentDraftStore';
import { clearAgentTodos } from '../tools/native/agentTodoStore';
import type { ToolRegistry } from '../tools/ToolRegistry';
import {
  compactToolObservation,
  serializeCompactToolObservation,
  SessionToolObservationStore,
} from './toolObservationCompact';
import { AgentImplementGate } from './agentImplementGate';
import { aiManager } from '../AiManager';
import { extractToolCallIntention, stripToolCallMetaArgs } from './toolCallMeta';
import { ASK_CLARIFYING_QUESTION_TOOL_NAME } from '../tools/native/askClarifyingQuestion';
import { UPDATE_TODO_LIST_TOOL_NAME } from '../tools/native/updateTodoList';
import {
  formatAgentActivityLabel,
  formatAgentPlanningStatus,
  formatAgentRepairLabel,
  formatContextCompressionActivity,
  formatAgentTurnSummaryMessage,
  formatDirectRetrieveNote,
  formatEmergencyCondenseDetail,
  formatIterationLimitMessage,
  formatProposalFinalizeMessage,
  formatUnresolvedValidationNotice,
  formatTokenPressureCompressionDetail,
  resolveUserDisplayLocale,
} from '../../../shared/lib/appendoo/agentActivityLabels';
import { resolveEffectiveUserIntent } from '../../../shared/lib/detectCodingIntent';
import { repairToolMessageSequence } from './toolMessageSequence';
import {
  formatTurnProfileLabel,
  resolveTurnExecutionProfile,
  type TurnExecutionProfile,
} from './turnExecutionProfile';
import { randomUUID } from 'crypto';
import { RuntimeEventSequencer, createRuntimeEvent, type AgentRuntimeEventType } from './runtimeEvents';
import { AgentEventStore, loadEventLog } from './AgentEventStore';
import {
  createInitialOperationalState,
  hashOperationalState,
  persistOperationalState,
  reduceOperationalState,
  replayOperationalState,
  type OperationalState,
} from './operationalState';
import { reconcileEventLogOnResume } from './crashRecovery';
import { resolveTaskContract } from './taskContract';
import {
  classifyToolCallActionClass,
  classifyMutationRisk,
  resolveGovernanceDepth,
  defaultOperationalPolicyEngine,
  type ActionValidation,
  type GovernanceDepth,
} from './operationalPolicyEngine';
import { callWithProviderFallback, resolveModelIdForTier } from './modelRouter';
import {
  EvidenceStore,
  deriveEvidenceFromToolResult,
  VERIFY_TOOL_NAMES,
} from './evidence';
import { HypothesisLedger, type Hypothesis } from './hypothesisLedger';
import { PROPOSE_HYPOTHESIS_TOOL_NAME } from '../tools/native/proposeHypothesis';

/** C.4 — extra tool-observation prune when context nears the per-run token budget. */
const CONTEXT_TOKEN_PRESSURE_RATIO = 0.72;

const filterToolsForExecutionProfile = (
  tools: ToolDefinition[],
  profile: TurnExecutionProfile,
): ToolDefinition[] => {
  if (
    profile === 'agent_plan_review'
    || profile === 'agent_lookup'
    || profile === 'ask_lookup'
  ) {
    return tools.filter((tool) => !tool.name.startsWith('draft_'));
  }
  return tools;
};
import { shouldBlockV1ProposalForEngineering } from '../../../shared/lib/appendoo/appendooCutover';

export type AgentOrchestratorCallbacks = {
  onEvent?: (event: AgentStreamEvent) => void;
};

export type AgentOrchestratorDeps = {
  provider: IAiProvider;
  modelId: string;
  toolRegistry: ToolRegistry;
  policy?: OrchestrationPolicy;
  /** V5 P01 § V5-2b — optional fallback providers tried in order if `provider.chatWithTools` throws. */
  fallbackProviders?: IAiProvider[];
};

// p-63 A4 — 80k died mid-task on modern 200k-context models (F-6).
const DEFAULT_MAX_TOKENS_PER_RUN = 200_000;

export const hashToolArgs = (args: Record<string, unknown>): string => (
  createHash('sha256').update(JSON.stringify(args)).digest('hex').slice(0, 16)
);

const chunkTextForStream = (text: string, chunkSize = 48): string[] => {
  if (!text) return [];
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
};

export const buildVibePlan = (
  messages: AgentMessage[],
  config: AgentRunConfig,
): AgentPlanPayload => {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  const intent = config.taskDecomposition?.summary
    ?? lastUser?.content?.trim().slice(0, 320)
    ?? 'Implement the requested change';
  const targetFiles: string[] = [];

  if (config.mode === 'plan' && config.planDocumentPath?.trim()) {
    targetFiles.push(config.planDocumentPath.trim());
  } else if (config.pageContext?.layoutId) {
    targetFiles.push(config.pageContext.layoutId);
  } else if (config.pageContext?.path) {
    targetFiles.push(config.pageContext.path);
  } else if (config.mode === 'plan') {
    targetFiles.push('plans/core/todo/p-00-todo-index.md');
  } else {
    targetFiles.push('component-designer draft');
  }

  const defaultSteps = config.mode === 'plan'
    ? [
      'Review project standards and the active plan document',
      'Read and search only under plans/core/ and plans/packages/ to refine the design doc',
      'Draft markdown updates with draft_file_patch (no auto-apply)',
      'Validate proposal scope (plans/core/**/*.md and plans/packages/**/*.md only) before user confirm',
    ]
    : [
      'Review project standards and current page context',
      'Search and read relevant code (glob → search → read_file verify)',
      'Draft proposed changes with draft_* tools',
      'Validate proposal against PROJECT_STANDARDS — AppEndoo auto-applies when valid',
    ];

  const steps = config.taskDecomposition?.workUnits?.length
    ? config.taskDecomposition.workUnits
    : defaultSteps;

  return { steps, targetFiles, intent };
};

const buildProposalValidationOptions = (config: AgentRunConfig): ProposalValidationOptions => ({
  mode: config.mode,
  agentSettings: config.agentSettings,
  pageContext: config.pageContext,
  userIntentPaths: config.mode === 'plan' && config.planDocumentPath
    ? [config.planDocumentPath]
    : config.pageContext?.path
      ? [config.pageContext.path]
      : undefined,
});

const formatRepairPrompt = (violations: NonNullable<AgentRunResult['validationViolations']>): string => {
  const lines = violations.map((violation) => `- [${violation.severity}] ${violation.message}`);
  return [
    'Proposal validation failed. Revise the draft_* output to fix these issues:',
    ...lines,
  ].join('\n');
};

const RETRIEVE_TOOL_NAMES = new Set([
  'read_file',
  'search_codebase',
  'glob_files',
  'list_dir',
  'get_feature_graph',
  'get_project_standards',
  'get_server_function',
  'get_page_context',
]);

const isRetrieveToolName = (toolName: string): boolean => RETRIEVE_TOOL_NAMES.has(toolName);

/**
 * p-61 Phase B (B3) — the only harness→model channel. Reminders ride in a user-role message
 * (providers accept no mid-conversation system role) but are explicitly tagged so the model
 * can tell harness guidance from real user text. Replaces the old fake-user "nudge" messages
 * that polluted history with instructions the user never wrote.
 */
export const wrapSystemReminder = (text: string): string => (
  `<system-reminder>\n${text}\n</system-reminder>`
);

const findOriginalUserIntent = (
  messages: AgentMessage[],
  pageContext?: AgentRunConfig['pageContext'],
): string => resolveEffectiveUserIntent(messages, pageContext);

const formatMaxIterationsStopMessage = (): string => (
  'Agent reached the iteration limit before creating a proposal. '
  + 'Try a more specific request, start a new chat, or raise maxIterationsVibe in Settings → AI.'
);

const ENGINEERING_PIPELINE_FINALIZE_MESSAGE =
  'V3 engineering cutover is active. This request uses the AppEndoo engineering pipeline — '
  + 'v1 direct proposal apply is disabled. Complete Intent → Context → ASP → Change Graph → '
  + 'Workspace → Builders → Verification → Promotion.';

type IterationOutcome = {
  kind: 'tool_calls' | 'respond' | 'stop';
  text?: string;
  reason?: string;
};

export class AgentOrchestrator {
  private policy: OrchestrationPolicy;

  constructor(private readonly deps: AgentOrchestratorDeps) {
    this.policy = deps.policy ?? defaultOrchestrationPolicy;
  }

  async run(
    messages: AgentMessage[],
    config: AgentRunConfig,
    callbacks?: AgentOrchestratorCallbacks,
  ): Promise<AgentRunResult> {
    const emit = (event: AgentStreamEvent) => {
      callbacks?.onEvent?.(event);
    };

    const maxIterations = config.mode === 'ask'
      ? (config.agentSettings.maxIterationsAsk ?? 8)
      : (config.mode === 'agent' || config.mode === 'plan')
        ? config.agentSettings.maxIterationsVibe
        : config.agentSettings.maxIterations;

    const maxTokensPerRun = config.maxTokensPerRun ?? DEFAULT_MAX_TOKENS_PER_RUN;
    const tokenBudgetHardStop = config.agentSettings.tokenBudgetHardStop !== false;
    const workingMessages: AgentMessage[] = [...messages];
    const observationStore = new SessionToolObservationStore();
    const contextMemory = new AgentContextMemory(workingMessages);
    const recentInvocations: RecentToolInvocation[] = [];
    const traces: AgentIterationTrace[] = [];
    const originalUserIntent = findOriginalUserIntent(messages, config.pageContext);
    // p-63 — user-facing activity/status text follows the user's language, never a hardcoded locale.
    const displayLocale = resolveUserDisplayLocale(originalUserIntent);
    const executionProfile = config.executionProfile
      ?? resolveTurnExecutionProfile(config.mode, originalUserIntent, config.pageContext);
    const runConfig: AgentRunConfig = { ...config, executionProfile };

    const harness = new AgentImplementGate(
      executionProfile,
      config.pageContext,
      originalUserIntent,
    );
    let iteration = 0;
    let tokensUsed = 0;
    let finalText = '';
    // Text already delivered to the client as live text_delta events by the most recent
    // LLM call — used to avoid re-emitting the final text a second time at finalize.
    let lastIterationStreamedText = '';
    type PendingHistorySummary = { done: boolean; text: string | undefined; promise: Promise<string | undefined> };
    let pendingHistorySummary: PendingHistorySummary | null = null;
    let proposalId: string | undefined;
    let changeSets: AgentRunResult['changeSets'];
    let validationOk: boolean | undefined;
    let validationViolations: AgentRunResult['validationViolations'];
    let contextHistorySummary = config.persistedHistorySummary?.trim();
    let workflowNudgeCount = 0;
    let vibePlan: AgentRunResult['plan'];
    let serverFunctionTested = false;
    let retrievalOperationCount = 0;
    let draftToolCount = 0;
    let directRetrieveNoteEmitted = false;

    // V5 P01 — runtime event/state side-channel. Additive: never throws into the main chat flow
    // (persistence at the end is wrapped in try/catch), never changes existing traces/events/
    // AgentRunResult fields other than the new optional `runtimeState`.
    const runtimeTaskId = config.taskId ?? randomUUID();
    const runtimeAttemptId = config.attemptId ?? randomUUID();

    // V5 Phase P09 § V5-13 — crash-safe resume. Only meaningful when the caller explicitly
    // supplies a stable `taskId`/`attemptId` to continue (config.taskId/attemptId — P01 fields);
    // ad-hoc chat turns that don't set them get a fresh random pair every time (unchanged
    // behavior) and this block is a no-op for them. `loadEventLog` was, until this phase,
    // confirmed reachable only from tests — this is its first production call site.
    const priorEvents = (config.taskId && config.attemptId)
      ? loadEventLog(runtimeTaskId, runtimeAttemptId)
      : undefined;
    const priorMaxSequence = priorEvents?.length
      ? Math.max(...priorEvents.map((event) => event.sequence))
      : 0;

    const runtimeSequencer = new RuntimeEventSequencer(priorMaxSequence);
    const runtimeEventStore = new AgentEventStore(runtimeTaskId, runtimeAttemptId, priorEvents ?? []);
    let operationalState: OperationalState = priorEvents?.length
      ? replayOperationalState(runtimeTaskId, runtimeAttemptId, priorEvents)
      : createInitialOperationalState(runtimeTaskId, runtimeAttemptId);

    if (priorEvents?.length) {
      const { reconciliationEvent } = reconcileEventLogOnResume(
        runtimeTaskId,
        runtimeAttemptId,
        priorEvents,
        runtimeSequencer,
      );
      if (reconciliationEvent) {
        runtimeEventStore.append(reconciliationEvent);
        operationalState = reduceOperationalState(operationalState, reconciliationEvent);
      }
    }
    // V5 P11 (P10 § 33 follow-up) — captured once, after reconcile, for taskOutcomeTelemetry.
    const hadUnresolvedUnknownOutcomeAtStart = operationalState.pendingUnknownOutcomes.length > 0;
    let blockedRepeatedFailureRetry = false;

    const recordRuntimeEvent = <T>(type: AgentRuntimeEventType, payload: T): void => {
      const event = createRuntimeEvent({
        taskId: runtimeTaskId,
        attemptId: runtimeAttemptId,
        type,
        payload,
        sequencer: runtimeSequencer,
      });
      runtimeEventStore.append(event);
      operationalState = reduceOperationalState(operationalState, event);
    };
    const resolveActionTarget = (toolName: string, args: Record<string, unknown>): string => {
      const candidate = args.path ?? args.functionId ?? args.name ?? args.filePath;
      return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : 'default';
    };
    recordRuntimeEvent('TaskCreated', { mode: config.mode, executionProfile });

    // V5 P02 — TaskContract/Evidence/Hypothesis side-channel. Additive, same non-fatal-persistence
    // guarantee as P01's event/state channel. (p-98 — ClaimStore/required-claims finalization
    // removed: confirmed pure telemetry, fed only unread result fields. `taskContract` itself
    // stays — `defaultOperationalPolicyEngine.select()`'s per-iteration recommendation genuinely
    // needs it, and that recommendation's events (RecoveryStrategySelected/ProgressRecorded) are
    // real, asserted behavior, not dead code.)
    const taskContract = config.taskContract ?? resolveTaskContract({
      taskId: runtimeTaskId,
      rawUserRequest: originalUserIntent || (messages[messages.length - 1]?.content ?? ''),
      mode: config.mode,
    });
    recordRuntimeEvent('TaskContractResolved', { taskContractId: taskContract.taskContractId, taskClass: taskContract.taskClass });
    const requestedGovernanceDepth: GovernanceDepth = config.governanceDepth ?? 'AUTO';
    const evidenceStore = new EvidenceStore();
    const hypothesisLedger = new HypothesisLedger(runtimeTaskId);

    // p-98 — the compaction-invariant capture/validation machinery (captureCompactionInvariants/
    // validateCompaction) was removed: its own doc comment admitted it "should always report
    // ok:true today," and nothing ever consumed a validation failure. The ContextCompactionStarted
    // event itself is real, useful observability (prune actually happened) and stays.
    const recordCompactionIfPruned = (prunedCount: number) => {
      if (prunedCount <= 0) return;
      recordRuntimeEvent('ContextCompactionStarted', { prunedCount });
    };

    // V5 P01 § V5-2b — real ModelRouter integration point: summarization is a low-stakes
    // (fast-tier) purpose distinct from the main chat loop, and already had its own model
    // selection before this phase. `resolveModelIdForTier('fast')` now owns that selection
    // (same resolveFastClassifierModelId heuristic, no behavior change) so future tier policy
    // changes have one place to live instead of being duplicated per call site.
    const resolveSummaryProvider = (): IAiProvider => {
      try {
        if (!aiManager.getSettings()?.enabled) return this.deps.provider;
        return aiManager.resolveModel(resolveModelIdForTier('fast')).provider;
      } catch {
        return this.deps.provider;
      }
    };

    if (harness.isActive()) {
      clearAgentDrafts();
      clearAgentTodos();
    }

    emit({
      type: 'turn_profile',
      profile: executionProfile,
      label: formatTurnProfileLabel(executionProfile, displayLocale),
    });

    // p-61 Phase B — no pre-flight decomposition LLM call. Planning belongs to the model
    // inside the loop (update_todo_list tool); a caller-provided config.taskDecomposition is
    // still honored in the system prompt for backward compatibility.
    emit({ type: 'thinking', status: formatAgentPlanningStatus(displayLocale) });

    const runIteration = async (): Promise<IterationOutcome> => {
      iteration += 1;

      // p-61 Phase C — one context assembly per iteration on the normal path (was 3–5).
      // Order: consume any ready background summary → prune stale tool observations →
      // assemble once → schedule background compaction under pressure → the rare
      // over-budget path condenses and reassembles.
      if (pendingHistorySummary?.done) {
        const readySummary = pendingHistorySummary.text;
        pendingHistorySummary = null;
        if (readySummary && readySummary !== contextHistorySummary?.trim()) {
          contextHistorySummary = readySummary;
        }
      }

      const maxObservationTurns = config.agentSettings.contextToolObservationMaxTurns ?? 12;
      // Token pressure is judged from the previous iteration's estimate — good enough to
      // decide whether to prune harder before this iteration's single assembly.
      const priorPressureRatio = maxTokensPerRun > 0 ? tokensUsed / maxTokensPerRun : 0;
      const pruneTurns = priorPressureRatio >= CONTEXT_TOKEN_PRESSURE_RATIO
        ? Math.max(1, maxObservationTurns - 1)
        : maxObservationTurns;
      const pruneResult = contextMemory.autoPruneToolObservations(pruneTurns);
      if ((pruneResult.prunedCount ?? 0) > 0) {
        const compressionLabel = formatContextCompressionActivity(pruneResult.prunedCount ?? 0, displayLocale);
        emit({
          type: 'activity_note',
          noteKind: 'context_compression',
          title: compressionLabel.title,
          detail: priorPressureRatio >= CONTEXT_TOKEN_PRESSURE_RATIO
            ? formatTokenPressureCompressionDetail(
              compressionLabel.intention,
              Math.round(priorPressureRatio * 100),
              displayLocale,
            )
            : compressionLabel.intention,
        });
        recordCompactionIfPruned(pruneResult.prunedCount ?? 0);
      }

      if (harness.shouldEmitPlan()) {
        const plan = buildVibePlan(messages, runConfig);
        vibePlan = plan;
        harness.markPlanEmitted();
        emit({ type: 'change_plan', plan });
      }

      let assembled = assembleAgentContext(workingMessages, runConfig, contextHistorySummary);
      let llmMessages = repairToolMessageSequence(assembled.workingMessages);
      tokensUsed = estimateMessagesTokens(llmMessages, assembled.systemPrompt, this.deps.modelId);

      // Background history summarization (vscode-copilot-chat pattern): the summary LLM
      // round-trip runs concurrently with the main model call instead of blocking every
      // iteration once token pressure is reached. A ready summary is consumed at the next
      // iteration boundary; the hard-budget path below can still await an in-flight one.
      if (!pendingHistorySummary && shouldBuildSegmentHistorySummary(workingMessages, runConfig, {
        tokensEstimate: tokensUsed,
        tokensBudget: maxTokensPerRun,
      })) {
        const holder: PendingHistorySummary = { done: false, text: undefined, promise: Promise.resolve(undefined) };
        const snapshot = [...workingMessages];
        holder.promise = resolveSegmentHistorySummary(snapshot, runConfig, { provider: resolveSummaryProvider(), force: true })
          .then((builtSummary) => {
            holder.text = builtSummary?.trim() || undefined;
            holder.done = true;
            return holder.text;
          })
          .catch(() => {
            holder.done = true;
            return undefined;
          });
        pendingHistorySummary = holder;
      }

      if (tokensUsed > maxTokensPerRun) {
        if (pendingHistorySummary) {
          // Hard budget breach with a summary in flight — blocking here is justified; prefer
          // the quality LLM summary over the char-sliced emergency fallback below.
          const awaitedSummary = await pendingHistorySummary.promise;
          pendingHistorySummary = null;
          if (awaitedSummary && awaitedSummary !== contextHistorySummary?.trim()) {
            contextHistorySummary = awaitedSummary;
          }
        }

        // p-63 A4 — condense once (aggressive prune + history summarization) and keep working;
        // a mid-task stop was the old behavior and it killed runs instead of shrinking context.
        const emergencyPrune = contextMemory.autoPruneToolObservations(2);
        const emergencySummary = contextMemory.summarizeHistory();
        const emergencyPrunedCount = (emergencyPrune.prunedCount ?? 0) + (emergencySummary.prunedCount ?? 0);
        if (emergencyPrunedCount > 0) {
          const compressionLabel = formatContextCompressionActivity(emergencyPrunedCount, displayLocale);
          emit({
            type: 'activity_note',
            noteKind: 'context_compression',
            title: compressionLabel.title,
            detail: formatEmergencyCondenseDetail(compressionLabel.intention, displayLocale),
          });
          recordCompactionIfPruned(emergencyPrunedCount);
        }

        assembled = assembleAgentContext(workingMessages, runConfig, contextHistorySummary);
        llmMessages = repairToolMessageSequence(assembled.workingMessages);
        tokensUsed = estimateMessagesTokens(llmMessages, assembled.systemPrompt, this.deps.modelId);

        if (tokensUsed > maxTokensPerRun) {
          if (tokenBudgetHardStop) {
            traces.push({
              iteration,
              modelId: this.deps.modelId,
              policyAction: 'stop',
              tokensEstimate: tokensUsed,
              summary: 'token_budget_hard_stop',
            });
            return {
              kind: 'stop',
              text: `Token budget reached (${tokensUsed.toLocaleString()} / ${maxTokensPerRun.toLocaleString()} estimated tokens). Stopping to avoid context overflow.`,
            };
          }

          logger.warn('AgentOrchestrator', 'Soft token budget exceeded', {
            tokensUsed,
            maxTokensPerRun,
            iteration,
          });
        }
      }

      if (!this.deps.provider.chatWithTools) {
        throw new Error(`Model provider "${this.deps.provider.getProviderName()}" does not support tool calling.`);
      }

      const llmSystemPrompt = assembled.systemPrompt;

      const tools: ToolDefinition[] = filterToolsForExecutionProfile(
        this.deps.toolRegistry.listDefinitions(
          config.enabledCapabilityPackIds?.length
            ? { activePackIds: config.enabledCapabilityPackIds }
            : undefined,
        ),
        executionProfile,
      );
      emit({ type: 'thinking', status: formatAgentPlanningStatus(displayLocale) });

      const modelProviders = this.deps.fallbackProviders?.length
        ? [this.deps.provider, ...this.deps.fallbackProviders]
        : [this.deps.provider];
      recordRuntimeEvent('ModelInvocationStarted', { iteration, providerCount: modelProviders.length });
      // True token streaming: deltas reach the client as the model generates. Narration on
      // tool-call iterations streams too (VS Code-style live commentary); the `done` event's
      // text stays authoritative for the final message, so end state is unchanged.
      const onLlmTextDelta = (delta: string): void => {
        if (!delta) return;
        lastIterationStreamedText += delta;
        emit({ type: 'text_delta', text: delta });
      };
      const callProvider = (provider: IAiProvider): Promise<ChatWithToolsResult> => {
        // Reset per attempt so a fallback provider's re-generation starts a clean slate.
        lastIterationStreamedText = '';
        if (provider.chatWithToolsStream) {
          return provider.chatWithToolsStream(
            llmMessages as Parameters<NonNullable<IAiProvider['chatWithToolsStream']>>[0],
            tools,
            llmSystemPrompt,
            onLlmTextDelta,
          );
        }
        if (!provider.chatWithTools) {
          throw new Error(`Model provider "${provider.getProviderName()}" does not support tool calling.`);
        }
        return provider.chatWithTools(
          llmMessages as Parameters<NonNullable<IAiProvider['chatWithTools']>>[0],
          tools,
          llmSystemPrompt,
        );
      };
      const llmResult = modelProviders.length > 1
        ? await callWithProviderFallback(modelProviders, callProvider)
        : await callProvider(this.deps.provider);
      const toolCalls = llmResult.toolCalls ?? [];
      recordRuntimeEvent('ModelInvocationCompleted', { iteration, toolCallCount: toolCalls.length });
      const decision = this.policy.decide({
        iteration,
        maxIterations,
        hasToolCalls: toolCalls.length > 0,
        recentInvocations,
      });

      if (decision.action === 'stop') {
        traces.push({
          iteration,
          modelId: this.deps.modelId,
          policyAction: 'stop',
          tokensEstimate: tokensUsed,
          summary: decision.reason,
        });
        return {
          kind: 'stop',
          text: llmResult.text?.trim() || `Stopped: ${decision.reason ?? 'orchestration policy limit reached.'}`,
          reason: decision.reason,
        };
      }

      if (toolCalls.length === 0) {
        traces.push({
          iteration,
          modelId: this.deps.modelId,
          policyAction: 'respond',
          tokensEstimate: tokensUsed,
          ok: true,
        });
        recordRuntimeEvent('ProgressRecorded', { iteration, tokensEstimate: tokensUsed });
        return { kind: 'respond', text: llmResult.text?.trim() || '' };
      }

      // p-61 Phase B — every model-issued call id gets a result. Calls over the per-turn cap
      // are not silently dropped (the model would assume they ran); they get an explicit
      // "not executed" tool result so it can re-issue them next iteration.
      const limitedCalls = toolCalls.slice(0, config.agentSettings.maxToolCallsPerTurn);
      const overflowCalls = toolCalls.slice(config.agentSettings.maxToolCallsPerTurn);
      const assistantToolMessage: AgentMessage = {
        role: 'assistant',
        content: llmResult.text?.trim() || '',
        toolCalls: toolCalls,
      };
      workingMessages.push(assistantToolMessage);

      // Speed: retrieve-class tools are read-only, independent of each other, and never
      // blocked by the implement gate (it only gates draft_*) nor narrowed by the policy
      // engine (EDIT-only). When the model batches several of them, start their I/O
      // concurrently here; the sequential loop below consumes the settled results in the
      // original call order, so every trace/event/message ordering stays byte-identical.
      const prefetchedRetrieves = new Map<number, { startedAt: number; promise: ReturnType<ToolRegistry['execute']> }>();
      if (limitedCalls.filter((c) => isRetrieveToolName(c.name)).length > 1) {
        limitedCalls.forEach((prefetchCall, prefetchIndex) => {
          if (!isRetrieveToolName(prefetchCall.name)) return;
          prefetchedRetrieves.set(prefetchIndex, {
            startedAt: Date.now(),
            promise: this.deps.toolRegistry.execute(prefetchCall.name, stripToolCallMetaArgs(prefetchCall.args ?? {}), {
              pageContext: config.pageContext,
              contextMemory: contextMemory.asHandle(),
              docAccessPrincipal: config.docAccessPrincipal,
              modelId: this.deps.modelId,
            }),
          });
        });
      }

      for (const [callIndex, call] of limitedCalls.entries()) {
        const rawArgs = call.args ?? {};
        const modelIntention = extractToolCallIntention(rawArgs);
        const execArgs = stripToolCallMetaArgs(rawArgs);
        const gate = harness.checkPreToolUse(call.name);
        const argsHash = hashToolArgs(execArgs);
        recentInvocations.push({ tool: call.name, argsHash, iteration });

        // V5 P01 § 3.3 — OperationalPolicyEngine second gate. Only consulted when the harness
        // retrieve gate already allows the call — it never widens what the harness permits, only
        // narrows it further for EDIT-class actions with an unrecovered failure signature.
        const actionClass = classifyToolCallActionClass(call.name);
        const actionTarget = resolveActionTarget(call.name, execArgs);
        // V5 P03 § T7 — governance depth dial: LEAN auto-escalates to THOROUGH on a high-risk
        // target (schema/migration/auth/etc.); THOROUGH/AUTO are never loosened by this call.
        const effectiveGovernanceDepth: GovernanceDepth = actionClass === 'EDIT'
          ? resolveGovernanceDepth(requestedGovernanceDepth, classifyMutationRisk(actionTarget))
          : requestedGovernanceDepth;
        // V5 P09 § V5-14 — real operational-metadata signal attached to the durable trajectory
        // record for every proposed action (additive/observational only — does not participate
        // in the allow/deny decision, so this cannot introduce a new control-flow risk).
        // p-98 — mutation/riskClass/trustBoundary fields (toolOperationalMetadata.ts) removed:
        // confirmed write-only, no consumer ever read them back off the event.
        recordRuntimeEvent('ActionProposed', {
          toolName: call.name,
          actionClass,
          target: actionTarget,
          governanceDepth: effectiveGovernanceDepth,
        });
        // p-61 Phase B (B5) — the OperationalPolicyEngine no longer steers normal work: the
        // repeated-failure "stall" heuristic is telemetry only (blocking the model's own retry
        // taught it to abandon tasks — recovery is the model's job, the iteration budget is
        // the bound). The one deny kept is `unresolved_unknown_outcome`: a mutation whose
        // previous attempt crashed mid-flight must not be blindly re-applied (V5 P09
        // crash-resume safety) until the model verifies current state.
        const policyValidation: ActionValidation = gate.allowed
          ? defaultOperationalPolicyEngine.validateProposal({
            proposedAction: { toolName: call.name, actionClass, target: actionTarget },
            state: operationalState,
            governanceDepth: effectiveGovernanceDepth,
          })
          : { allowed: true };
        const policyDenied = !policyValidation.allowed
          && policyValidation.reasonCode === 'unresolved_unknown_outcome';
        const effectiveAllowed = gate.allowed && !policyDenied;

        if (effectiveAllowed) {
          recordRuntimeEvent('ActionAllowed', { toolName: call.name, actionClass });
          if (!policyValidation.allowed) {
            recordRuntimeEvent('StallDetected', { toolName: call.name, target: actionTarget, reasonCode: policyValidation.reasonCode });
            if (policyValidation.reasonCode === 'repeated_failure_without_recovery') {
              blockedRepeatedFailureRetry = true;
            }
          }
        } else if (!gate.allowed) {
          recordRuntimeEvent('ActionRejected', { toolName: call.name, reasonCode: 'harness_gate_blocked', reason: gate.reason });
        } else {
          recordRuntimeEvent('ActionRejected', { toolName: call.name, reasonCode: 'unresolved_unknown_outcome', reason: (policyValidation as { reason: string }).reason });
          recordRuntimeEvent('StallDetected', { toolName: call.name, target: actionTarget, reasonCode: 'unresolved_unknown_outcome' });
          blockedRepeatedFailureRetry = true;
        }

        const activity = formatAgentActivityLabel(call.name, execArgs, displayLocale, modelIntention);
        emit({ type: 'thinking', status: activity.title });

        emit({
          type: 'tool_start',
          toolCallId: call.id,
          name: call.name,
          args: call.name === HTTP_REQUEST_TOOL_NAME
            ? redactHttpRequestArgsForTrace(execArgs)
            : execArgs,
          activityTitle: activity.title,
          intention: activity.intention,
          reasonCode: effectiveAllowed ? 'AUTO_ALLOWED' : 'HARNESS_BLOCKED',
        });

        const prefetched = prefetchedRetrieves.get(callIndex);
        const startedAt = prefetched?.startedAt ?? Date.now();
        if (effectiveAllowed) {
          recordRuntimeEvent('ToolExecutionStarted', { toolName: call.name, target: actionTarget });
        }
        const result = effectiveAllowed
          ? await (prefetched?.promise ?? this.deps.toolRegistry.execute(call.name, execArgs, {
            pageContext: config.pageContext,
            contextMemory: contextMemory.asHandle(),
            docAccessPrincipal: config.docAccessPrincipal,
            modelId: this.deps.modelId,
          }))
          : {
            ok: false as const,
            error: !gate.allowed ? 'harness_gate_blocked' : 'unresolved_unknown_outcome',
            summary: !gate.allowed
              ? (gate.reason ?? 'Tool blocked by agent implement gate.')
              : (policyValidation as { reason: string }).reason,
          };
        const durationMs = Date.now() - startedAt;

        if (effectiveAllowed) {
          if (result.ok) {
            recordRuntimeEvent('ToolExecutionCompleted', {
              toolName: call.name,
              target: actionTarget,
              isRetrieve: isRetrieveToolName(call.name),
              isDraft: call.name.startsWith('draft_'),
            });
          } else {
            recordRuntimeEvent('ToolExecutionFailed', { toolName: call.name, target: actionTarget, error: result.error });
          }

          // V5 P02 — tool-result → Evidence adapters (doc § V5-4 "Tool adapters").
          const derivedEvidence = deriveEvidenceFromToolResult({
            taskId: runtimeTaskId,
            toolName: call.name,
            target: actionTarget,
            ok: result.ok,
            providerMode: 'mock', // EV-3 — no live model in this environment; see D-007.
          });
          if (derivedEvidence) {
            const evidence = evidenceStore.record({ taskId: runtimeTaskId, ...derivedEvidence });
            recordRuntimeEvent('EvidenceProduced', { evidenceId: evidence.evidenceId, type: evidence.type, result: evidence.result });

            // V5 P04 § 6.3 — ContextItem lifecycle. Only DISCOVERED/PRESENTED are wired: both are
            // mechanically true at this point (the tool ran and its result is about to be pushed
            // into `workingMessages` unconditionally below). SELECTED (a ranking decision) belongs
            // to Phase 05's real retrieval; UTILIZED (did the model's next response actually use
            // it) needs live-model judgment this environment cannot produce (EV-3) — both left
            // unimplemented rather than faked.
            if (derivedEvidence.type === 'SOURCE') {
              const contextItemId = hashToolArgs({ tool: call.name, target: actionTarget });
              recordRuntimeEvent('ContextItemDiscovered', { contextItemId, target: actionTarget });
              recordRuntimeEvent('ContextItemPresented', { contextItemId, iteration });
            }

            // A VERIFY-class outcome resolves the most recently active hypothesis, if any.
            if (VERIFY_TOOL_NAMES.has(call.name)) {
              const active = hypothesisLedger.mostRecentActive();
              if (active) {
                if (result.ok) {
                  hypothesisLedger.confirm(active.hypothesisId, evidence.evidenceId);
                  recordRuntimeEvent('HypothesisConfirmed', { hypothesisId: active.hypothesisId });
                } else {
                  hypothesisLedger.contradict(active.hypothesisId, evidence.evidenceId, evidenceStore.list().length);
                  recordRuntimeEvent('HypothesisContradicted', { hypothesisId: active.hypothesisId });
                  // Two contradictions with no confirmation in between → REJECTED (terminal).
                  // This is what makes the ledger's "cannot silently retry a REJECTED hypothesis
                  // without new evidence" rule reachable in a real run, not just unit-testable.
                  const afterContradict = hypothesisLedger.list().find((h) => h.hypothesisId === active.hypothesisId);
                  if ((afterContradict?.contradictingEvidenceIds.length ?? 0) >= 2) {
                    hypothesisLedger.reject(active.hypothesisId, evidenceStore.list().length);
                    recordRuntimeEvent('HypothesisRejected', { hypothesisId: active.hypothesisId });
                  }
                }
              }
            }
          }

          // V5 P02 — propose_hypothesis tool adapter. The ledger's reject-without-new-evidence
          // rule can veto an otherwise syntactically-valid call, mirroring the P01 policy-gate
          // override pattern (harness_gate_blocked / repeated_failure_without_recovery).
          if (call.name === PROPOSE_HYPOTHESIS_TOOL_NAME && result.ok) {
            const data = result.data as { claim?: string; type?: string } | undefined;
            if (data?.claim && data.type) {
              const proposal = hypothesisLedger.propose({
                claim: data.claim,
                type: data.type as Hypothesis['type'],
                currentEvidenceCount: evidenceStore.list().length,
              });
              recordRuntimeEvent('HypothesisProposed', {
                hypothesisId: proposal.hypothesis.hypothesisId,
                accepted: proposal.ok,
              });
              if (!proposal.ok) {
                (result as { ok: boolean; error?: string; summary?: string }).ok = false;
                (result as { ok: boolean; error?: string; summary?: string }).error = proposal.reason;
                (result as { ok: boolean; error?: string; summary?: string }).summary = `Hypothesis rejected earlier without new evidence since — cannot re-propose "${data.claim}" until new evidence exists.`;
              }
            }
          }
        }

        harness.recordToolResult(call.name, result, execArgs);

        if (gate.allowed && result.ok) {
          if (isRetrieveToolName(call.name)) {
            retrievalOperationCount += 1;
            if (
              runConfig.pageContextPreload?.trim()
              && !directRetrieveNoteEmitted
            ) {
              directRetrieveNoteEmitted = true;
              const directRetrieveNote = formatDirectRetrieveNote(displayLocale);
              emit({
                type: 'activity_note',
                noteKind: 'scaffold_seed',
                title: directRetrieveNote.title,
                detail: directRetrieveNote.detail,
              });
            }
          }
          if (call.name.startsWith('draft_')) {
            draftToolCount += 1;
          }
        }

        if (call.name === ASK_CLARIFYING_QUESTION_TOOL_NAME && result.ok) {
          const data = result.data as { question?: string; options?: string[]; reason?: string } | undefined;
          if (data?.question?.trim()) {
            emit({
              type: 'clarifying_question',
              question: data.question.trim(),
              options: data.options,
              reason: data.reason,
            });
            recordRuntimeEvent('ClarificationRequested', { question: data.question.trim() });
          }
        }

        if (call.name === UPDATE_TODO_LIST_TOOL_NAME && result.ok) {
          const data = result.data as { todos?: Array<{ id: string; title: string; status: string }> } | undefined;
          if (data?.todos?.length) {
            emit({
              type: 'todo_update',
              todos: data.todos.map((todo) => ({
                id: todo.id,
                title: todo.title,
                status: todo.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
              })),
            });
          }
        }

        if (call.name === 'test_server_function' && result.ok) {
          serverFunctionTested = true;
        }

        emit({
          type: 'tool_result',
          toolCallId: call.id,
          result,
        });

        traces.push({
          iteration,
          modelId: this.deps.modelId,
          policyAction: 'tool_call',
          toolName: call.name,
          argsHash,
          durationMs,
          tokensEstimate: tokensUsed,
          ok: result.ok,
          error: result.error,
          summary: result.summary,
        });
        recordRuntimeEvent('ProgressRecorded', { iteration, tokensEstimate: tokensUsed });

        const compactObservation = compactToolObservation(call.name, result, observationStore, call.id);
        workingMessages.push({
          role: 'tool',
          content: serializeCompactToolObservation(compactObservation),
          toolCallId: call.id,
          name: call.name,
        });
      }

      for (const overflowCall of overflowCalls) {
        workingMessages.push({
          role: 'tool',
          content: JSON.stringify({
            ok: false,
            error: 'per_turn_tool_budget_reached',
            summary: `Not executed — per-turn tool-call limit (${config.agentSettings.maxToolCallsPerTurn}) reached. Re-issue this call in your next step if still needed.`,
          }),
          toolCallId: overflowCall.id,
          name: overflowCall.name,
        });
      }

      return { kind: 'tool_calls' };
    };

    while (iteration < maxIterations) {
      const outcome = await runIteration();
      if (outcome.kind === 'stop') {
        if (
          outcome.reason === 'max_iterations_reached'
          && harness.isActive()
          && buildChangeSetsFromDrafts().length === 0
        ) {
          emit({
            type: 'iteration_limit',
            message: formatIterationLimitMessage(displayLocale, 'with_continue_hint'),
            canContinue: true,
            iterationCount: iteration,
          });
          finalText = formatIterationLimitMessage(displayLocale, 'final');
        } else {
          finalText = outcome.text ?? '';
        }
        break;
      }
      // p-61 Phase B (B3/B5) — the policy engine's per-iteration recommendation is telemetry,
      // never steering: no nudges, no forced continuation. A text response ends the loop —
      // that is the model's decision to make (Claude Code/Codex loop contract).
      const policyRecommendation = defaultOperationalPolicyEngine.select({
        taskContract,
        state: operationalState,
        hasSourceEvidence: evidenceStore.byType('SOURCE').length > 0,
        workflowNudgeCount,
        governanceDepth: requestedGovernanceDepth,
      });
      if (policyRecommendation === 'RECOVER') {
        recordRuntimeEvent('RecoveryStrategySelected', { iteration, reason: 'unrecovered_repeated_failure' });
      }

      if (outcome.kind === 'respond') {
        recordRuntimeEvent('ProgressRecorded', { iteration, tokensEstimate: tokensUsed, policyRecommendation });
        finalText = outcome.text ?? '';
        break;
      }
    }

    if (!finalText && iteration >= maxIterations) {
      finalText = harness.isActive() && buildChangeSetsFromDrafts().length === 0
        ? formatMaxIterationsStopMessage()
        : 'Reached maximum agent iterations without a final answer.';
    }

    if (harness.isActive()) {
      if (shouldBlockV1ProposalForEngineering(Boolean(runConfig.useEngineeringPipeline))) {
        finalText = ENGINEERING_PIPELINE_FINALIZE_MESSAGE;
      } else {
      harness.enterFinalize();
      let builtChangeSets = buildChangeSetsFromDrafts();

      const hasServerFunctionDraft = builtChangeSets.some((changeSet) => changeSet.kind === 'function_source_patch');
      if (
        runConfig.executionProfile === 'agent_implement'
        && hasServerFunctionDraft
        && !serverFunctionTested
        && iteration < maxIterations
        && workflowNudgeCount < 1
      ) {
        workflowNudgeCount += 1;
        workingMessages.push({
          role: 'user',
          content: wrapSystemReminder([
            'A server function was drafted but test_server_function has not run yet.',
            'Call test_server_function for each drafted server function and confirm the handler returns the expected shape before finishing.',
          ].join(' ')),
        });
        const verifyOutcome = await runIteration();
        if (verifyOutcome.kind === 'respond' && verifyOutcome.text) {
          finalText = verifyOutcome.text;
        }
        builtChangeSets = buildChangeSetsFromDrafts();
      }

      if (builtChangeSets.length > 0) {
        let validation = validateProposal(builtChangeSets, buildProposalValidationOptions(config));

        while (!validation.ok && harness.canAttemptRepair() && iteration < maxIterations) {
          harness.recordRepairAttempt();
          const repairLabel = formatAgentRepairLabel(validation.violations, displayLocale);
          emit({
            type: 'agent_repair',
            activityTitle: repairLabel.title,
            intention: repairLabel.intention,
            detail: repairLabel.detail,
            violations: validation.violations,
          });
          workingMessages.push({
            role: 'user',
            content: wrapSystemReminder(formatRepairPrompt(validation.violations)),
          });

          const repairOutcome = await runIteration();
          if (repairOutcome.kind === 'stop') {
            finalText = repairOutcome.text ?? finalText;
            break;
          }
          if (repairOutcome.kind === 'respond' && repairOutcome.text) {
            finalText = repairOutcome.text;
          }

          builtChangeSets = buildChangeSetsFromDrafts();
          if (builtChangeSets.length === 0) {
            break;
          }
          validation = validateProposal(builtChangeSets, buildProposalValidationOptions(config));
        }

        if (builtChangeSets.length > 0) {
          proposalId = createProposalId();
          changeSets = builtChangeSets;
          validationOk = validation.ok;
          validationViolations = validation.violations;

          // p-98 — capture the same pageContext/userIntentPaths used for this validation pass so
          // apply-time validation (changeSet.service.ts) can match it, instead of silently
          // validating with fewer scope checks than propose-time did.
          const proposalValidationOptions = buildProposalValidationOptions(config);
          putProposalContext(proposalId, {
            pageContext: proposalValidationOptions.pageContext,
            userIntentPaths: proposalValidationOptions.userIntentPaths,
          });

          emit({
            type: 'proposal',
            proposalId,
            changeSets: builtChangeSets,
          });
          emit({
            type: 'validation_result',
            proposalId,
            ok: validation.ok,
            violations: validation.violations,
          });

          if (!finalText) {
            const summary = formatAgentTurnSummaryMessage({
              retrievalOperationCount,
              draftToolCount,
              changeSetCount: builtChangeSets.length,
              changeSetTitles: builtChangeSets.map((changeSet) => changeSet.title),
              locale: displayLocale,
            });
            finalText = formatProposalFinalizeMessage(summary, validation.ok, displayLocale);
          } else if (!validation.ok) {
            // p-98 — never let an unresolved validation failure hide behind the model's own
            // (positively-worded) final reply; see formatUnresolvedValidationNotice.
            finalText = `${finalText}\n\n${formatUnresolvedValidationNotice(displayLocale)}`;
          }
        }
      }
      }
    }

    // Skip re-emitting text the last LLM call already streamed live; constructed texts
    // (proposal summaries, stop reasons, governance messages) still stream chunked here.
    if (finalText.trim() !== lastIterationStreamedText.trim()) {
      for (const chunk of chunkTextForStream(finalText)) {
        emit({ type: 'text_delta', text: chunk });
      }
    }

    // p-98 — the required-claims finalization + CompletionGate.evaluate() + cross-run KPI buffer
    // that used to run here were removed: full trace confirmed `taskOutcome`/`taskOutcomeReason`/
    // `unmetRequiredClaims`/`taskContract` were computed and returned but never read by anything
    // outside this file and its own tests (no admin UI, dashboard, or other module consumed
    // them) — pure telemetry that outlived its own consumer. The real gates this run already
    // enforced (crash-resume deny, agent_plan_review draft-block, hypothesis-reject-without-new-
    // evidence) are untouched; only this dead reporting layer is gone.
    try {
      runtimeEventStore.persist();
      persistOperationalState(operationalState);
    } catch (error) {
      logger.warn('AgentOrchestrator', 'V5 runtime event/state persistence failed (non-fatal)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      text: finalText,
      modelId: this.deps.modelId,
      iterationCount: iteration,
      traces,
      tokensEstimate: tokensUsed,
      tokensBudget: maxTokensPerRun,
      proposalId,
      changeSets,
      validationOk,
      validationViolations,
      contextHistorySummary,
      plan: vibePlan,
      retrievalOperationCount,
      draftToolCount,
      runtimeState: {
        taskId: runtimeTaskId,
        attemptId: runtimeAttemptId,
        operationalStateHash: hashOperationalState(operationalState),
        eventCount: runtimeEventStore.list().length,
        pendingUnknownOutcomeCount: operationalState.pendingUnknownOutcomes.length,
      },
    };
  }
}
