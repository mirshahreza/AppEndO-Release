import type { AgentMode, AgentStreamEvent } from '../../shared/api/contracts/ai/agentTypes';
import type { AiAgentSettings, AiModelEntry, AiProviderKind, AiRemoteModelSummary, AiSettings } from '../../shared/api/contracts/ai/types';
import { DEFAULT_AI_CAPABILITIES, getAiProviderLabel, isAiModelChatCapable } from '../../shared/api/contracts/ai/constants';
import { resolveAiProviderConfig } from '../../shared/api/contracts/ai/validators';
import { LogLevel, LogMethod, logger } from '../logging/Logger';
import type { ChatMessage, IAiProvider } from './IAiProvider';
import { createProviderForModel, createProviderForSettingsModel } from './providers/providerFactory';
import { AgentOrchestrator } from './agent/AgentOrchestrator';
import { createOrchestrationPolicy } from './agent/orchestrationPolicy';
import type { AgentMessage, AgentRunConfig, AgentRunResult } from './agent/types';
import type { TurnExecutionProfile } from './agent/turnExecutionProfile';
import type { PreloadedRetrieveState } from './agent/retrieveBundle';
import { createPhase1ToolRegistry } from './tools/ToolRegistry';
import { registerNativeTools } from './tools/native/registerNativeTools';
import type { ToolRegistry } from './tools/ToolRegistry';
import type { AiPageContext } from '../../shared/api/contracts/ai/pageContext';
import type { AiChatContextResourceId } from '../../shared/api/contracts/ai/chatContextResources';
import type { AiCapabilityPackId } from '../../shared/api/contracts/ai/capabilityPacks';
import type { McpAccessContextSnapshot } from '../../shared/api/contracts/ai/mcpAccess';
import type { FunctionDocAccessPrincipal } from '../../shared/api/openapi/buildManagedFunctionOpenApi';

type RegisteredModel = {
  entry: AiModelEntry;
  provider: IAiProvider;
};

export class AiManager {
  private static instance: AiManager;
  private models = new Map<string, RegisteredModel>();
  private settings: AiSettings | null = null;
  private defaultSystemContext = 'You are AppEnd OS Assistant, an elite software architect and AI orchestrator. Provide concise, highly technical responses.';

  private constructor() {}

  public static getInstance(): AiManager {
    if (!AiManager.instance) {
      AiManager.instance = new AiManager();
    }
    return AiManager.instance;
  }

  @LogMethod({ id: 'AiManager.reloadFromSettings', minLevel: LogLevel.INFO })
  public reloadFromSettings(settings: AiSettings) {
    this.settings = settings;
    this.models.clear();

    settings.models.forEach((entry) => {
      if (!entry.enabled) return;

      const providerConfig = resolveAiProviderConfig(settings, entry.provider);
      if (entry.provider !== 'ollama' && !providerConfig?.apiKey?.trim()) return;

      try {
        const provider = createProviderForModel(entry, providerConfig);
        this.models.set(entry.id, { entry, provider });
        logger.info('AiManager', 'Registered AI model', {
          modelId: entry.id,
          provider: getAiProviderLabel(entry.provider, entry.providerLabel),
        });
      } catch (error) {
        logger.warn('AiManager', 'Skipped AI model registration', {
          modelId: entry.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  public getSettings(): AiSettings | null {
    return this.settings;
  }

  @LogMethod({ id: 'AiManager.resolveModel' })
  public resolveModel(modelId?: string): RegisteredModel {
    const settings = this.settings;
    if (!settings?.enabled) {
      throw new Error('AI is disabled in platform settings.');
    }

    const resolvedId = modelId?.trim() || settings.defaultModelId;
    const registered = this.models.get(resolvedId);
    if (!registered) {
      throw new Error(`AI model "${resolvedId}" is not configured or enabled.`);
    }
    return registered;
  }

  @LogMethod({ id: 'AiManager.processChat' })
  public async processChat(
    messages: ChatMessage[],
    modelId?: string,
    systemContext?: string,
  ): Promise<string> {
    const { entry, provider } = this.resolveModel(modelId);
    if (!isAiModelChatCapable(entry)) {
      throw new Error(
        `AI model "${entry.name}" (${entry.modelId}) does not support chat. Use a chat-capable model instead.`,
      );
    }
    return provider.chat(messages, systemContext ?? this.defaultSystemContext);
  }

  public canStreamModel(modelId?: string): boolean {
    try {
      const { entry, provider } = this.resolveModel(modelId);
      return Boolean(entry.capabilities.streaming && typeof provider.streamChat === 'function');
    } catch {
      return false;
    }
  }

  @LogMethod({ id: 'AiManager.processChatStream' })
  public async processChatStream(
    messages: ChatMessage[],
    modelId: string | undefined,
    onDelta: (delta: string) => void,
    systemContext?: string,
  ): Promise<{ text: string; modelId: string; streamed: boolean }> {
    const { entry, provider } = this.resolveModel(modelId);
    if (!isAiModelChatCapable(entry)) {
      throw new Error(
        `AI model "${entry.name}" (${entry.modelId}) does not support chat. Use a chat-capable model instead.`,
      );
    }

    const resolvedContext = systemContext ?? this.defaultSystemContext;
    if (entry.capabilities.streaming && typeof provider.streamChat === 'function') {
      const text = await provider.streamChat(messages, resolvedContext, onDelta);
      return { text, modelId: entry.id, streamed: true };
    }

    const text = await provider.chat(messages, resolvedContext);
    onDelta(text);
    return { text, modelId: entry.id, streamed: false };
  }

  @LogMethod({ id: 'AiManager.testModel' })
  public async testModel(modelId: string): Promise<string> {
    const settings = this.settings;
    const entry = settings?.models.find((model) => model.id === modelId);
    if (!entry || !settings) {
      throw new Error(`AI model "${modelId}" was not found.`);
    }

    const provider = createProviderForSettingsModel(settings, entry);
    if (provider.testConnection) {
      return provider.testConnection();
    }
    if (!isAiModelChatCapable(entry)) {
      return `Model "${entry.name}" is configured for ${entry.capabilities.imageGeneration ? 'image generation' : 'specialized use'} and does not support chat tests.`;
    }
    return provider.chat([{ role: 'user', content: 'ping' }]);
  }

  @LogMethod({ id: 'AiManager.testProvider' })
  public async testProvider(providerKind: AiModelEntry['provider']): Promise<string> {
    const settings = this.settings;
    if (!settings) {
      throw new Error('AI settings are not loaded.');
    }

    const candidate = settings.models.find((model) => model.provider === providerKind);
    if (!candidate) {
      throw new Error(`No model is configured for provider "${providerKind}".`);
    }

    return this.testModel(candidate.id);
  }

  @LogMethod({ id: 'AiManager.listRemoteModels' })
  public async listRemoteModels(providerKind: AiProviderKind): Promise<AiRemoteModelSummary[]> {
    const settings = this.settings;
    if (!settings) {
      throw new Error('AI settings are not loaded.');
    }

    const providerConfig = resolveAiProviderConfig(settings, providerKind);
    if (!providerConfig) {
      throw new Error(`Provider "${providerKind}" was not found.`);
    }

    const probeEntry: AiModelEntry = {
      id: `__remote-models-probe-${providerKind}`,
      name: 'Remote model probe',
      provider: providerKind,
      providerLabel: providerConfig.providerLabel,
      modelId: 'probe',
      enabled: false,
      capabilities: { ...DEFAULT_AI_CAPABILITIES },
    };

    const provider = createProviderForModel(probeEntry, providerConfig);
    if (!provider.listRemoteModels) {
      throw new Error(`Provider "${providerKind}" does not support listing remote models.`);
    }

    return provider.listRemoteModels();
  }

  public isModelToolsCapable(modelId?: string): boolean {
    try {
      const { entry, provider } = this.resolveModel(modelId);
      return Boolean(entry.capabilities.tools && typeof provider.chatWithTools === 'function');
    } catch {
      return false;
    }
  }

  @LogMethod({ id: 'AiManager.processAgentRun' })
  public async processAgentRun(input: {
    messages: AgentMessage[];
    mode: AgentMode;
    modelId?: string;
    pageContext?: AiPageContext;
    contextResources?: AiChatContextResourceId[];
    enabledMcpServerIds?: string[];
    enabledCapabilityPackIds?: readonly AiCapabilityPackId[];
    persistedHistorySummary?: string;
    planDocumentPath?: string;
    planDocumentContent?: string;
    docAccessPrincipal?: FunctionDocAccessPrincipal;
    mcpAccessContext?: McpAccessContextSnapshot;
    pageContextPreload?: string;
    preloadedRetrieve?: PreloadedRetrieveState;
    executionProfile: TurnExecutionProfile;
    useEngineeringPipeline?: boolean;
    prepareRegistry?: (registry: ToolRegistry) => Promise<void>;
    onEvent?: (event: AgentStreamEvent) => void;
    /**
     * V5 Phase P11 § V5-21 — a stable pair lets `AgentOrchestrator.run()` resume/reconcile a
     * prior attempt's event log (P09 § V5-13) instead of starting a fresh random one. Only the
     * background job executor (`agentTaskJobExecutor.ts`) passes these today; the ordinary
     * synchronous chat path (`AgentRuntime.ts`) still omits them, unchanged.
     */
    taskId?: string;
    attemptId?: string;
  }): Promise<AgentRunResult> {
    const settings = this.settings;
    if (!settings?.enabled) {
      throw new Error('AI is disabled in platform settings.');
    }

    const { entry, provider } = this.resolveModel(input.modelId);
    if (!isAiModelChatCapable(entry)) {
      throw new Error(
        `AI model "${entry.name}" (${entry.modelId}) does not support chat. Use a chat-capable model instead.`,
      );
    }
    if (!entry.capabilities.tools || typeof provider.chatWithTools !== 'function') {
      throw new Error(
        `AI model "${entry.name}" does not support tool calling. Enable a model with tools capability.`,
      );
    }

    const agentSettings: AiAgentSettings = settings.agent;
    const toolRegistry = createPhase1ToolRegistry(
      input.mode,
      agentSettings.allowedNativeToolGroups,
      input.executionProfile,
    );
    registerNativeTools(toolRegistry);
    if (input.prepareRegistry) {
      await input.prepareRegistry(toolRegistry);
    }

    const config: AgentRunConfig = {
      mode: input.mode,
      agentSettings,
      pageContext: input.pageContext,
      contextResources: input.contextResources,
      contextWorkingTurns: agentSettings.contextWorkingTurns,
      maxTokensPerRun: agentSettings.maxTokensPerRun,
      planDocumentPath: input.planDocumentPath,
      planDocumentContent: input.planDocumentContent,
      docAccessPrincipal: input.docAccessPrincipal,
      mcpAccessContext: input.mcpAccessContext,
      enabledCapabilityPackIds: input.enabledCapabilityPackIds,
      persistedHistorySummary: input.persistedHistorySummary,
      pageContextPreload: input.pageContextPreload,
      preloadedRetrieve: input.preloadedRetrieve,
      executionProfile: input.executionProfile,
      useEngineeringPipeline: input.useEngineeringPipeline,
      taskId: input.taskId,
      attemptId: input.attemptId,
    };

    const orchestrator = new AgentOrchestrator({
      provider,
      modelId: entry.id,
      toolRegistry,
      policy: createOrchestrationPolicy(agentSettings.orchestrationPolicy ?? 'react'),
    });

    const result = await orchestrator.run(input.messages, config, {
      onEvent: input.onEvent,
    });

    return result;
  }
}

export const aiManager = AiManager.getInstance();
