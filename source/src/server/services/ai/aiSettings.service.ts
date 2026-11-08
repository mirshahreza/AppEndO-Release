import { normalizeAiAgentSettings } from '../../../shared/api/contracts/ai/agentValidators';
import { getAiProviderLabel } from '../../../shared/api/contracts/ai/constants';
import {
  isAiChatModelKeyedAndEnabled,
  normalizeAiGlobalSettings,
  normalizeAiSettings,
  redactAiSettings,
  redactAiMcpInboundHostSettings,
  validateAiModelPayload,
  validateAiMcpServerPayload,
  validateAiProviderPayload,
  validateAiWebSearchPayload,
  validateAiHttpPayload,
  validateAiInboundHostPayload,
  validateDefaultCapabilityPacksPayload,
} from '../../../shared/api/contracts/ai/validators';
import type {
  AiAvailableModel,
  AiGlobalSettings,
  AiProviderKind,
  AiSettings,
} from '../../../shared/api/contracts/ai/types';
import { aiManager } from '../../../core/ai/AiManager';
import { getLocalEmbeddingsModelStatus as readLocalEmbeddingsModelStatus } from '../../../core/ai/providers/localEmbeddingsModelLifecycle';
import { getWorkspaceEmbeddingsIndexStatus as readWorkspaceEmbeddingsIndexStatus } from '../../../core/ai/tools/native/workspaceEmbeddingsIndex';
import { hydrateAiSettingsSecrets, syncAiSettingsSecrets } from '../../domain/security/credentialVault/platformSettingsSecrets';
import {
  AiValidationError,
  getAiModelFromFile,
  getAiProviderFromFile,
  getAiSettings,
  getMcpServerFromFile,
  addAiProvider,
  mergeAiGlobalSettings,
  mergeAiModel,
  mergeAiProvider,
  mergeMcpServer,
  mergeAiAgentSettings,
  mergeWebSearchSettings,
  mergeHttpSettings,
  mergeInboundHostSettings,
  mergeDefaultCapabilityPackIds,
  mergeMcpResourceAccessControl,
  removeAiModel,
  removeAiProvider,
  removeMcpServer,
  saveAiSettingsToFile,
} from '../../db/aiSettingsStore';
import { testMcpServerConnection } from './mcp/McpBridge';
import { findPluginMcpServerOwner, listEffectivePublicMcpServers, listInstalledPluginMcpServers } from './mcp/packageMcpRegistry';
import { validateMcpServerPolicyAtSave } from './mcp/mcpPolicy';
import {
  assertMcpResourceInCatalog,
  normalizeMcpResourceAccessControlPayload,
} from './mcpAccess.service';

export type AiSettingsServiceDeps = {
  settingsPath: string;
};

export class AiSettingsService {
  constructor(private readonly deps: AiSettingsServiceDeps) {}

  private readSettings(): AiSettings {
    return getAiSettings(this.deps.settingsPath);
  }

  private async publishSettings(settings: AiSettings): Promise<AiSettings> {
    const hydrated = await hydrateAiSettingsSecrets(settings);
    aiManager.reloadFromSettings(hydrated);
    return settings;
  }

  getSettings() {
    const settings = this.readSettings();
    return {
      body: {
        success: true as const,
        ai: {
          ...redactAiSettings(settings),
          localEmbeddings: readLocalEmbeddingsModelStatus(),
          workspaceEmbeddingsIndex: readWorkspaceEmbeddingsIndexStatus(),
        },
      },
    };
  }

  async replaceSettings(payload: unknown) {
    const normalized = normalizeAiSettings(payload);
    const stripped = await syncAiSettingsSecrets(normalized);
    const saved = saveAiSettingsToFile(this.deps.settingsPath, stripped);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateGlobalSettings(payload: unknown) {
    const current = this.readSettings();
    const global = normalizeAiGlobalSettings(payload, current);
    const saved = await mergeAiGlobalSettings(this.deps.settingsPath, global);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        ai: redactAiSettings(saved),
      },
    };
  }

  listModels() {
    const settings = this.readSettings();
    return {
      body: {
        success: true as const,
        models: redactAiSettings(settings).models,
      },
    };
  }

  listAvailableModels() {
    const settings = this.readSettings();
    const chatModels = settings.models.filter((model) => isAiChatModelKeyedAndEnabled(model, settings));
    const models: AiAvailableModel[] = chatModels.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      providerLabel: getAiProviderLabel(model.provider, model.providerLabel),
      modelId: model.modelId,
      isDefault: model.id === settings.defaultModelId,
      hasApiKey: true,
      capabilities: model.capabilities,
      contextWindowTokens: model.contextWindowTokens,
    }));

    const defaultModelId = chatModels.some((model) => model.id === settings.defaultModelId)
      ? settings.defaultModelId
      : chatModels[0]?.id ?? '';

    return {
      body: {
        success: true as const,
        enabled: settings.enabled,
        defaultModelId,
        models: models.map((model) => ({
          ...model,
          isDefault: model.id === defaultModelId,
        })),
      },
    };
  }

  async addModel(payload: unknown) {
    const task = validateAiModelPayload(payload);
    const saved = await mergeAiModel(this.deps.settingsPath, task, 'create');
    await this.publishSettings(saved);
    const savedModel = saved.models.find((item) => item.id === task.id);
    return {
      statusCode: 201,
      body: {
        success: true as const,
        model: savedModel ? redactAiSettings({ ...saved, models: [savedModel] }).models[0] : null,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateModel(modelId: string, payload: unknown) {
    const task = validateAiModelPayload({ ...(payload as object), id: modelId });
    const saved = await mergeAiModel(this.deps.settingsPath, task, 'update');
    await this.publishSettings(saved);
    const savedModel = saved.models.find((item) => item.id === modelId);
    return {
      body: {
        success: true as const,
        model: savedModel ? redactAiSettings({ ...saved, models: [savedModel] }).models[0] : null,
        ai: redactAiSettings(saved),
      },
    };
  }

  async deleteModel(modelId: string) {
    const saved = await removeAiModel(this.deps.settingsPath, modelId);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        ai: redactAiSettings(saved),
      },
    };
  }

  async deleteProvider(providerKind: AiProviderKind) {
    const saved = await removeAiProvider(this.deps.settingsPath, providerKind);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        ai: redactAiSettings(saved),
      },
    };
  }

  async addProvider(providerKind: AiProviderKind, payload: unknown) {
    const task = validateAiProviderPayload({ ...(payload as object), provider: providerKind });
    const saved = await addAiProvider(this.deps.settingsPath, providerKind, task);
    await this.publishSettings(saved);
    const savedProvider = saved.providers.find((item) => item.provider === providerKind);
    return {
      statusCode: 201,
      body: {
        success: true as const,
        provider: savedProvider ? redactAiSettings({ ...saved, models: [], providers: [savedProvider] }).providers[0] : null,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateProvider(providerKind: AiProviderKind, payload: unknown) {
    const task = validateAiProviderPayload({ ...(payload as object), provider: providerKind });
    const saved = await mergeAiProvider(this.deps.settingsPath, providerKind, task);
    await this.publishSettings(saved);
    const savedProvider = saved.providers.find((item) => item.provider === providerKind);
    return {
      body: {
        success: true as const,
        provider: savedProvider ? redactAiSettings({ ...saved, models: [], providers: [savedProvider] }).providers[0] : null,
        ai: redactAiSettings(saved),
      },
    };
  }

  async testProvider(providerKind: AiProviderKind) {
    const provider = getAiProviderFromFile(this.deps.settingsPath, providerKind);
    if (!provider) {
      throw new AiValidationError(`Provider "${providerKind}" was not found.`);
    }

    const message = await aiManager.testProvider(providerKind);
    return {
      body: {
        success: true as const,
        message,
      },
    };
  }

  async testModel(modelId: string) {
    const entry = getAiModelFromFile(this.deps.settingsPath, modelId);
    if (!entry) {
      throw new AiValidationError(`Model "${modelId}" was not found.`);
    }

    const message = await aiManager.testModel(modelId);
    return {
      body: {
        success: true as const,
        message,
      },
    };
  }

  async listProviderRemoteModels(providerKind: AiProviderKind) {
    const provider = getAiProviderFromFile(this.deps.settingsPath, providerKind);
    if (!provider) {
      throw new AiValidationError(`Provider "${providerKind}" was not found.`);
    }

    const models = await aiManager.listRemoteModels(providerKind);
    return {
      body: {
        success: true as const,
        models,
      },
    };
  }

  listMcpServers() {
    const settings = this.readSettings();
    return {
      body: {
        success: true as const,
        mcpServers: listEffectivePublicMcpServers(settings.mcpServers),
      },
    };
  }

  async addMcpServer(payload: unknown) {
    const task = validateAiMcpServerPayload(payload);
    if (findPluginMcpServerOwner(task.id)) {
      throw new AiValidationError(`MCP server id "${task.id}" is reserved by an installed package.`);
    }
    const current = this.readSettings();
    return this.saveMcpServerWithPolicy(task, 'create', current.mcp?.stdioAllowlist ?? []);
  }

  async saveMcpServerWithPolicy(
    task: ReturnType<typeof validateAiMcpServerPayload>,
    mode: 'create' | 'update',
    stdioAllowlist: string[],
  ) {
    await validateMcpServerPolicyAtSave(task, stdioAllowlist);
    const saved = await mergeMcpServer(this.deps.settingsPath, task, mode);
    await this.publishSettings(saved);
    const savedServer = saved.mcpServers.find((item) => item.id === task.id);
    return {
      statusCode: mode === 'create' ? 201 : 200,
      body: {
        success: true as const,
        mcpServer: savedServer
          ? redactAiSettings({ ...saved, mcpServers: [savedServer] }).mcpServers[0]
          : null,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateMcpServer(serverId: string, payload: unknown) {
    if (findPluginMcpServerOwner(serverId)) {
      throw new AiValidationError(`MCP server "${serverId}" is managed by a package and cannot be edited.`);
    }
    const task = validateAiMcpServerPayload({ ...(payload as object), id: serverId });
    const current = this.readSettings();
    return this.saveMcpServerWithPolicy(task, 'update', current.mcp?.stdioAllowlist ?? []);
  }

  async deleteMcpServer(serverId: string) {
    if (findPluginMcpServerOwner(serverId)) {
      throw new AiValidationError(`MCP server "${serverId}" is managed by a package and cannot be deleted.`);
    }
    const saved = await removeMcpServer(this.deps.settingsPath, serverId);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        ai: redactAiSettings(saved),
      },
    };
  }

  async testMcpServer(serverId: string) {
    const settings = await hydrateAiSettingsSecrets(this.readSettings());
    const settingsServer = settings.mcpServers.find((item) => item.id === serverId);
    const pluginServer = listInstalledPluginMcpServers().find((item) => item.id === serverId);
    const server = settingsServer ?? pluginServer;
    if (!server) {
      throw new AiValidationError(`MCP server "${serverId}" was not found.`);
    }

    const result = await testMcpServerConnection(server);
    return {
      body: {
        success: true as const,
        message: result.message,
        toolCount: result.toolCount,
        toolNames: result.toolNames,
        latencyMs: result.latencyMs,
      },
    };
  }

  async updateWebSearchSettings(payload: unknown) {
    const task = validateAiWebSearchPayload(payload);
    const saved = await mergeWebSearchSettings(this.deps.settingsPath, task);
    await this.publishSettings(saved);
    const savedWebSearch = saved.webSearch;
    return {
      body: {
        success: true as const,
        webSearch: savedWebSearch
          ? redactAiSettings({ ...saved, webSearch: savedWebSearch }).webSearch
          : redactAiSettings(saved).webSearch,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateAgentSettings(payload: unknown) {
    const current = this.readSettings();
    const normalized = normalizeAiAgentSettings({ ...current.agent, ...(payload ?? {}) });
    const saved = await mergeAiAgentSettings(this.deps.settingsPath, normalized);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        agent: saved.agent,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateHttpSettings(payload: unknown) {
    const task = validateAiHttpPayload(payload);
    const saved = await mergeHttpSettings(this.deps.settingsPath, task);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        http: saved.http,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateInboundHostSettings(payload: unknown) {
    const current = this.readSettings();
    const task = validateAiInboundHostPayload(payload, current.mcp.inboundHost);
    const saved = await mergeInboundHostSettings(this.deps.settingsPath, task);
    await this.publishSettings(saved);
    const inboundHost = saved.mcp.inboundHost
      ? redactAiMcpInboundHostSettings(saved.mcp.inboundHost)
      : redactAiMcpInboundHostSettings({ enabled: false });
    return {
      body: {
        success: true as const,
        inboundHost,
        ai: redactAiSettings(saved),
      },
    };
  }

  async updateDefaultCapabilityPacks(payload: unknown) {
    const task = validateDefaultCapabilityPacksPayload(payload);
    const saved = await mergeDefaultCapabilityPackIds(this.deps.settingsPath, task.defaultCapabilityPackIds);
    await this.publishSettings(saved);
    return {
      body: {
        success: true as const,
        defaultCapabilityPackIds: saved.mcp.defaultCapabilityPackIds ?? [],
        ai: redactAiSettings(saved),
      },
    };
  }

  async replaceMcpResourceAccessControl(resourceId: string, payload: unknown) {
    const normalizedResourceId = resourceId.trim();
    if (!normalizedResourceId) {
      throw new AiValidationError('Resource id is required.');
    }

    const current = this.readSettings();
    const task = normalizeMcpResourceAccessControlPayload(payload);
    assertMcpResourceInCatalog(task.resourceKind, normalizedResourceId, current.mcpServers);
    const saved = await mergeMcpResourceAccessControl(
      this.deps.settingsPath,
      normalizedResourceId,
      task.accessControl,
    );
    await this.publishSettings(saved);

    return {
      body: {
        success: true as const,
        resourceKind: task.resourceKind,
        resourceId: normalizedResourceId,
      },
    };
  }
}

export { AiValidationError };
