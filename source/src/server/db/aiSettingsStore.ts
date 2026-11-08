import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { DEFAULT_AI_SETTINGS } from '../../shared/api/contracts/ai/constants';
import {
  aiSettingsBlobNeedsCatalogRepair,
  repairAiSettingsBlob,
} from '../services/ai/aiSettingsCatalogRepair';
import {
  AiValidationError,
  mergeInboundHostApiKey,
  mergeMcpServerEnv,
  mergeProviderApiKey,
  mergeWebSearchApiKey,
  normalizeAiGlobalSettings,
  normalizeAiHttpSettings,
  normalizeAiModelEntry,
  normalizeAiProviderConfig,
  normalizeAiSettings,
  normalizeAiWebSearchSettings,
  validateAiInboundHostPayload,
} from '../../shared/api/contracts/ai/validators';
import { normalizeAiAgentSettings, normalizeAiMcpServerConfig } from '../../shared/api/contracts/ai/agentValidators';
import {
  getCachedPlatformBlob,
  isPlatformSettingsCacheInitialized,
} from '../services/settings/platformSettingsCache';
import type {
  AiAgentSettings,
  AiGlobalSettings,
  AiHttpSettings,
  AiMcpInboundHostSettings,
  AiMcpServerConfig,
  AiModelEntry,
  AiProviderConfig,
  AiProviderKind,
  AiSettings,
  AiWebSearchSettings,
} from '../../shared/api/contracts/ai/types';
import type { AiCapabilityPackId } from '../../shared/api/contracts/ai/capabilityPacks';
import type { FunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  assertAiSettingsHaveNoPlaintextSecret,
  deleteAiMcpServerSecrets,
  deleteAiProviderSecrets,
  isLegacySettingsSecretError,
  syncAiSettingsSecrets,
} from '../domain/security/credentialVault/platformSettingsSecrets';

const AI_SETTINGS_KEY = 'ai';

const readRawAiSettings = (settingsPath: string): unknown => {
  if (isPlatformSettingsCacheInitialized()) {
    return getCachedPlatformBlob('ai');
  }

  return readSettingsObject(settingsPath)[AI_SETTINGS_KEY];
};

export { AiValidationError };

export const getAiSettingsFromFile = (settingsPath: string): AiSettings => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[AI_SETTINGS_KEY];
  try {
    const normalized = normalizeAiSettings(raw);
    assertAiSettingsHaveNoPlaintextSecret(normalized);
    return normalized;
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeAiSettings(DEFAULT_AI_SETTINGS);
  }
};

const normalizeAiBlob = (raw: Record<string, unknown>): AiSettings => {
  try {
    const normalized = normalizeAiSettings(raw);
    assertAiSettingsHaveNoPlaintextSecret(normalized);
    return normalized;
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeAiSettings(DEFAULT_AI_SETTINGS);
  }
};

export const getAiSettings = (settingsPath: string): AiSettings => {
  const raw = readRawAiSettings(settingsPath);
  const settings = readPlatformBlob(settingsPath, 'ai', getAiSettingsFromFile, normalizeAiBlob);
  if (aiSettingsBlobNeedsCatalogRepair(raw)) {
    // p-63 — persist the repaired blob (legacy agent limits bumped), not the raw normalization,
    // otherwise the legacy values survive the write and re-flag repair on every load.
    try {
      return writeAiSettingsBlob(settingsPath, repairAiSettingsBlob(raw));
    } catch {
      return writeAiSettingsBlob(settingsPath, settings);
    }
  }
  return settings;
};

export const ensureAiSettings = (settingsPath: string): AiSettings => getAiSettings(settingsPath);

export const saveAiSettingsToFile = (
  settingsPath: string,
  ai: AiSettings,
): AiSettings => {
  const normalized = normalizeAiSettings(ai);
  const settings = readSettingsObject(settingsPath);
  settings[AI_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

const writeAiSettingsBlob = (settingsPath: string, ai: AiSettings): AiSettings => {
  const normalized = normalizeAiSettings(ai);
  return writePlatformBlob(
    settingsPath,
    'ai',
    normalized as unknown as Record<string, unknown>,
    saveAiSettingsToFile,
  ) as unknown as AiSettings;
};

const persistAiSettings = async (settingsPath: string, ai: AiSettings): Promise<AiSettings> => {
  const stripped = await syncAiSettingsSecrets(normalizeAiSettings(ai));
  return writeAiSettingsBlob(settingsPath, stripped);
};

export const mergeAiGlobalSettings = async (
  settingsPath: string,
  global: AiGlobalSettings,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedGlobal = normalizeAiGlobalSettings(global, current);
  return persistAiSettings(settingsPath, {
    ...current,
    ...normalizedGlobal,
    providers: current.providers,
    models: current.models,
  });
};

export const mergeAiAgentSettings = async (
  settingsPath: string,
  agent: Partial<AiAgentSettings>,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedAgent = normalizeAiAgentSettings({ ...current.agent, ...agent });

  return persistAiSettings(settingsPath, {
    ...current,
    agent: normalizedAgent,
  });
};

export const mergeAiModel = async (
  settingsPath: string,
  model: AiModelEntry,
  mode: 'create' | 'update',
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedModel = normalizeAiModelEntry(model, 0);
  const existing = current.models.find((item) => item.id === normalizedModel.id);

  if (mode === 'create' && existing) {
    throw new AiValidationError(`Model id "${normalizedModel.id}" already exists.`);
  }
  if (mode === 'update' && !existing) {
    throw new AiValidationError(`Model "${normalizedModel.id}" was not found.`);
  }

  const models = mode === 'create'
    ? [...current.models, normalizedModel]
    : current.models.map((item) => (item.id === normalizedModel.id ? normalizedModel : item));

  let defaultModelId = current.defaultModelId;
  if (normalizedModel.isDefault) {
    defaultModelId = normalizedModel.id;
  }

  const hasProvider = current.providers.some((item) => item.provider === normalizedModel.provider);
  const providers = hasProvider
    ? current.providers
    : [
      ...current.providers,
      normalizeAiProviderConfig({ provider: normalizedModel.provider, providerLabel: normalizedModel.providerLabel }),
    ];

  return persistAiSettings(settingsPath, {
    ...current,
    defaultModelId,
    providers,
    models,
  });
};

export const addAiProvider = async (
  settingsPath: string,
  providerKind: AiProviderKind,
  provider: AiProviderConfig,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedProvider = normalizeAiProviderConfig({ ...provider, provider: providerKind });
  const existing = current.providers.find((item) => item.provider === providerKind);

  if (existing) {
    throw new AiValidationError(`Provider "${providerKind}" already exists.`);
  }

  const mergedProvider = mergeProviderApiKey(normalizedProvider, undefined);
  return persistAiSettings(settingsPath, {
    ...current,
    providers: [...current.providers, mergedProvider],
  });
};

export const mergeAiProvider = async (
  settingsPath: string,
  providerKind: AiProviderKind,
  provider: AiProviderConfig,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedProvider = normalizeAiProviderConfig({ ...provider, provider: providerKind });
  const existing = current.providers.find((item) => item.provider === providerKind);

  if (!existing) {
    throw new AiValidationError(`Provider "${providerKind}" was not found.`);
  }

  const mergedProvider = mergeProviderApiKey(normalizedProvider, existing);
  const providers = current.providers.map((item) => (
    item.provider === providerKind ? mergedProvider : item
  ));

  return persistAiSettings(settingsPath, {
    ...current,
    providers,
  });
};

export const removeAiModel = async (settingsPath: string, modelId: string): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const models = current.models.filter((item) => item.id !== modelId);
  if (models.length === current.models.length) {
    throw new AiValidationError(`Model "${modelId}" was not found.`);
  }

  if (current.defaultModelId === modelId) {
    throw new AiValidationError(
      'Cannot delete the default model. Set another model as default first.',
    );
  }

  return persistAiSettings(settingsPath, {
    ...current,
    models,
  });
};

export const removeAiProvider = async (
  settingsPath: string,
  providerKind: AiProviderKind,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const existing = current.providers.find((item) => item.provider === providerKind);
  if (!existing) {
    throw new AiValidationError(`Provider "${providerKind}" was not found.`);
  }

  const providerModels = current.models.filter((item) => item.provider === providerKind);
  if (providerModels.some((item) => item.id === current.defaultModelId)) {
    throw new AiValidationError(
      'Cannot delete this provider while it contains the default model. Set another model as default first.',
    );
  }

  await deleteAiProviderSecrets(providerKind);
  return persistAiSettings(settingsPath, {
    ...current,
    providers: current.providers.filter((item) => item.provider !== providerKind),
    models: current.models.filter((item) => item.provider !== providerKind),
  });
};

export const getAiModelFromFile = (
  settingsPath: string,
  modelId: string,
): AiModelEntry | undefined => {
  const settings = getAiSettings(settingsPath);
  return settings.models.find((item) => item.id === modelId);
};

export const getAiProviderFromFile = (
  settingsPath: string,
  providerKind: AiProviderKind,
): AiProviderConfig | undefined => {
  const settings = getAiSettings(settingsPath);
  return settings.providers.find((item) => item.provider === providerKind);
};

export const mergeMcpServer = async (
  settingsPath: string,
  server: AiMcpServerConfig,
  mode: 'create' | 'update',
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedServer = normalizeAiMcpServerConfig(server, 0);
  const existing = current.mcpServers.find((item) => item.id === normalizedServer.id);

  if (mode === 'create' && existing) {
    throw new AiValidationError(`MCP server id "${normalizedServer.id}" already exists.`);
  }
  if (mode === 'update' && !existing) {
    throw new AiValidationError(`MCP server "${normalizedServer.id}" was not found.`);
  }

  const mergedServer = mode === 'update' && existing
    ? {
      ...mergeMcpServerEnv(normalizedServer, existing),
      accessControl: normalizedServer.accessControl ?? existing.accessControl,
    }
    : normalizedServer;

  const mcpServers = mode === 'create'
    ? [...current.mcpServers, mergedServer]
    : current.mcpServers.map((item) => (item.id === mergedServer.id ? mergedServer : item));

  return persistAiSettings(settingsPath, {
    ...current,
    mcpServers,
  });
};

export const removeMcpServer = async (settingsPath: string, serverId: string): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const mcpServers = current.mcpServers.filter((item) => item.id !== serverId);
  if (mcpServers.length === current.mcpServers.length) {
    throw new AiValidationError(`MCP server "${serverId}" was not found.`);
  }

  await deleteAiMcpServerSecrets(serverId);
  return persistAiSettings(settingsPath, {
    ...current,
    mcpServers,
  });
};

export const getMcpServerFromFile = (
  settingsPath: string,
  serverId: string,
): AiMcpServerConfig | undefined => {
  const settings = getAiSettings(settingsPath);
  return settings.mcpServers.find((item) => item.id === serverId);
};

export const mergeWebSearchSettings = async (
  settingsPath: string,
  webSearch: AiWebSearchSettings,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalized = normalizeAiWebSearchSettings(webSearch);
  const merged = mergeWebSearchApiKey(normalized, current.webSearch);

  return persistAiSettings(settingsPath, {
    ...current,
    webSearch: merged,
  });
};

export const mergeInboundHostSettings = async (
  settingsPath: string,
  inboundHost: AiMcpInboundHostSettings,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalized = validateAiInboundHostPayload(inboundHost, current.mcp.inboundHost);
  const merged = mergeInboundHostApiKey(normalized, current.mcp.inboundHost);

  return persistAiSettings(settingsPath, {
    ...current,
    mcp: {
      ...current.mcp,
      inboundHost: merged,
    },
  });
};

export const mergeHttpSettings = async (
  settingsPath: string,
  http: AiHttpSettings,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalized = normalizeAiHttpSettings(http);

  return persistAiSettings(settingsPath, {
    ...current,
    http: normalized,
  });
};

export const mergeDefaultCapabilityPackIds = async (
  settingsPath: string,
  packIds: AiCapabilityPackId[],
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const defaultCapabilityPackIds = packIds.length > 0 ? [...packIds] : undefined;

  return persistAiSettings(settingsPath, {
    ...current,
    mcp: {
      ...current.mcp,
      defaultCapabilityPackIds,
    },
  });
};

export const mergeMcpResourceAccessControl = async (
  settingsPath: string,
  resourceId: string,
  accessControl: FunctionAccessControl,
): Promise<AiSettings> => {
  const current = getAiSettings(settingsPath);
  const normalizedId = resourceId.trim();
  if (!normalizedId) {
    throw new AiValidationError('Resource id is required.');
  }

  const resourceAccessControl = {
    ...(current.mcp.resourceAccessControl ?? {}),
    [normalizedId]: accessControl,
  };

  return persistAiSettings(settingsPath, {
    ...current,
    mcp: {
      ...current.mcp,
      resourceAccessControl,
    },
  });
};
