import type { ChatMessage, ChatWithToolsMessage, ChatWithToolsResult, IAiProvider, ToolDefinition } from '../IAiProvider';
import {
  buildImageGenerationPrompt,
  extractResponsesOutputText,
  formatGeneratedImageContent,
  isMaxTokensUnsupportedError,
  isOpenAiResponsesOnlyError,
  isUnsupportedTemperatureError,
  requiresOpenAiImagesApi,
  requiresOpenAiResponsesApi,
  type OpenAiImagesGenerationsPayload,
  type OpenAiResponsesPayload,
} from './openAiModelRouting';
import { fetchWithTimeout, mergeRequestParams, readResponseError, type ProviderRuntimeConfig } from './providerUtils';
import type { AiRemoteModelSummary } from '../../../shared/api/contracts/ai/types';

type OpenAiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const toOpenAiMessages = (
  messages: ChatMessage[],
  systemContext?: string,
): OpenAiMessage[] => {
  const mapped = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
    } satisfies OpenAiMessage));

  if (systemContext?.trim()) {
    return [{ role: 'system', content: systemContext.trim() }, ...mapped];
  }

  return mapped;
};

export class OpenAiProvider implements IAiProvider {
  constructor(protected readonly config: ProviderRuntimeConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error('OpenAI provider requires apiKey.');
    }
  }

  getProviderName(): string {
    return this.config.displayName;
  }

  protected getBaseUrl(): string {
    return (this.config.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  /** Last-touch hook for subclasses (e.g. OpenRouter routing/caching) before a completions POST. */
  protected finalizeCompletionBody(body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey?.trim()}`,
      'Content-Type': 'application/json',
    };
    if (this.config.organizationId?.trim()) {
      headers['OpenAI-Organization'] = this.config.organizationId.trim();
    }
    return headers;
  }

  private async generateViaImagesApi(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const prompt = buildImageGenerationPrompt(messages, systemContext);
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/images/generations`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.modelId,
          prompt,
          n: 1,
          size: '1024x1024',
        }),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as OpenAiImagesGenerationsPayload;
    const image = data.data?.[0];
    if (!image) {
      throw new Error('Image generation returned no image data.');
    }

    return formatGeneratedImageContent(image);
  }

  private async chatViaResponses(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const instructionParts = [
      systemContext?.trim(),
      ...messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content.trim())
        .filter(Boolean),
    ].filter(Boolean);

    const conversationMessages = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'user' ? 'user' as const : 'assistant' as const,
        content: message.content,
      }));

    const input = conversationMessages.length === 1 && conversationMessages[0]?.role === 'user'
      ? conversationMessages[0].content
      : conversationMessages;

    const body = mergeRequestParams({
      model: this.config.modelId,
      input,
      ...(instructionParts.length > 0 ? { instructions: instructionParts.join('\n\n') } : {}),
    }, this.config.requestParams);

    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/responses`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      },
      this.config.timeoutMs ?? 60000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as OpenAiResponsesPayload;
    return extractResponsesOutputText(data);
  }

  private buildCompletionBody(
    messages: OpenAiMessage[],
    extra?: Record<string, unknown>,
  ): Record<string, unknown> {
    return mergeRequestParams({
      model: this.config.modelId,
      messages,
      ...extra,
    }, this.config.requestParams);
  }

  private async postChatCompletions(
    body: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<Response> {
    return fetchWithTimeout(
      `${this.getBaseUrl()}/chat/completions`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.finalizeCompletionBody(body)),
      },
      timeoutMs ?? this.config.timeoutMs ?? 60000,
    );
  }

  private async chatViaCompletions(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const openAiMessages = toOpenAiMessages(messages, systemContext);
    let body = this.buildCompletionBody(openAiMessages);
    let response = await this.postChatCompletions(body);

    if (!response.ok) {
      let errorMessage = await readResponseError(response);
      if (isMaxTokensUnsupportedError(errorMessage) && 'max_tokens' in body) {
        const { max_tokens: maxTokens, ...rest } = body;
        body = {
          ...rest,
          max_completion_tokens: typeof maxTokens === 'number' ? maxTokens : 8_192,
        };
        response = await this.postChatCompletions(body);
        if (!response.ok) {
          errorMessage = await readResponseError(response);
        }
      }

      if (!response.ok && isUnsupportedTemperatureError(errorMessage) && 'temperature' in body) {
        const { temperature: _temperature, ...rest } = body;
        body = rest;
        response = await this.postChatCompletions(body);
        if (!response.ok) {
          throw new Error(await readResponseError(response));
        }
      } else if (!response.ok) {
        throw new Error(errorMessage);
      }
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  private async streamViaCompletions(
    messages: ChatMessage[],
    systemContext: string | undefined,
    onDelta: (delta: string) => void,
  ): Promise<string> {
    let body = this.buildCompletionBody(
      toOpenAiMessages(messages, systemContext),
      { stream: true },
    );
    let response = await this.postChatCompletions(body);

    if (!response.ok) {
      let errorMessage = await readResponseError(response);
      if (isUnsupportedTemperatureError(errorMessage) && 'temperature' in body) {
        const { temperature: _temperature, ...rest } = body;
        body = rest;
        response = await this.postChatCompletions(body);
        if (!response.ok) {
          throw new Error(await readResponseError(response));
        }
      } else {
        throw new Error(errorMessage);
      }
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('OpenAI stream response is not readable.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onDelta(delta);
          }
        } catch {
          // Ignore malformed stream chunks.
        }
      }
    }

    return fullText.trim();
  }

  async streamChat(
    messages: ChatMessage[],
    systemContext: string | undefined,
    onDelta: (delta: string) => void,
  ): Promise<string> {
    if (requiresOpenAiImagesApi(this.config.modelId) || requiresOpenAiResponsesApi(this.config.modelId)) {
      const text = await this.chat(messages, systemContext);
      onDelta(text);
      return text;
    }

    try {
      return await this.streamViaCompletions(messages, systemContext, onDelta);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isOpenAiResponsesOnlyError(message)) {
        throw error;
      }
      const text = await this.chatViaResponses(messages, systemContext);
      onDelta(text);
      return text;
    }
  }

  async chat(messages: ChatMessage[], systemContext?: string): Promise<string> {
    if (requiresOpenAiImagesApi(this.config.modelId)) {
      return this.generateViaImagesApi(messages, systemContext);
    }

    if (requiresOpenAiResponsesApi(this.config.modelId)) {
      return this.chatViaResponses(messages, systemContext);
    }

    try {
      return await this.chatViaCompletions(messages, systemContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isOpenAiResponsesOnlyError(message)) {
        throw error;
      }
      return this.chatViaResponses(messages, systemContext);
    }
  }

  async listRemoteModels(): Promise<AiRemoteModelSummary[]> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/models`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      this.config.timeoutMs ?? 30000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as { data?: unknown };
    const list = Array.isArray(data.data) ? data.data : [];

    return list
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => {
        const pricing = item.pricing && typeof item.pricing === 'object'
          ? item.pricing as Record<string, unknown>
          : undefined;
        return {
          id: String(item.id ?? '').trim(),
          name: typeof item.name === 'string' ? item.name : undefined,
          description: typeof item.description === 'string' ? item.description : undefined,
          contextLength: typeof item.context_length === 'number' ? item.context_length : undefined,
          pricingPrompt: typeof pricing?.prompt === 'string' ? pricing.prompt : undefined,
          pricingCompletion: typeof pricing?.completion === 'string' ? pricing.completion : undefined,
        } satisfies AiRemoteModelSummary;
      })
      .filter((item) => item.id.length > 0);
  }

  async testConnection(): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/models`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      this.config.timeoutMs ?? 60000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return 'Connection successful.';
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/embeddings`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.modelId,
          input: texts,
        }),
      },
      this.config.timeoutMs ?? 60000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as {
      data?: Array<{ index?: number; embedding?: number[] }>;
    };
    const rows = data.data ?? [];
    if (rows.length !== texts.length) {
      throw new Error(`Embeddings API returned ${rows.length} vectors for ${texts.length} inputs.`);
    }
    // The API is allowed to return rows out of order — index is authoritative.
    const vectors: number[][] = new Array(texts.length);
    rows.forEach((row, position) => {
      const index = typeof row.index === 'number' ? row.index : position;
      vectors[index] = row.embedding ?? [];
    });
    return vectors;
  }

  private buildToolCallCompletionBody(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Record<string, unknown> {
    type OpenAiToolMessage = {
      role: 'system' | 'user' | 'assistant' | 'tool';
      content?: string;
      tool_call_id?: string;
      name?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };

    const ensureNonEmptyContent = (value: string | undefined): string => (
      value?.trim() ? value : ' '
    );

    const mapped: OpenAiToolMessage[] = [];
    if (systemContext?.trim()) {
      mapped.push({ role: 'system', content: systemContext.trim() });
    }

    messages.forEach((message) => {
      if (message.role === 'system') return;
      if (message.role === 'tool') {
        mapped.push({
          role: 'tool',
          tool_call_id: message.toolCallId,
          name: message.name,
          content: ensureNonEmptyContent(message.content),
        });
        return;
      }
      if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls?.length) {
        const content = message.content?.trim() ? message.content : undefined;
        mapped.push({
          role: 'assistant',
          ...(content !== undefined ? { content } : {}),
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.args ?? {}),
            },
          })),
        });
        return;
      }
      mapped.push({
        role: message.role,
        content: ensureNonEmptyContent(message.content),
      });
    });

    return mergeRequestParams({
      model: this.config.modelId,
      messages: mapped,
      tools: tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: 'auto',
    }, this.config.requestParams);
  }

  async chatWithTools(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult> {
    if (requiresOpenAiImagesApi(this.config.modelId) || requiresOpenAiResponsesApi(this.config.modelId)) {
      const text = await this.chat(messages.filter((message) => message.role !== 'tool') as ChatMessage[], systemContext);
      return { text };
    }

    // p-63 F-2 — agent tool-call generations routinely exceed the generic 60 s default.
    const response = await this.postChatCompletions(
      this.buildToolCallCompletionBody(messages, tools, systemContext),
      this.config.timeoutMs ?? 300_000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
    const toolCalls = message?.tool_calls?.map((call) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }
      return {
        id: call.id,
        name: call.function.name,
        args,
      };
    });

    return {
      text: message?.content?.trim() || undefined,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
    };
  }

  async chatWithToolsStream(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext: string | undefined,
    onTextDelta: (delta: string) => void,
  ): Promise<ChatWithToolsResult> {
    if (requiresOpenAiImagesApi(this.config.modelId) || requiresOpenAiResponsesApi(this.config.modelId)) {
      const result = await this.chatWithTools(messages, tools, systemContext);
      if (result.text) onTextDelta(result.text);
      return result;
    }

    const body = { ...this.buildToolCallCompletionBody(messages, tools, systemContext), stream: true };
    const response = await this.postChatCompletions(body, this.config.timeoutMs ?? 300_000);

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('OpenAI stream response is not readable.');
    }

    type StreamToolCall = { id: string; name: string; argumentsJson: string };
    const toolCallsByIndex = new Map<number, StreamToolCall>();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: {
                content?: string | null;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            onTextDelta(delta.content);
          }

          delta.tool_calls?.forEach((chunk) => {
            const index = chunk.index ?? 0;
            const existing = toolCallsByIndex.get(index) ?? { id: '', name: '', argumentsJson: '' };
            if (chunk.id) existing.id = chunk.id;
            if (chunk.function?.name) existing.name = chunk.function.name;
            if (chunk.function?.arguments) existing.argumentsJson += chunk.function.arguments;
            toolCallsByIndex.set(index, existing);
          });
        } catch {
          // Ignore malformed stream chunks.
        }
      }
    }

    const toolCalls = [...toolCallsByIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => {
        let args: Record<string, unknown> = {};
        try {
          args = call.argumentsJson ? JSON.parse(call.argumentsJson) as Record<string, unknown> : {};
        } catch {
          args = {};
        }
        return {
          id: call.id || `call-${index + 1}`,
          name: call.name || 'unknown',
          args,
        };
      });

    return {
      text: fullText.trim() || undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }
}
