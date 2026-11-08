import type {
  ChatMessage,
  ChatWithToolsMessage,
  ChatWithToolsResult,
  IAiProvider,
  ToolDefinition,
} from '../IAiProvider';
import { fetchWithTimeout, mergeRequestParams, readResponseError, type ProviderRuntimeConfig } from './providerUtils';

type OllamaToolCall = { function: { name: string; arguments: Record<string, unknown> | string } };
type OllamaChatMessage = {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

function toOllamaArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof args !== 'string') return args ?? {};
  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapMessagesForOllama(messages: ChatWithToolsMessage[], systemContext?: string): OllamaChatMessage[] {
  const mapped: OllamaChatMessage[] = [];
  if (systemContext?.trim()) {
    mapped.push({ role: 'system', content: systemContext.trim() });
  }

  messages.forEach((message) => {
    if (message.role === 'system') return;
    if (message.role === 'tool') {
      mapped.push({ role: 'tool', content: message.content, tool_name: message.name });
      return;
    }
    if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls?.length) {
      mapped.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: call.args ?? {} },
        })),
      });
      return;
    }
    mapped.push({ role: message.role, content: message.content });
  });

  return mapped;
}

function mapToolsForOllama(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function extractToolCalls(toolCalls: OllamaToolCall[] | undefined): ChatWithToolsResult['toolCalls'] {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((call, index) => ({
    id: `call-${index + 1}`,
    name: call.function.name,
    args: toOllamaArgs(call.function.arguments),
  }));
}

export class OllamaProvider implements IAiProvider {
  constructor(private readonly config: ProviderRuntimeConfig) {}

  getProviderName(): string {
    return this.config.displayName;
  }

  private getBaseUrl(): string {
    return (this.config.baseUrl?.trim() || 'http://localhost:11434').replace(/\/$/, '');
  }

  async chat(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergeRequestParams({
          model: this.config.modelId,
          stream: false,
          messages: [
            ...(systemContext?.trim()
              ? [{ role: 'system', content: systemContext.trim() }]
              : []),
            ...messages
              .filter((message) => message.role !== 'system')
              .map((message) => ({
                role: message.role,
                content: message.content,
              })),
          ],
        }, this.config.requestParams)),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content?.trim() || '';
  }

  async streamChat(
    messages: ChatMessage[],
    systemContext: string | undefined,
    onDelta: (delta: string) => void,
  ): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergeRequestParams({
          model: this.config.modelId,
          stream: true,
          messages: [
            ...(systemContext?.trim()
              ? [{ role: 'system', content: systemContext.trim() }]
              : []),
            ...messages
              .filter((message) => message.role !== 'system')
              .map((message) => ({
                role: message.role,
                content: message.content,
              })),
          ],
        }, this.config.requestParams)),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Ollama stream response is not readable.');
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
        if (!trimmed) continue;
        try {
          const payload = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
          const delta = payload.message?.content || '';
          if (delta) {
            fullText += delta;
            onDelta(delta);
          }
        } catch {
          // Ignore malformed stream lines.
        }
      }
    }

    return fullText.trim();
  }

  async chatWithTools(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergeRequestParams({
          model: this.config.modelId,
          stream: false,
          messages: mapMessagesForOllama(messages, systemContext),
          tools: mapToolsForOllama(tools),
        }, this.config.requestParams)),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as { message?: { content?: string; tool_calls?: OllamaToolCall[] } };
    return {
      text: data.message?.content?.trim() || undefined,
      toolCalls: extractToolCalls(data.message?.tool_calls),
    };
  }

  async chatWithToolsStream(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext: string | undefined,
    onTextDelta: (delta: string) => void,
  ): Promise<ChatWithToolsResult> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergeRequestParams({
          model: this.config.modelId,
          stream: true,
          messages: mapMessagesForOllama(messages, systemContext),
          tools: mapToolsForOllama(tools),
        }, this.config.requestParams)),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Ollama stream response is not readable.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let toolCalls: OllamaToolCall[] | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const payload = JSON.parse(trimmed) as { message?: { content?: string; tool_calls?: OllamaToolCall[] } };
          const delta = payload.message?.content || '';
          if (delta) {
            fullText += delta;
            onTextDelta(delta);
          }
          if (payload.message?.tool_calls?.length) {
            toolCalls = payload.message.tool_calls;
          }
        } catch {
          // Ignore malformed stream lines.
        }
      }
    }

    return {
      text: fullText.trim() || undefined,
      toolCalls: extractToolCalls(toolCalls),
    };
  }

  async testConnection(): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/tags`,
      { method: 'GET' },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return 'Connection successful.';
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await fetchWithTimeout(
      `${this.getBaseUrl()}/api/embed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.modelId,
          input: texts,
        }),
      },
      this.config.timeoutMs ?? 120000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as { embeddings?: number[][] };
    const vectors = data.embeddings ?? [];
    if (vectors.length !== texts.length) {
      throw new Error(`Ollama embed returned ${vectors.length} vectors for ${texts.length} inputs.`);
    }
    return vectors;
  }
}
