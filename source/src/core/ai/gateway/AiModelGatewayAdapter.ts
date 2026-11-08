import { z } from 'zod';
import type { ChatMessage, ChatWithToolsMessage, IAiProvider, ToolDefinition } from '../IAiProvider';
import { aiManager } from '../AiManager';
import type {
  AiTaskProfile,
  EffectiveModelCapabilities,
  ModelGatewayStructuredResult,
  ModelGatewayTelemetryRecord,
  ModelGatewayToolSessionResult,
} from '../../../shared/api/contracts/ai/appendooGateway.types';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import {
  estimateTokenCount,
  getTaskProfilePolicy,
  validateTaskProfileCapabilities,
} from '../../../shared/lib/appendoo/modelGatewayPolicy';
import { getPromptTemplateForTaskProfile, renderPromptTemplate } from '../../../shared/lib/appendoo/promptRuntimeScaffold';
import { recordModelGatewayTelemetry } from '../../../shared/lib/appendoo/modelGatewayTelemetry';

export type ModelGatewayTextRequest = {
  messages: ChatMessage[];
  modelId?: string;
  systemContext?: string;
  taskProfile: AiTaskProfile;
  correlationId?: string;
};

export type ModelGatewayStructuredRequest<T> = {
  messages: ChatMessage[];
  modelId?: string;
  systemContext?: string;
  taskProfile: AiTaskProfile;
  schema: z.ZodType<T>;
  correlationId?: string;
  maxAttempts?: number;
  untrustedContext?: string;
};

export type ModelGatewayEstimateRequest = {
  messages: Array<Pick<ChatMessage, 'content'>>;
  modelId?: string;
  taskProfile: AiTaskProfile;
  expectedOutputChars?: number;
};

export type ModelGatewayToolSessionRequest = {
  messages: ChatWithToolsMessage[];
  tools: ToolDefinition[];
  modelId?: string;
  systemContext?: string;
  taskProfile: AiTaskProfile;
  correlationId?: string;
};

/**
 * Provider-neutral gateway facade (AE-2).
 * Delegates to AiManager today; domain services MUST use this instead of provider SDKs.
 */
export class AiModelGatewayAdapter {
  getEffectiveCapabilities(modelId?: string): EffectiveModelCapabilities {
    const { entry, provider } = aiManager.resolveModel(modelId);
    const declaredTools = Boolean(entry.capabilities.tools);
    const effectiveTools = declaredTools && typeof provider.chatWithTools === 'function';
    const declaredStreaming = Boolean(entry.capabilities.streaming);
    const effectiveStreaming = declaredStreaming && typeof provider.streamChat === 'function';

    return {
      modelId: entry.id,
      declaredChat: isAiModelChatCapable(entry),
      declaredStreaming,
      declaredTools,
      effectiveTools,
      effectiveStreaming,
    };
  }

  validateForTaskProfile(taskProfile: AiTaskProfile, modelId?: string): { ok: true } | { ok: false; errors: string[] } {
    const capabilities = this.getEffectiveCapabilities(modelId);
    return validateTaskProfileCapabilities(taskProfile, capabilities);
  }

  private buildTelemetryRecord(input: {
    correlationId?: string;
    taskProfile: AiTaskProfile;
    modelId: string;
    provider?: string;
    invokeKind: ModelGatewayTelemetryRecord['invokeKind'];
    latencyMs: number;
    attemptCount: number;
    inputTokenEstimate?: number;
    outputTokenEstimate?: number;
    validationErrors?: string[];
    retryReason?: string;
    toolCallCount?: number;
    promptTemplateId?: string;
    templateVersion?: string;
  }, promptSnippet?: string): ModelGatewayTelemetryRecord {
    return recordModelGatewayTelemetry({
      correlationId: input.correlationId,
      taskProfile: input.taskProfile,
      modelId: input.modelId,
      provider: input.provider,
      invokeKind: input.invokeKind,
      promptTemplateId: input.promptTemplateId,
      templateVersion: input.templateVersion,
      latencyMs: input.latencyMs,
      attemptCount: input.attemptCount,
      inputTokenEstimate: input.inputTokenEstimate,
      outputTokenEstimate: input.outputTokenEstimate,
      validationErrors: input.validationErrors,
      retryReason: input.retryReason,
      toolCallCount: input.toolCallCount,
    }, promptSnippet);
  }

  private resolveSystemContext(
    taskProfile: AiTaskProfile,
    messages: Array<Pick<ChatMessage, 'content'>>,
    systemContext?: string,
  ): string | undefined {
    if (systemContext) {
      return systemContext;
    }

    const template = getPromptTemplateForTaskProfile(taskProfile);
    if (!template) {
      return undefined;
    }

    return renderPromptTemplate({
      template,
      userPrompt: messages.at(-1)?.content ?? '',
    });
  }

  estimateRequest(request: ModelGatewayEstimateRequest): {
    modelId: string;
    taskProfile: AiTaskProfile;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  } {
    const capabilities = this.getEffectiveCapabilities(request.modelId);
    const inputText = request.messages.map((message) => message.content).join('\n');
    const template = getPromptTemplateForTaskProfile(request.taskProfile);
    const templateOverhead = template?.systemPolicyFragment.length ?? 0;

    return {
      modelId: capabilities.modelId,
      taskProfile: request.taskProfile,
      estimatedInputTokens: estimateTokenCount(`${inputText}\n${templateOverhead}`),
      estimatedOutputTokens: estimateTokenCount('x'.repeat(request.expectedOutputChars ?? 512)),
    };
  }

  async invokeText(request: ModelGatewayTextRequest): Promise<string> {
    const started = Date.now();
    const validation = this.validateForTaskProfile(request.taskProfile, request.modelId);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }

    const template = getPromptTemplateForTaskProfile(request.taskProfile);
    const systemContext = this.resolveSystemContext(
      request.taskProfile,
      request.messages,
      request.systemContext,
    );

    const text = await aiManager.processChat(
      request.messages,
      request.modelId,
      systemContext,
    );

    const { entry, provider } = this.resolveProvider(request.modelId);
    const estimate = this.estimateRequest({
      messages: request.messages,
      modelId: request.modelId,
      taskProfile: request.taskProfile,
      expectedOutputChars: text.length,
    });

    this.buildTelemetryRecord({
      correlationId: request.correlationId,
      taskProfile: request.taskProfile,
      modelId: entry.id,
      provider: provider.getProviderName(),
      invokeKind: 'text',
      latencyMs: Date.now() - started,
      attemptCount: 1,
      inputTokenEstimate: estimate.estimatedInputTokens,
      outputTokenEstimate: estimate.estimatedOutputTokens,
      promptTemplateId: template?.templateId,
      templateVersion: template?.version,
    }, systemContext);

    return text;
  }

  async invokeStructured<T>(request: ModelGatewayStructuredRequest<T>): Promise<ModelGatewayStructuredResult<T>> {
    const started = Date.now();
    const policy = getTaskProfilePolicy(request.taskProfile);
    const capabilities = this.getEffectiveCapabilities(request.modelId);
    const capabilityValidation = validateTaskProfileCapabilities(request.taskProfile, capabilities);
    if (!capabilityValidation.ok) {
      throw new Error(capabilityValidation.errors.join(' '));
    }

    const maxAttempts = request.maxAttempts ?? policy.maxAttempts;
    let lastValidationErrors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const repairHint = lastValidationErrors.length > 0
        ? `\n\nFix schema validation errors:\n${lastValidationErrors.join('\n')}`
        : '';
      const messages: ChatMessage[] = [
        ...request.messages.slice(0, -1),
        {
          ...request.messages.at(-1)!,
          content: `${request.messages.at(-1)?.content ?? ''}${repairHint}\n\nRespond with JSON only.`,
        },
      ];

      const text = await this.invokeText({
        messages,
        modelId: request.modelId,
        systemContext: request.systemContext,
        taskProfile: request.taskProfile,
        correlationId: request.correlationId,
      });

      try {
        const parsed = JSON.parse(text) as unknown;
        const validated = request.schema.safeParse(parsed);
        if (validated.success) {
          const estimate = this.estimateRequest({
            messages: request.messages,
            modelId: request.modelId,
            taskProfile: request.taskProfile,
            expectedOutputChars: text.length,
          });

          const telemetry = this.buildTelemetryRecord({
            correlationId: request.correlationId,
            taskProfile: request.taskProfile,
            modelId: capabilities.modelId,
            provider: this.resolveProvider(request.modelId).provider.getProviderName(),
            invokeKind: 'structured',
            latencyMs: Date.now() - started,
            attemptCount: attempt,
            inputTokenEstimate: estimate.estimatedInputTokens,
            outputTokenEstimate: estimate.estimatedOutputTokens,
            promptTemplateId: getPromptTemplateForTaskProfile(request.taskProfile)?.templateId,
            templateVersion: getPromptTemplateForTaskProfile(request.taskProfile)?.version,
          }, request.systemContext);

          return { data: validated.data, telemetry };
        }

        lastValidationErrors = validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      } catch {
        lastValidationErrors = ['Response was not valid JSON.'];
      }
    }

    throw new Error(
      `Structured output failed after ${maxAttempts} attempts: ${lastValidationErrors.join('; ')}`,
    );
  }

  async invokeToolSession(request: ModelGatewayToolSessionRequest): Promise<ModelGatewayToolSessionResult> {
    const started = Date.now();
    const validation = this.validateForTaskProfile(request.taskProfile, request.modelId);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }

    const { entry, provider } = this.resolveProvider(request.modelId);
    if (!provider.chatWithTools) {
      throw new Error(`Model ${entry.id} does not support tool sessions.`);
    }

    const template = getPromptTemplateForTaskProfile(request.taskProfile);
    const systemContext = this.resolveSystemContext(
      request.taskProfile,
      request.messages,
      request.systemContext,
    );

    const result = await provider.chatWithTools(
      request.messages,
      request.tools,
      systemContext,
    );

    const chatMessages = request.messages
      .filter((message): message is ChatMessage => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
      .map((message) => ({ content: message.content }));

    const estimate = this.estimateRequest({
      messages: chatMessages,
      modelId: request.modelId,
      taskProfile: request.taskProfile,
      expectedOutputChars: result.text?.length ?? 256,
    });

    const telemetry = this.buildTelemetryRecord({
      correlationId: request.correlationId,
      taskProfile: request.taskProfile,
      modelId: entry.id,
      provider: provider.getProviderName(),
      invokeKind: 'tool_session',
      latencyMs: Date.now() - started,
      attemptCount: 1,
      inputTokenEstimate: estimate.estimatedInputTokens,
      outputTokenEstimate: estimate.estimatedOutputTokens,
      toolCallCount: result.toolCalls?.length ?? 0,
      promptTemplateId: template?.templateId,
      templateVersion: template?.version,
    }, systemContext);

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      telemetry,
    };
  }

  /** Exposed for orchestrator compatibility during AE-2 migration. */
  resolveProvider(modelId?: string): { entry: { id: string; name: string }; provider: IAiProvider } {
    const { entry, provider } = aiManager.resolveModel(modelId);
    return { entry, provider };
  }
}

export const aiModelGateway = new AiModelGatewayAdapter();
