import type { AgentMode, AgentPlanPayload, ChangeSet, ProposalViolation, ToolCall, ToolResult, PromptTaskDecompositionPayload } from '../../../shared/api/contracts/ai/agentTypes';
import type { TurnExecutionProfile } from './turnExecutionProfile';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { AiChatContextResourceId } from '../../../shared/api/contracts/ai/chatContextResources';
import type { AiAgentSettings } from '../../../shared/api/contracts/ai/types';
import type { AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { McpAccessContextSnapshot } from '../../../shared/api/contracts/ai/mcpAccess';
import type { FunctionDocAccessPrincipal } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';
import type { PreloadedRetrieveState } from './retrieveBundle';

export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type AgentMessage = {
  role: AgentMessageRole;
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
};

export type OrchestrationAction = 'respond' | 'retrieve' | 'tool_call' | 'verify' | 'stop';

export type AgentRunConfig = {
  mode: AgentMode;
  agentSettings: AiAgentSettings;
  pageContext?: AiPageContext;
  contextResources?: AiChatContextResourceId[];
  maxTokensPerRun?: number;
  contextWorkingTurns?: number;
  planDocumentPath?: string;
  /** Read-only plan document body injected when switching Plan → Agent. */
  planDocumentContent?: string;
  docAccessPrincipal?: FunctionDocAccessPrincipal;
  mcpAccessContext?: McpAccessContextSnapshot;
  /** Built-in packs enabled for this run — filters LLM tool schema (TOK-14). */
  enabledCapabilityPackIds?: readonly AiCapabilityPackId[];
  /** Persisted segment H from session DB — avoids re-sending full history (TOK-16). */
  persistedHistorySummary?: string;
  /** Server-side page preload injected into system prompt (VC-3+). */
  pageContextPreload?: string;
  /** Server-side page preload — informational only; does NOT satisfy retrieve gate (GAP-9). */
  preloadedRetrieve?: PreloadedRetrieveState;
  /** Pre-implementation task breakdown — injected after analyst preprocessing. */
  taskDecomposition?: PromptTaskDecompositionPayload;
  /** Resolved before orchestration — gates harness, preload, and draft tools. */
  executionProfile?: TurnExecutionProfile;
  /** V3 engineering branch — v1 proposal/apply blocked after AE-22 cutover. */
  useEngineeringPipeline?: boolean;
  /** V5 P01 — stable task identity for runtime events/OperationalState. Generated if omitted. */
  taskId?: string;
  /** V5 P01 — identifies this specific run attempt within a task. Generated if omitted. */
  attemptId?: string;
  /** V5 P02 — pre-resolved TaskContract (e.g. from a real AssistantRequestRouting). Built from `mode` alone if omitted. Kept for `operationalPolicyEngine.select()`'s per-iteration recommendation (p-98). */
  taskContract?: import('./taskContract').TaskContract;
  /** V5 P03 § T7 — session/per-message governance depth dial. Defaults to 'AUTO'. */
  governanceDepth?: import('./operationalPolicyEngine').GovernanceDepth;
};

import type { AgentContextMemoryHandle } from './contextMemory';

export type ToolExecutionContext = {
  mode: AgentMode;
  allowedGroups: AiAgentSettings['allowedNativeToolGroups'];
  pageContext?: AiPageContext;
  contextMemory?: AgentContextMemoryHandle;
  docAccessPrincipal?: FunctionDocAccessPrincipal;
  /** p-98 — the parent run's model id, so a tool that delegates to a nested orchestrator run (delegate_research) can match model quality instead of guessing. */
  modelId?: string;
};

export type RecentToolInvocation = {
  tool: string;
  argsHash: string;
  iteration: number;
};

export type AgentIterationTrace = {
  iteration: number;
  modelId: string;
  policyAction: OrchestrationAction;
  toolName?: string;
  argsHash?: string;
  durationMs?: number;
  tokensEstimate?: number;
  ok?: boolean;
  error?: string;
  summary?: string;
};

export type AgentRunResult = {
  text: string;
  modelId: string;
  iterationCount: number;
  traces: AgentIterationTrace[];
  tokensEstimate?: number;
  tokensBudget?: number;
  proposalId?: string;
  plan?: AgentPlanPayload;
  changeSets?: ChangeSet[];
  validationOk?: boolean;
  validationViolations?: ProposalViolation[];
  /** Latest segment H summary to persist on the chat session (TOK-16). */
  contextHistorySummary?: string;
  retrievalOperationCount?: number;
  draftToolCount?: number;
  /** V5 P01 — set whenever runtime events/OperationalState were recorded for this run. */
  runtimeState?: {
    taskId: string;
    attemptId: string;
    operationalStateHash: string;
    eventCount: number;
    /** V5 P09 § V5-13 — unresolved orphaned tool executions carried into/out of this run. */
    pendingUnknownOutcomeCount: number;
  };
};

export type { ToolCall, ToolResult };
