import type {
  AiAgentSettings,
  AiHttpSettings,
  AiMcpSettings,
  AiModelCapabilities,
  AiModelEntry,
  AiMcpServerConfig,
  AiNativeToolGroup,
  AiProviderConfig,
  AiProviderKind,
  AiSettings,
  AiWebSearchProvider,
  AiWebSearchSettings,
} from './types';
import { PRESET_AI_MODELS } from './aiModelCatalog';
import { supportsOpenAiResponsesImageGeneration } from '../../../../core/ai/providers/openAiModelRouting';

export { PRESET_AI_MODELS } from './aiModelCatalog';

export const REDACTED_API_KEY = '••••••••';

export const DEFAULT_AI_CAPABILITIES: AiModelCapabilities = {
  chat: true,
  streaming: true,
  vision: false,
  tools: false,
  embeddings: false,
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
};

/** Known provider model IDs that cannot use chat/completions (e.g. OpenAI Responses-only). */
export const resolveKnownModelCapabilities = (modelId: string): Partial<AiModelCapabilities> | null => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return null;

  if (/^gpt-image(?:-|\.|$)/.test(normalized) || /^dall-e(?:-|$)/.test(normalized)) {
    return {
      chat: true,
      streaming: false,
      imageGeneration: true,
    };
  }

  if (supportsOpenAiResponsesImageGeneration(normalized)) {
    return {
      chat: true,
      streaming: true,
      vision: true,
      tools: true,
      imageGeneration: true,
    };
  }

  if (
    /^text-embedding(?:-|$)/.test(normalized)
    || /^gemini-embedding(?:-|\.|$)/.test(normalized)
  ) {
    return {
      chat: false,
      streaming: false,
      embeddings: true,
    };
  }

  if (/^tts-(?:\d|$)/.test(normalized)) {
    return {
      chat: false,
      streaming: false,
      textToSpeech: true,
    };
  }

  if (/^whisper(?:-|$)/.test(normalized)) {
    return {
      chat: false,
      streaming: false,
      speechToText: true,
    };
  }

  return null;
};

export const applyKnownModelCapabilityOverrides = (
  modelId: string,
  capabilities: AiModelCapabilities,
): AiModelCapabilities => {
  const known = resolveKnownModelCapabilities(modelId);
  if (!known) return capabilities;

  return {
    ...capabilities,
    ...known,
  };
};

export const isAiModelChatCapable = (
  model: Pick<AiModelEntry, 'capabilities'>,
): boolean => Boolean(model.capabilities.chat);

export const isAiModelImageEditorEligible = (
  model: Pick<AiModelEntry, 'capabilities'>,
): boolean => Boolean(model.capabilities.imageGeneration || model.capabilities.vision);

/** Models that can return an edited image from the image editor AI panel. */
export const isAiModelImageEditorOutputCapable = (
  model: Pick<AiModelEntry, 'capabilities' | 'modelId' | 'provider' | 'deploymentName'>,
): boolean => {
  if (model.capabilities.imageGeneration) return true;

  const provider = model.provider;
  if (provider !== 'openai' && provider !== 'azure-openai' && provider !== 'openai-compatible') {
    return false;
  }

  const modelRef = model.deploymentName?.trim() || model.modelId;
  return supportsOpenAiResponsesImageGeneration(modelRef);
};

/** Embedding-only models — show a text label instead of capability icons in the UI. */
export const isAiModelEmbeddingOnly = (
  model: Pick<AiModelEntry, 'capabilities'>,
): boolean => {
  const { capabilities } = model;
  if (!capabilities.embeddings || capabilities.chat) {
    return false;
  }

  return !capabilities.vision
    && !capabilities.imageGeneration
    && !capabilities.speechToText
    && !capabilities.textToSpeech
    && !capabilities.tools;
};

export const AI_MODEL_EMBEDDING_ONLY_DISPLAY_LABEL = 'Embedding';

/** Catalog embedding presets surfaced in Settings → AI Models for UI review. */
export const EMBEDDING_CATALOG_MODEL_IDS = [
  'google-text-embedding-004',
  'openai-text-embedding-3-small',
] as const;

export const AI_CAPABILITY_LABELS: Record<keyof AiModelCapabilities, string> = {
  chat: 'Chat',
  streaming: 'Streaming',
  vision: 'Vision',
  tools: 'Tools',
  embeddings: 'Embeddings',
  imageGeneration: 'Image generation',
  speechToText: 'Speech to text',
  textToSpeech: 'Text to speech',
};

export const AI_CAPABILITY_KEYS = [
  'chat',
  'vision',
  'imageGeneration',
  'speechToText',
  'textToSpeech',
  'tools',
] as const satisfies readonly (keyof AiModelCapabilities)[];

/** Display order with separators between chat, image, audio, and tools groups. */
export const AI_CAPABILITY_GROUPS = [
  ['chat'],
  ['vision', 'imageGeneration'],
  ['speechToText', 'textToSpeech'],
  ['tools'],
] as const satisfies readonly (readonly (typeof AI_CAPABILITY_KEYS)[number][])[];

export const AI_CAPABILITY_SEPARATOR_CLASS = 'h-5 w-px shrink-0 bg-slate-200';

export const AI_PROVIDER_OPTIONS: Array<{ value: AiProviderKind; label: string }> = [
  { value: 'google-gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'openrouter', label: 'OpenRouter' },
];

export const getAiProviderLabel = (provider: AiProviderKind, providerLabel?: string): string => {
  if (providerLabel?.trim()) return providerLabel.trim();
  return AI_PROVIDER_OPTIONS.find((item) => item.value === provider)?.label ?? provider;
};

/** Catalog labels for merge/normalize — not inserted into fresh settings by default. */
export const DEFAULT_AI_PROVIDERS: AiProviderConfig[] = [
  { provider: 'google-gemini', providerLabel: 'Google Gemini' },
  { provider: 'openai', providerLabel: 'OpenAI' },
  { provider: 'anthropic', providerLabel: 'Anthropic' },
  { provider: 'azure-openai', providerLabel: 'Azure OpenAI' },
  { provider: 'ollama', providerLabel: 'Ollama' },
  { provider: 'openai-compatible', providerLabel: 'OpenAI-compatible' },
  { provider: 'openrouter', providerLabel: 'OpenRouter' },
];

export type AiProviderHostKind = 'cloud' | 'local';

export type AiProviderSetupTemplate = {
  /** Stable id for the add-provider picker (multiple templates may share the same `kind`). */
  id: string;
  kind: AiProviderKind;
  hostKind: AiProviderHostKind;
  label: string;
  description: string;
  defaultBaseUrl?: string;
  baseUrlPlaceholder?: string;
  apiKeyHint?: string;
};

const LOCAL_HOST_URL_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?::|\/|$)/i;

export const resolveAiProviderHostKind = (
  kind: AiProviderKind,
  baseUrl?: string | null,
): AiProviderHostKind => {
  if (kind === 'ollama') return 'local';
  if (kind !== 'openai-compatible') return 'cloud';

  const trimmed = baseUrl?.trim();
  if (!trimmed) return 'local';
  return LOCAL_HOST_URL_PATTERN.test(trimmed) ? 'local' : 'cloud';
};

/** VS Code–style provider templates for Settings → Add provider (not saved until the operator confirms). */
export const AI_PROVIDER_SETUP_TEMPLATES: AiProviderSetupTemplate[] = [
  {
    id: 'openai',
    kind: 'openai',
    hostKind: 'cloud',
    label: 'OpenAI',
    description: 'Official OpenAI API (GPT and related models).',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyHint: 'Create an API key at platform.openai.com.',
  },
  {
    id: 'google-gemini',
    kind: 'google-gemini',
    hostKind: 'cloud',
    label: 'Google Gemini',
    description: 'Google GenAI models via the Gemini API.',
    apiKeyHint: 'Create an API key in Google AI Studio.',
  },
  {
    id: 'anthropic',
    kind: 'anthropic',
    hostKind: 'cloud',
    label: 'Anthropic',
    description: 'Claude models via the Anthropic API.',
    defaultBaseUrl: 'https://api.anthropic.com',
    apiKeyHint: 'Create an API key in the Anthropic Console.',
  },
  {
    id: 'azure-openai',
    kind: 'azure-openai',
    hostKind: 'cloud',
    label: 'Azure OpenAI',
    description: 'Azure-hosted OpenAI deployments.',
    baseUrlPlaceholder: 'https://YOUR-RESOURCE.openai.azure.com',
    apiKeyHint: 'Use the key from your Azure OpenAI resource.',
  },
  {
    id: 'openrouter',
    kind: 'openrouter',
    hostKind: 'cloud',
    label: 'OpenRouter',
    description: 'Unified gateway to many hosted models.',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyHint: 'Create an API key at openrouter.ai.',
  },
  {
    id: 'lm-studio',
    kind: 'openai-compatible',
    hostKind: 'local',
    label: 'LM Studio',
    description: 'LM Studio local server (OpenAI-compatible API on your machine).',
    defaultBaseUrl: 'http://localhost:1234/v1',
    apiKeyHint: 'LM Studio often accepts any non-empty key; leave blank if the server does not require one.',
  },
  {
    id: 'vllm',
    kind: 'openai-compatible',
    hostKind: 'local',
    label: 'vLLM',
    description: 'vLLM OpenAI-compatible server (typical default port 8000).',
    defaultBaseUrl: 'http://localhost:8000/v1',
    apiKeyHint: 'Optional unless your vLLM instance requires an API key.',
  },
  {
    id: 'localai',
    kind: 'openai-compatible',
    hostKind: 'local',
    label: 'LocalAI',
    description: 'LocalAI OpenAI-compatible API on your machine or LAN.',
    defaultBaseUrl: 'http://localhost:8080/v1',
    apiKeyHint: 'Optional for most LocalAI installs.',
  },
  {
    id: 'ollama',
    kind: 'ollama',
    hostKind: 'local',
    label: 'Ollama',
    description: 'Local models served by Ollama on your machine or network.',
    defaultBaseUrl: 'http://localhost:11434',
    apiKeyHint: 'Usually not required unless your Ollama instance enforces auth.',
  },
  {
    id: 'other-cloud',
    kind: 'openai-compatible',
    hostKind: 'cloud',
    label: 'Other (cloud)',
    description: 'Any hosted OpenAI-compatible gateway (Groq, Together, custom proxy, …). Set base URL and API key below.',
    baseUrlPlaceholder: 'https://api.example.com/v1',
    apiKeyHint: 'Use the API key from your gateway or proxy provider.',
  },
  {
    id: 'other-local',
    kind: 'openai-compatible',
    hostKind: 'local',
    label: 'Other (local)',
    description: 'Any local or LAN OpenAI-compatible server not listed above (llama.cpp server, custom port, …).',
    baseUrlPlaceholder: 'http://localhost:PORT/v1',
    apiKeyHint: 'Optional for most local servers; use any value if the server requires a non-empty key.',
  },
];

export const getAiProviderSetupTemplateById = (id: string): AiProviderSetupTemplate | undefined => (
  AI_PROVIDER_SETUP_TEMPLATES.find((item) => item.id === id)
);

export const getAiProviderSetupTemplate = (kind: AiProviderKind): AiProviderSetupTemplate | undefined => (
  AI_PROVIDER_SETUP_TEMPLATES.find((item) => item.kind === kind)
);

export const listAiProviderSetupTemplatesByHost = (
  hostKind: AiProviderHostKind,
): AiProviderSetupTemplate[] => (
  AI_PROVIDER_SETUP_TEMPLATES.filter((item) => item.hostKind === hostKind)
);

/** Built-in HTTP base URLs when provider/model config leaves baseUrl empty. */
export const AI_PROVIDER_BUILTIN_BASE_URL: Partial<Record<AiProviderKind, string>> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
  openrouter: 'https://openrouter.ai/api/v1',
};

export const buildAiProviderConfigFromTemplate = (templateId: string): AiProviderConfig => {
  const template = getAiProviderSetupTemplateById(templateId)
    ?? getAiProviderSetupTemplate(templateId as AiProviderKind);
  if (!template) {
    const kind = templateId as AiProviderKind;
    const catalog = DEFAULT_AI_PROVIDERS.find((item) => item.provider === kind);
    return {
      provider: kind,
      providerLabel: catalog?.providerLabel ?? getAiProviderLabel(kind),
      apiKey: '',
      baseUrl: AI_PROVIDER_BUILTIN_BASE_URL[kind] ?? '',
    };
  }

  const { kind } = template;
  return {
    provider: kind,
    providerLabel: template.label,
    apiKey: '',
    baseUrl: template.defaultBaseUrl ?? AI_PROVIDER_BUILTIN_BASE_URL[kind] ?? '',
  };
};

export const resolveEffectiveProviderBaseUrl = (
  provider: AiProviderKind,
  configured?: string | null,
): string | undefined => {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  return AI_PROVIDER_BUILTIN_BASE_URL[provider];
};

export const resolveEffectiveModelBaseUrl = (
  provider: AiProviderKind,
  modelBaseUrl?: string | null,
  providerBaseUrl?: string | null,
): string | undefined => {
  const configured = modelBaseUrl?.trim() || providerBaseUrl?.trim() || undefined;
  return resolveEffectiveProviderBaseUrl(provider, configured);
};

export const describeProviderEndpointHint = (
  provider: AiProviderKind,
  configured?: string | null,
): string => {
  const trimmed = configured?.trim();
  const builtin = AI_PROVIDER_BUILTIN_BASE_URL[provider];

  if (trimmed) {
    return `Requests use: ${trimmed}`;
  }
  if (builtin) {
    return `Leave empty to use the built-in default: ${builtin}`;
  }
  if (provider === 'google-gemini') {
    return 'Google GenAI SDK — Google manages the endpoint. Set a URL only for a proxy or custom gateway.';
  }
  if (provider === 'azure-openai') {
    return 'No built-in default. Example: https://YOUR-RESOURCE.openai.azure.com';
  }
  if (provider === 'openai-compatible') {
    return 'No built-in default. Example: http://localhost:1234/v1';
  }
  return 'Configure the API base URL for this provider.';
};

export const describeModelEndpointHint = (
  provider: AiProviderKind,
  modelBaseUrl?: string | null,
  providerBaseUrl?: string | null,
): string => {
  const modelTrimmed = modelBaseUrl?.trim();
  const providerTrimmed = providerBaseUrl?.trim();

  if (modelTrimmed) {
    return `Model override: ${modelTrimmed}`;
  }
  if (providerTrimmed) {
    return `Inherits provider URL: ${providerTrimmed}`;
  }

  const effective = resolveEffectiveModelBaseUrl(provider, modelBaseUrl, providerBaseUrl);
  if (effective) {
    return `Effective endpoint: ${effective}`;
  }
  return describeProviderEndpointHint(provider, null);
};

/** Append catalog presets that are not already present in saved settings. */
export const mergeMissingPresetAiModels = (models: AiModelEntry[]): AiModelEntry[] => {
  const existingIds = new Set(models.map((model) => model.id));
  const additions = PRESET_AI_MODELS
    .filter((preset) => !existingIds.has(preset.id))
    .map((preset) => ({
      ...preset,
      capabilities: { ...preset.capabilities },
    }));

  return additions.length > 0 ? [...models, ...additions] : models;
};

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128000;

export const resolveModelContextWindowTokens = (
  modelId: string | undefined,
  configured?: number,
): number => {
  if (typeof configured === 'number' && configured > 0) {
    return configured;
  }

  if (modelId) {
    const preset = PRESET_AI_MODELS.find((model) => model.id === modelId);
    if (preset?.contextWindowTokens && preset.contextWindowTokens > 0) {
      return preset.contextWindowTokens;
    }
  }

  return DEFAULT_CONTEXT_WINDOW_TOKENS;
};

export const AI_NATIVE_TOOL_GROUPS: AiNativeToolGroup[] = [
  'standards',
  'search',
  'read',
  'draft',
  'plugins',
  'data',
  'context',
  'git',
  'openapi',
  'jobs',
  'edge',
  'memory',
  'cache',
  'workflow',
  'delegate',
];

export const DEFAULT_AI_AGENT_SETTINGS: AiAgentSettings = {
  defaultMode: 'ask',
  maxIterations: 10,
  maxIterationsVibe: 40,
  maxIterationsAsk: 8,
  // p-63 A3 — 5 silently dropped model-planned tool calls mid-turn (F-8); 20 still truncated
  // multi-file retrieve/edit batches on complex tasks with a fabricated failure result.
  maxToolCallsPerTurn: 40,
  // p-63 A4 — 80k died mid-task on modern 200k-context models (F-6).
  maxTokensPerRun: 200_000,
  orchestrationPolicy: 'react',
  tokenBudgetHardStop: true,
  allowedNativeToolGroups: ['standards', 'search', 'read', 'data', 'git', 'openapi', 'delegate'],
  writeRequiresConfirm: true,
  contextWorkingTurns: 8,
  contextSummarizeAfterTurns: 12,
  contextSummarizeWithLlm: true,
  // p-63 A3 — 4 made the model forget what it read while still mid-task (F-3).
  contextToolObservationMaxTurns: 12,
  traceRetentionDays: 30,
  vibeMaxFilesPerProposal: 8,
  vibeMaxLinesPerProposal: 400,
};

export const DEFAULT_AI_MCP_SERVERS: AiMcpServerConfig[] = [];

export const AI_WEB_SEARCH_PROVIDER_OPTIONS: Array<{ value: AiWebSearchProvider; label: string }> = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'serper', label: 'Serper (Google)' },
];

export const DEFAULT_AI_WEB_SEARCH_SETTINGS: AiWebSearchSettings = {
  provider: 'disabled',
  maxResults: 5,
};

export const DEFAULT_AI_HTTP_SETTINGS: AiHttpSettings = {
  allowedHostnames: [],
};

export const DEFAULT_INBOUND_MCP_SERVICE_ROLE = 'DEVELOPER' as const;

export const DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS = {
  enabled: false,
  serviceRoleName: DEFAULT_INBOUND_MCP_SERVICE_ROLE,
} as const;

export const DEFAULT_AI_MCP_SETTINGS: AiMcpSettings = {
  stdioAllowlist: [],
  inboundHost: { ...DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS },
};

import { DEFAULT_EUA_ASSIST_SETTINGS } from './euaAssistSettings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  defaultModelId: '',
  chatRateLimitPerMinute: 20,
  providers: [],
  models: [],
  agent: { ...DEFAULT_AI_AGENT_SETTINGS, allowedNativeToolGroups: [...DEFAULT_AI_AGENT_SETTINGS.allowedNativeToolGroups] },
  mcp: {
    ...DEFAULT_AI_MCP_SETTINGS,
    stdioAllowlist: [],
    inboundHost: { ...DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS },
  },
  mcpServers: [],
  webSearch: { ...DEFAULT_AI_WEB_SEARCH_SETTINGS },
  http: { ...DEFAULT_AI_HTTP_SETTINGS, allowedHostnames: [] },
  eua: {
    ...DEFAULT_EUA_ASSIST_SETTINGS,
    capabilities: { ...DEFAULT_EUA_ASSIST_SETTINGS.capabilities },
  },
};
