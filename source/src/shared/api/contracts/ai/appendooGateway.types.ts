import type { AgentMode } from './agentTypes';
import type { AiPageContext } from './pageContext';

/** Mirrors TurnExecutionProfile — kept here to avoid shared→core imports. */
export type AssistantTurnProfile =
  | 'ask_lookup'
  | 'plan_authoring'
  | 'agent_lookup'
  | 'agent_plan_review'
  | 'agent_implement'
  | 'agent_implement_governed';

/** V3 assistant execution class — routes to the smallest safe pipeline. */
export type AssistantRequestClass =
  | 'CONVERSATION'
  | 'CONTEXT_QUERY'
  | 'TOOL_QUERY'
  | 'OPERATIONAL_ACTION'
  | 'ENGINEERING_QUERY'
  | 'ENGINEERING_CHANGE';

/** Model gateway task profiles (Phase 03). */
export type AiTaskProfile =
  | 'GENERAL_CHAT'
  | 'PAGE_CONTEXT_QUERY'
  | 'TOOL_SESSION'
  | 'INTENT_COMPILE'
  | 'CODE_SUMMARY'
  | 'PLAN'
  | 'WORKER_DATABASE'
  | 'WORKER_SERVER'
  | 'WORKER_UI'
  | 'WORKER_SECURITY'
  | 'SEMANTIC_GRADE';

/** V4 E.1 — lightweight LLM intent classifier output token. */
export type LlmAssistantIntentClass =
  | 'engineering_change'
  | 'engineering_query'
  | 'operational_action'
  | 'governed_engineering'
  | 'continuation'
  | 'general_chat';

export type AssistantRequestRoutingInput = {
  mode: AgentMode;
  userPrompt: string;
  executionProfile: AssistantTurnProfile;
  pageContext?: AiPageContext;
  correlationId?: string;
  /** Optional LLM classifier hint (V4 E.1) — regex remains fallback when absent. */
  llmIntentClass?: LlmAssistantIntentClass | null;
};

export type AssistantRequestRouting = {
  requestClass: AssistantRequestClass;
  taskProfile: AiTaskProfile;
  routerVersion: string;
  routingReason: string;
  confidence: number;
  requiresClarification: boolean;
  /** When true, full V3 engineering pipeline (Intent → Workspace) applies. */
  useEngineeringPipeline: boolean;
};

export type EffectiveModelCapabilities = {
  modelId: string;
  declaredChat: boolean;
  declaredStreaming: boolean;
  declaredTools: boolean;
  effectiveTools: boolean;
  effectiveStreaming: boolean;
};

export type ModelGatewayCapabilityRequirement = 'chat' | 'tools' | 'streaming';

export type ModelGatewayTaskProfilePolicy = {
  taskProfile: AiTaskProfile;
  requiredCapabilities: ModelGatewayCapabilityRequirement[];
  maxAttempts: number;
  timeoutMs: number;
};

export type ModelGatewayInvokeKind = 'text' | 'structured' | 'tool_session';

export type ModelGatewayTelemetryRecord = {
  correlationId?: string;
  taskProfile: AiTaskProfile;
  modelId: string;
  provider?: string;
  invokeKind: ModelGatewayInvokeKind;
  promptTemplateId?: string;
  templateVersion?: string;
  latencyMs: number;
  attemptCount: number;
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
  validationErrors?: string[];
  retryReason?: string;
  toolCallCount?: number;
  redactedFieldCount?: number;
};

export type ModelGatewayStructuredResult<T> = {
  data: T;
  telemetry: ModelGatewayTelemetryRecord;
};

export type ModelGatewayToolSessionResult = {
  text?: string;
  toolCalls?: import('./agentTypes').ToolCall[];
  telemetry: ModelGatewayTelemetryRecord;
};

export const APPENDOO_ROUTER_VERSION = '1.0.0';