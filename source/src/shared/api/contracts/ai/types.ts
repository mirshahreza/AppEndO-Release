import type { LocalEmbeddingsModelStatus } from './localEmbeddingsModel';
import type { WorkspaceEmbeddingsIndexStatus } from './workspaceEmbeddingsIndexStatus';

export type AiProviderKind =
  | 'google-gemini'
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'ollama'
  | 'openai-compatible'
  | 'openrouter';

export type AiModelCapabilities = {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  tools: boolean;
  embeddings: boolean;
  imageGeneration: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
};

export type AiProviderConfig = {
  provider: AiProviderKind;
  providerLabel?: string;
  apiKey?: string;
  hasApiKey?: boolean;
  baseUrl?: string;
  organizationId?: string;
  note?: string;
};

export type AiModelEntry = {
  id: string;
  name: string;
  provider: AiProviderKind;
  providerLabel?: string;
  modelId: string;
  enabled: boolean;
  isDefault?: boolean;
  baseUrl?: string;
  apiVersion?: string;
  deploymentName?: string;
  capabilities: AiModelCapabilities;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  temperatureDefault?: number;
  timeoutMs?: number;
  /** Provider-specific API body overrides merged at request time. */
  requestParams?: Record<string, unknown>;
  note?: string;
};

export type AiNativeToolGroup =
  | 'standards'
  | 'search'
  | 'read'
  | 'draft'
  | 'plugins'
  | 'data'
  | 'context'
  | 'git'
  | 'openapi'
  | 'jobs'
  | 'edge'
  | 'memory'
  | 'cache'
  | 'workflow'
  | 'delegate';

export type AiOrchestrationPolicy = 'react' | 'utility-guided';

export type AiAgentSettings = {
  defaultMode: 'ask' | 'agent' | 'plan';
  maxIterations: number;
  maxIterationsVibe: number;
  /** Read-only Ask tool loop iteration cap. */
  maxIterationsAsk?: number;
  maxToolCallsPerTurn: number;
  maxTokensPerRun?: number;
  orchestrationPolicy?: AiOrchestrationPolicy;
  tokenBudgetHardStop?: boolean;
  allowedNativeToolGroups: AiNativeToolGroup[];
  writeRequiresConfirm: boolean;
  contextWorkingTurns?: number;
  contextSummarizeAfterTurns?: number;
  /** When true, segment H uses a cheap LLM call with heuristic fallback (TOK-15). */
  contextSummarizeWithLlm?: boolean;
  /** Max assistant tool turns whose observations stay in working memory (older turns pruned). */
  contextToolObservationMaxTurns?: number;
  traceRetentionDays?: number;
  vibeMaxFilesPerProposal?: number;
  vibeMaxLinesPerProposal?: number;
};

import type { FunctionAccessControl } from '../server-functions/accessControl';

export type AiMcpServerTransport = 'stdio' | 'sse' | 'http';

export type AiMcpServerConfig = {
  id: string;
  label: string;
  enabled: boolean;
  transport: AiMcpServerTransport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  hasEnv?: boolean;
  allowedTools?: string[];
  note?: string;
  accessControl?: FunctionAccessControl;
};

export type AiMcpServerPublicConfig = Omit<AiMcpServerConfig, 'env'> & {
  env?: Record<string, string>;
  hasEnv: boolean;
  sourcePluginId?: string;
  managedByPlugin?: boolean;
};

export type AiWebSearchProvider = 'disabled' | 'brave' | 'tavily' | 'serper';

export type AiWebSearchSettings = {
  provider: AiWebSearchProvider;
  apiKey?: string;
  hasApiKey?: boolean;
  maxResults?: number;
};

export type AiWebSearchPublicSettings = Omit<AiWebSearchSettings, 'apiKey'> & {
  apiKey?: string;
  hasApiKey: boolean;
};

export type AiHttpSettings = {
  allowedHostnames: string[];
};

export type AiMcpInboundHostSettings = {
  enabled: boolean;
  apiKey?: string;
  hasApiKey?: boolean;
  /** Role whose MCP grants constrain inbound tool exposure (default DEVELOPER). */
  serviceRoleName?: string;
};

export type AiMcpInboundHostPublicSettings = Omit<AiMcpInboundHostSettings, 'apiKey'> & {
  apiKey?: string;
  hasApiKey: boolean;
};

export type AiMcpSettings = {
  stdioAllowlist: string[];
  defaultCapabilityPackIds?: string[];
  inboundHost?: AiMcpInboundHostSettings;
  /** Access control for built-in packs and package MCP servers keyed by resource id. */
  resourceAccessControl?: Record<string, FunctionAccessControl>;
};

export type AiMcpPublicSettings = Omit<AiMcpSettings, 'inboundHost'> & {
  inboundHost?: AiMcpInboundHostPublicSettings;
};

import type { EuaAssistSettings } from './euaAssistSettings';

export type AiSettings = {
  enabled: boolean;
  defaultModelId: string;
  /**
   * Optional model entry id used for workspace code embeddings (vector search).
   * The entry's provider must expose an embeddings endpoint (OpenAI-compatible or
   * Ollama). Unset → vector search stays off and retrieval is lexical-only.
   */
  embeddingsModelId?: string;
  chatRateLimitPerMinute: number;
  /** Operator-authored workspace notes injected into AI system context when non-empty. */
  projectNotes?: string;
  providers: AiProviderConfig[];
  models: AiModelEntry[];
  agent: AiAgentSettings;
  mcp: AiMcpSettings;
  mcpServers: AiMcpServerConfig[];
  webSearch: AiWebSearchSettings;
  http: AiHttpSettings;
  /** End-user AI assist toggles and limits (EUA-14). */
  eua?: EuaAssistSettings;
};

export type AiGlobalSettings = Pick<AiSettings, 'enabled' | 'defaultModelId' | 'chatRateLimitPerMinute'>;

export type AiProviderPublicConfig = Omit<AiProviderConfig, 'apiKey'> & {
  apiKey?: string;
  hasApiKey: boolean;
};

export type AiModelPublicEntry = AiModelEntry;

export type AiSettingsResponse = Omit<AiSettings, 'models' | 'providers' | 'mcpServers' | 'webSearch' | 'mcp'> & {
  models: AiModelPublicEntry[];
  providers: AiProviderPublicConfig[];
  mcpServers: AiMcpServerPublicConfig[];
  webSearch: AiWebSearchPublicSettings;
  mcp: AiMcpPublicSettings;
  localEmbeddings?: LocalEmbeddingsModelStatus;
  workspaceEmbeddingsIndex?: WorkspaceEmbeddingsIndexStatus;
};

export type AiRemoteModelSummary = {
  id: string;
  name?: string;
  description?: string;
  contextLength?: number;
  pricingPrompt?: string;
  pricingCompletion?: string;
};

export type AiAvailableModel = {
  id: string;
  name: string;
  provider: AiProviderKind;
  providerLabel: string;
  modelId: string;
  isDefault: boolean;
  hasApiKey: boolean;
  capabilities: AiModelCapabilities;
  contextWindowTokens?: number;
};
