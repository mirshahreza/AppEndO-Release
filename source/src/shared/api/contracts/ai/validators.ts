import {
  AI_PROVIDER_OPTIONS,
  applyKnownModelCapabilityOverrides,
  DEFAULT_AI_CAPABILITIES,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_AI_HTTP_SETTINGS,
  DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS,
  DEFAULT_AI_MCP_SETTINGS,
  DEFAULT_AI_WEB_SEARCH_SETTINGS,
  getAiProviderLabel,
  isAiModelChatCapable,
  REDACTED_API_KEY,
  resolveEffectiveModelBaseUrl,
} from './constants';
import { parseFunctionAccessControl } from '../server-functions/accessControl';
import { normalizeAiAgentSettings, normalizeAiMcpServerConfig, normalizeAiMcpServers, normalizeCapabilityPackIds } from './agentValidators';
import type { AiCapabilityPackId } from './capabilityPacks';
import { AiValidationError } from './errors';
import { migrateModelRequestParams, sanitizeRequestParams } from '../../../../core/ai/providers/modelRequestParams';
import { normalizeEuaAssistSettings } from './euaAssistSettings';
import type {
  AiGlobalSettings,
  AiModelCapabilities,
  AiModelEntry,
  AiModelPublicEntry,
  AiMcpServerConfig,
  AiMcpServerPublicConfig,
  AiMcpInboundHostPublicSettings,
  AiMcpInboundHostSettings,
  AiMcpPublicSettings,
  AiMcpSettings,
  AiProviderConfig,
  AiProviderKind,
  AiProviderPublicConfig,
  AiSettings,
  AiSettingsResponse,
  AiWebSearchProvider,
  AiWebSearchPublicSettings,
  AiWebSearchSettings,
  AiHttpSettings,
} from './types';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const PROVIDER_KINDS = new Set<AiProviderKind>(AI_PROVIDER_OPTIONS.map((item) => item.value));
const WEB_SEARCH_PROVIDERS = new Set<AiWebSearchProvider>(['disabled', 'brave', 'tavily', 'serper']);

export { AiValidationError } from './errors';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value);
  return normalized;
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parseRequestParams = (value: unknown, modelId: string): Record<string, unknown> | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new AiValidationError(`Model "${modelId}" requestParams must be a JSON object.`);
  }
  if (Object.keys(value).length === 0) return undefined;
  return value;
};

const normalizeCapabilities = (input: unknown): AiModelCapabilities => {
  const raw = isRecord(input) ? input : {};
  return {
    chat: raw.chat !== undefined ? Boolean(raw.chat) : DEFAULT_AI_CAPABILITIES.chat,
    streaming: raw.streaming !== undefined ? Boolean(raw.streaming) : DEFAULT_AI_CAPABILITIES.streaming,
    vision: raw.vision !== undefined ? Boolean(raw.vision) : DEFAULT_AI_CAPABILITIES.vision,
    tools: raw.tools !== undefined ? Boolean(raw.tools) : DEFAULT_AI_CAPABILITIES.tools,
    embeddings: raw.embeddings !== undefined ? Boolean(raw.embeddings) : DEFAULT_AI_CAPABILITIES.embeddings,
    imageGeneration: raw.imageGeneration !== undefined
      ? Boolean(raw.imageGeneration)
      : DEFAULT_AI_CAPABILITIES.imageGeneration,
    speechToText: raw.speechToText !== undefined
      ? Boolean(raw.speechToText)
      : DEFAULT_AI_CAPABILITIES.speechToText,
    textToSpeech: raw.textToSpeech !== undefined
      ? Boolean(raw.textToSpeech)
      : DEFAULT_AI_CAPABILITIES.textToSpeech,
  };
};

const normalizeProvider = (value: unknown): AiProviderKind => {
  const provider = String(value ?? '').trim() as AiProviderKind;
  if (!PROVIDER_KINDS.has(provider)) {
    throw new AiValidationError(`Provider "${provider || '(empty)'}" is not supported.`);
  }
  return provider;
};

export const normalizeAiProviderConfig = (input: unknown, index = 0): AiProviderConfig => {
  if (!isRecord(input)) {
    throw new AiValidationError(`Provider at index ${index} must be an object.`);
  }

  const provider = normalizeProvider(input.provider);

  const apiKeyRaw = parseOptionalString(input.apiKey)?.trim() || undefined;
  const apiKey = !apiKeyRaw || apiKeyRaw === REDACTED_API_KEY ? undefined : apiKeyRaw;

  return {
    provider,
    providerLabel: parseOptionalString(input.providerLabel)?.trim() || undefined,
    apiKey,
    hasApiKey: Boolean(input.hasApiKey) || Boolean(apiKey),
    baseUrl: parseOptionalString(input.baseUrl)?.trim() || undefined,
    organizationId: parseOptionalString(input.organizationId)?.trim() || undefined,
    note: parseOptionalString(input.note)?.trim() || undefined,
  };
};

export const normalizeAiModelEntry = (input: unknown, index = 0): AiModelEntry => {
  if (!isRecord(input)) {
    throw new AiValidationError(`Model at index ${index} must be an object.`);
  }

  const id = String(input.id ?? '').trim();
  const name = String(input.name ?? '').trim();
  const modelId = String(input.modelId ?? '').trim();
  const provider = normalizeProvider(input.provider);

  if (!id || !SLUG_PATTERN.test(id)) {
    throw new AiValidationError(`Model id "${id || '(empty)'}" is invalid. Use lowercase letters, numbers, and dashes.`);
  }
  if (!name) {
    throw new AiValidationError(`Model "${id}" requires a name.`);
  }
  if (!modelId) {
    throw new AiValidationError(`Model "${id}" requires modelId.`);
  }

  const temperatureDefault = parseOptionalNumber(input.temperatureDefault);
  if (temperatureDefault !== undefined && (temperatureDefault < 0 || temperatureDefault > 2)) {
    throw new AiValidationError(`Model "${id}" temperatureDefault must be between 0 and 2.`);
  }

  return migrateModelRequestParams({
    id,
    name,
    provider,
    providerLabel: parseOptionalString(input.providerLabel)?.trim() || undefined,
    modelId,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : true,
    isDefault: input.isDefault !== undefined ? Boolean(input.isDefault) : undefined,
    baseUrl: parseOptionalString(input.baseUrl)?.trim() || undefined,
    apiVersion: parseOptionalString(input.apiVersion)?.trim() || undefined,
    deploymentName: parseOptionalString(input.deploymentName)?.trim() || undefined,
    capabilities: applyKnownModelCapabilityOverrides(
      modelId,
      normalizeCapabilities(input.capabilities),
    ),
    contextWindowTokens: parseOptionalNumber(input.contextWindowTokens),
    maxOutputTokens: parseOptionalNumber(input.maxOutputTokens),
    temperatureDefault,
    timeoutMs: parseOptionalNumber(input.timeoutMs),
    requestParams: sanitizeRequestParams(modelId, parseRequestParams(input.requestParams, id)),
    note: parseOptionalString(input.note)?.trim() || undefined,
  });
};

const syncDefaultFlags = (models: AiModelEntry[], defaultModelId: string): AiModelEntry[] => (
  models.map((model) => ({
    ...model,
    isDefault: model.id === defaultModelId,
  }))
);

const defaultProviderForKind = (provider: AiProviderKind): AiProviderConfig => (
  DEFAULT_AI_PROVIDERS.find((item) => item.provider === provider) ?? {
    provider,
    providerLabel: getAiProviderLabel(provider),
  }
);

const mergeProvidersForModels = (
  models: AiModelEntry[],
  rawProviders: unknown,
): AiProviderConfig[] => {
  const providerMap = new Map<AiProviderKind, AiProviderConfig>();
  const rawList = Array.isArray(rawProviders) ? rawProviders : [];

  rawList.forEach((provider, index) => {
    const normalized = normalizeAiProviderConfig(provider, index);
    providerMap.set(normalized.provider, {
      ...defaultProviderForKind(normalized.provider),
      ...providerMap.get(normalized.provider),
      ...normalized,
    });
  });

  models.forEach((model) => {
    if (!providerMap.has(model.provider)) {
      providerMap.set(model.provider, {
        ...defaultProviderForKind(model.provider),
        providerLabel: model.providerLabel ?? defaultProviderForKind(model.provider).providerLabel,
      });
    }
  });

  return Array.from(providerMap.values())
    .sort((left, right) => getAiProviderLabel(left.provider, left.providerLabel)
      .localeCompare(getAiProviderLabel(right.provider, right.providerLabel)));
};

export const normalizeAiWebSearchSettings = (raw: unknown): AiWebSearchSettings => {
  const defaults = DEFAULT_AI_WEB_SEARCH_SETTINGS;
  const input = isRecord(raw) ? raw : {};

  const provider = String(input.provider ?? defaults.provider).trim() as AiWebSearchProvider;
  if (!WEB_SEARCH_PROVIDERS.has(provider)) {
    throw new AiValidationError(`Web search provider "${provider || '(empty)'}" is not supported.`);
  }

  const maxResults = parseOptionalNumber(input.maxResults);
  if (maxResults !== undefined && (maxResults < 1 || maxResults > 20)) {
    throw new AiValidationError('webSearch.maxResults must be between 1 and 20.');
  }

  const apiKeyRaw = parseOptionalString(input.apiKey)?.trim() || undefined;
  const apiKey = !apiKeyRaw || apiKeyRaw === REDACTED_API_KEY ? undefined : apiKeyRaw;

  return {
    provider,
    apiKey,
    hasApiKey: Boolean(input.hasApiKey) || Boolean(apiKey),
    maxResults: maxResults ?? defaults.maxResults,
  };
};

const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const normalizeAiHttpSettings = (raw: unknown): AiHttpSettings => {
  const defaults = DEFAULT_AI_HTTP_SETTINGS;
  const input = isRecord(raw) ? raw : {};
  const rawHostnames = Array.isArray(input.allowedHostnames)
    ? input.allowedHostnames
    : defaults.allowedHostnames;

  const allowedHostnames: string[] = [];
  const seen = new Set<string>();

  rawHostnames.forEach((item, index) => {
    const hostname = String(item ?? '').trim().toLowerCase();
    if (!hostname) return;
    if (hostname.includes('/') || hostname.includes(':') || hostname.includes(' ')) {
      throw new AiValidationError(
        `http.allowedHostnames[${index}] "${hostname}" is invalid — use hostname only (no protocol or path).`,
      );
    }
    if (!HOSTNAME_PATTERN.test(hostname)) {
      throw new AiValidationError(`http.allowedHostnames[${index}] "${hostname}" is not a valid hostname.`);
    }
    if (!seen.has(hostname)) {
      seen.add(hostname);
      allowedHostnames.push(hostname);
    }
  });

  return { allowedHostnames };
};

const INBOUND_MCP_SERVICE_ROLE_NAMES = ['ADMIN', 'DEVELOPER'] as const;

export const normalizeInboundMcpServiceRoleName = (raw: unknown): string | undefined => {
  const value = parseOptionalString(raw)?.trim();
  if (!value) {
    return undefined;
  }
  const normalized = value.toUpperCase();
  if (!INBOUND_MCP_SERVICE_ROLE_NAMES.includes(normalized as typeof INBOUND_MCP_SERVICE_ROLE_NAMES[number])) {
    throw new AiValidationError(
      `mcp.inboundHost.serviceRoleName must be one of: ${INBOUND_MCP_SERVICE_ROLE_NAMES.join(', ')}.`,
    );
  }
  return normalized;
};

export const normalizeAiMcpInboundHostSettings = (
  raw: unknown,
  options?: { requireApiKeyWhenEnabled?: boolean },
): AiMcpInboundHostSettings => {
  const defaults = DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS;
  const input = isRecord(raw) ? raw : {};
  const enabled = Boolean(input.enabled ?? defaults.enabled);
  const apiKeyRaw = parseOptionalString(input.apiKey)?.trim() || undefined;
  const apiKey = !apiKeyRaw || apiKeyRaw === REDACTED_API_KEY ? undefined : apiKeyRaw;
  const hasApiKey = Boolean(input.hasApiKey) || Boolean(apiKey);
  const serviceRoleName = normalizeInboundMcpServiceRoleName(
    input.serviceRoleName ?? defaults.serviceRoleName,
  );

  if (options?.requireApiKeyWhenEnabled && enabled && !apiKey && !hasApiKey) {
    throw new AiValidationError('mcp.inboundHost.apiKey is required when inbound MCP host is enabled.');
  }

  if (apiKey && apiKey.length < 16) {
    throw new AiValidationError('mcp.inboundHost.apiKey must be at least 16 characters.');
  }

  return {
    enabled,
    apiKey,
    hasApiKey,
    serviceRoleName,
  };
};

export const normalizeAiMcpSettings = (raw: unknown): AiMcpSettings => {
  const defaults = DEFAULT_AI_MCP_SETTINGS;
  const input = isRecord(raw) ? raw : {};
  const rawAllowlist = Array.isArray(input.stdioAllowlist)
    ? input.stdioAllowlist
    : defaults.stdioAllowlist;

  const stdioAllowlist: string[] = [];
  const seen = new Set<string>();
  rawAllowlist.forEach((item, index) => {
    const entry = String(item ?? '').trim();
    if (!entry) return;
    if (seen.has(entry)) return;
    if (entry.includes('\n') || entry.includes('\0')) {
      throw new AiValidationError(`mcp.stdioAllowlist[${index}] is invalid.`);
    }
    seen.add(entry);
    stdioAllowlist.push(entry);
  });

  const defaultCapabilityPackIds = Array.isArray(input.defaultCapabilityPackIds)
    ? [...new Set(
      input.defaultCapabilityPackIds
        .map((item) => String(item ?? '').trim())
        .filter(Boolean),
    )]
    : undefined;

  const inboundHost = normalizeAiMcpInboundHostSettings(
    input.inboundHost ?? defaults.inboundHost,
  );

  const resourceAccessControl = isRecord(input.resourceAccessControl)
    ? Object.fromEntries(
      Object.entries(input.resourceAccessControl).map(([resourceId, value]) => {
        const normalizedId = String(resourceId ?? '').trim();
        if (!normalizedId) {
          throw new AiValidationError('mcp.resourceAccessControl keys must be non-empty resource ids.');
        }
        return [normalizedId, parseFunctionAccessControl(value)];
      }),
    )
    : defaults.resourceAccessControl;

  return {
    stdioAllowlist,
    defaultCapabilityPackIds: defaultCapabilityPackIds?.length ? defaultCapabilityPackIds : undefined,
    inboundHost,
    resourceAccessControl,
  };
};

export const normalizeAiSettings = (raw: unknown): AiSettings => {
  const defaults = DEFAULT_AI_SETTINGS;
  const input = isRecord(raw) ? raw : {};

  const chatRateLimitPerMinute = Number(input.chatRateLimitPerMinute ?? defaults.chatRateLimitPerMinute);
  if (!Number.isFinite(chatRateLimitPerMinute) || chatRateLimitPerMinute < 1 || chatRateLimitPerMinute > 10000) {
    throw new AiValidationError('chatRateLimitPerMinute must be between 1 and 10000.');
  }

  const rawModels = Array.isArray(input.models) ? input.models : defaults.models;
  const models = rawModels.map((model, index) => normalizeAiModelEntry(model, index));
  const providers = mergeProvidersForModels(models, input.providers);

  const seenIds = new Set<string>();
  models.forEach((model) => {
    if (seenIds.has(model.id)) {
      throw new AiValidationError(`Duplicate model id "${model.id}".`);
    }
    seenIds.add(model.id);
  });

  const seenProviders = new Set<AiProviderKind>();
  providers.forEach((provider) => {
    if (seenProviders.has(provider.provider)) {
      throw new AiValidationError(`Duplicate provider "${provider.provider}".`);
    }
    seenProviders.add(provider.provider);
  });

  let defaultModelId = String(input.defaultModelId ?? defaults.defaultModelId).trim();
  const enabledModels = models.filter((model) => model.enabled);
  if (!defaultModelId || !models.some((model) => model.id === defaultModelId)) {
    defaultModelId = enabledModels[0]?.id ?? models[0]?.id ?? defaults.defaultModelId;
  }
  if (defaultModelId && !models.some((model) => model.id === defaultModelId)) {
    throw new AiValidationError(`defaultModelId "${defaultModelId}" does not match any model.`);
  }

  const syncedModels = syncDefaultFlags(models, defaultModelId);

  const embeddingsModelId = parseOptionalString(input.embeddingsModelId)?.trim() || undefined;
  if (embeddingsModelId && !models.some((model) => model.id === embeddingsModelId)) {
    throw new AiValidationError(`embeddingsModelId "${embeddingsModelId}" does not match any model.`);
  }

  return {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : defaults.enabled,
    defaultModelId,
    embeddingsModelId,
    chatRateLimitPerMinute: Math.floor(chatRateLimitPerMinute),
    projectNotes: parseOptionalString(input.projectNotes)?.trim() || undefined,
    providers,
    models: syncedModels,
    agent: normalizeAiAgentSettings(input.agent ?? defaults.agent),
    mcp: normalizeAiMcpSettings(input.mcp ?? defaults.mcp),
    mcpServers: normalizeAiMcpServers(input.mcpServers ?? defaults.mcpServers),
    webSearch: normalizeAiWebSearchSettings(input.webSearch ?? defaults.webSearch),
    http: normalizeAiHttpSettings(input.http ?? defaults.http),
    eua: normalizeEuaAssistSettings(input.eua ?? defaults.eua),
  };
};

export const normalizeAiGlobalSettings = (raw: unknown, current: AiSettings): AiGlobalSettings => {
  const input = isRecord(raw) ? raw : {};
  const merged = normalizeAiSettings({
    ...current,
    enabled: input.enabled ?? current.enabled,
    defaultModelId: input.defaultModelId ?? current.defaultModelId,
    chatRateLimitPerMinute: input.chatRateLimitPerMinute ?? current.chatRateLimitPerMinute,
    providers: current.providers,
    models: current.models,
  });

  return {
    enabled: merged.enabled,
    defaultModelId: merged.defaultModelId,
    chatRateLimitPerMinute: merged.chatRateLimitPerMinute,
  };
};

export const redactAiProviderConfig = (entry: AiProviderConfig): AiProviderPublicConfig => {
  const hasApiKey = Boolean(entry.hasApiKey) || Boolean(entry.apiKey?.trim());
  return {
    ...entry,
    apiKey: hasApiKey ? REDACTED_API_KEY : '',
    hasApiKey,
  };
};

export const redactAiModelEntry = (entry: AiModelEntry): AiModelPublicEntry => entry;

export const redactAiMcpServerConfig = (entry: AiMcpServerConfig): AiMcpServerPublicConfig => {
  const hasEnv = Boolean(entry.hasEnv) || Boolean(entry.env && Object.keys(entry.env).length > 0);
  return {
    ...entry,
    env: hasEnv ? { REDACTED: REDACTED_API_KEY } : undefined,
    hasEnv,
  };
};

export const redactAiWebSearchSettings = (entry: AiWebSearchSettings): AiWebSearchPublicSettings => {
  const hasApiKey = Boolean(entry.hasApiKey) || Boolean(entry.apiKey?.trim());
  return {
    ...entry,
    apiKey: hasApiKey ? REDACTED_API_KEY : '',
    hasApiKey,
  };
};

export const redactAiMcpInboundHostSettings = (
  entry: AiMcpInboundHostSettings,
): AiMcpInboundHostPublicSettings => {
  const hasApiKey = Boolean(entry.hasApiKey) || Boolean(entry.apiKey?.trim());
  return {
    enabled: entry.enabled,
    apiKey: hasApiKey ? REDACTED_API_KEY : '',
    hasApiKey,
    serviceRoleName: entry.serviceRoleName,
  };
};

export const redactAiMcpSettings = (entry: AiMcpSettings): AiMcpPublicSettings => ({
  stdioAllowlist: entry.stdioAllowlist,
  defaultCapabilityPackIds: entry.defaultCapabilityPackIds,
  resourceAccessControl: entry.resourceAccessControl,
  inboundHost: entry.inboundHost
    ? redactAiMcpInboundHostSettings(entry.inboundHost)
    : redactAiMcpInboundHostSettings(DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS),
});

export const redactAiSettings = (settings: AiSettings): AiSettingsResponse => ({
  ...settings,
  providers: settings.providers.map(redactAiProviderConfig),
  models: settings.models.map(redactAiModelEntry),
  mcpServers: settings.mcpServers.map(redactAiMcpServerConfig),
  webSearch: redactAiWebSearchSettings(settings.webSearch),
  http: settings.http,
  mcp: redactAiMcpSettings(settings.mcp),
});

export const mergeProviderApiKey = (
  incoming: AiProviderConfig,
  existing: AiProviderConfig | undefined,
): AiProviderConfig => {
  const incomingKey = incoming.apiKey?.trim() ?? '';
  if (!incomingKey || incomingKey === REDACTED_API_KEY) {
    return {
      ...incoming,
      apiKey: existing?.apiKey?.trim() || undefined,
      hasApiKey: Boolean(existing?.hasApiKey) || Boolean(existing?.apiKey?.trim()) || Boolean(incoming.hasApiKey),
    };
  }
  return { ...incoming, hasApiKey: true };
};

export const validateAiModelPayload = (payload: unknown): AiModelEntry => (
  normalizeAiModelEntry(payload, 0)
);

export const validateAiProviderPayload = (payload: unknown): AiProviderConfig => (
  normalizeAiProviderConfig(payload, 0)
);

export const validateAiMcpServerPayload = (payload: unknown): AiMcpServerConfig => (
  normalizeAiMcpServerConfig(payload, 0)
);

export const mergeMcpServerEnv = (
  incoming: AiMcpServerConfig,
  existing: AiMcpServerConfig | undefined,
): AiMcpServerConfig => {
  const incomingEnv = incoming.env ?? {};
  const isRedactedEnv = !incoming.env
    || Object.keys(incomingEnv).length === 0
    || Object.entries(incomingEnv).every(([key, value]) => (
      key === 'REDACTED' || value === REDACTED_API_KEY || value === '***'
    ));

  if (isRedactedEnv) {
    return {
      ...incoming,
      env: existing?.env,
      hasEnv: Boolean(existing?.hasEnv) || Boolean(existing?.env && Object.keys(existing.env).length > 0) || Boolean(incoming.hasEnv),
    };
  }
  return { ...incoming, hasEnv: true };
};

export const mergeInboundHostApiKey = (
  incoming: AiMcpInboundHostSettings,
  existing: AiMcpInboundHostSettings | undefined,
): AiMcpInboundHostSettings => {
  const incomingKey = incoming.apiKey?.trim() ?? '';
  if (!incomingKey || incomingKey === REDACTED_API_KEY) {
    return {
      ...incoming,
      apiKey: existing?.apiKey?.trim() || undefined,
      hasApiKey: Boolean(existing?.hasApiKey) || Boolean(existing?.apiKey?.trim()) || Boolean(incoming.hasApiKey),
    };
  }
  return { ...incoming, hasApiKey: true };
};

export const mergeWebSearchApiKey = (
  incoming: AiWebSearchSettings,
  existing: AiWebSearchSettings | undefined,
): AiWebSearchSettings => {
  const incomingKey = incoming.apiKey?.trim() ?? '';
  if (!incomingKey || incomingKey === REDACTED_API_KEY) {
    return {
      ...incoming,
      apiKey: existing?.apiKey?.trim() || undefined,
      hasApiKey: Boolean(existing?.hasApiKey) || Boolean(existing?.apiKey?.trim()) || Boolean(incoming.hasApiKey),
    };
  }
  return { ...incoming, hasApiKey: true };
};

export const validateAiInboundHostPayload = (
  payload: unknown,
  existing?: AiMcpInboundHostSettings,
): AiMcpInboundHostSettings => {
  const normalized = normalizeAiMcpInboundHostSettings(payload);
  const merged = mergeInboundHostApiKey(normalized, existing);
  if (merged.enabled && !merged.apiKey?.trim() && !merged.hasApiKey && !existing?.hasApiKey) {
    throw new AiValidationError('mcp.inboundHost.apiKey is required when inbound MCP host is enabled.');
  }
  return merged;
};

export const validateAiWebSearchPayload = (payload: unknown): AiWebSearchSettings => (
  normalizeAiWebSearchSettings(payload)
);

export const validateAiHttpPayload = (payload: unknown): AiHttpSettings => (
  normalizeAiHttpSettings(payload)
);

export const validateDefaultCapabilityPacksPayload = (
  payload: unknown,
): { defaultCapabilityPackIds: AiCapabilityPackId[] } => {
  if (!isRecord(payload)) {
    throw new AiValidationError('defaultCapabilityPackIds payload must be an object.');
  }
  const defaultCapabilityPackIds = normalizeCapabilityPackIds(
    payload.defaultCapabilityPackIds,
    'defaultCapabilityPackIds',
  );
  return { defaultCapabilityPackIds };
};

export const validateAiMcpSettingsPayload = (payload: unknown): AiMcpSettings => (
  normalizeAiMcpSettings(payload)
);

export const resolveAiProviderConfig = (
  settings: AiSettings,
  provider: AiProviderKind,
): AiProviderConfig | undefined => (
  settings.providers.find((item) => item.provider === provider)
);

export const isUsableAiProviderApiKey = (apiKey?: string | null, hasApiKey?: boolean): boolean => {
  if (hasApiKey) {
    return true;
  }
  const trimmed = apiKey?.trim() ?? '';
  return trimmed.length > 0 && trimmed !== REDACTED_API_KEY;
};

export const isAiChatModelKeyedAndEnabled = (
  model: Pick<AiModelEntry, 'enabled' | 'capabilities' | 'provider'>,
  settings: AiSettings,
): boolean => {
  const provider = resolveAiProviderConfig(settings, model.provider);
  return Boolean(model.enabled)
    && isAiModelChatCapable(model)
    && isUsableAiProviderApiKey(provider?.apiKey, provider?.hasApiKey);
};

export const resolveModelRuntimeBaseUrl = (
  model: AiModelEntry,
  providerConfig?: AiProviderConfig,
): string | undefined => (
  resolveEffectiveModelBaseUrl(model.provider, model.baseUrl, providerConfig?.baseUrl)
);
