import type { ChatMessage, ChatWithToolsMessage, ChatWithToolsResult, IAiProvider, ToolDefinition } from '../IAiProvider';
import { computeCacheBreakpointIndexes } from './promptCacheBreakpoints';
import { fetchWithTimeout, mergeRequestParams, readResponseError, type ProviderRuntimeConfig } from './providerUtils';

/**
 * p-63 F-1 — was a hardcoded 1,024, which truncated every draft_* tool call mid-JSON
 * (tool args carry entire source files in this architecture). Model-entry
 * `maxOutputTokens`/`requestParams.max_tokens` still override via mergeRequestParams.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;
/** p-63 F-2 — agent tool-call generations routinely exceed the old 60 s default. */
const TOOL_CALL_TIMEOUT_MS = 300_000;
/** Anthropic allows at most 4 cache_control breakpoints per request; 1 is spent on system. */
const MAX_MESSAGE_CACHE_BREAKPOINTS = 3;

type CacheControl = { type: 'ephemeral' };
const EPHEMERAL: CacheControl = { type: 'ephemeral' };

export class AnthropicProvider implements IAiProvider {
  constructor(private readonly config: ProviderRuntimeConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error('Anthropic provider requires apiKey.');
    }
  }

  getProviderName(): string {
    return this.config.displayName;
  }

  private getBaseUrl(): string {
    return (this.config.baseUrl?.trim() || 'https://api.anthropic.com').replace(/\/$/, '');
  }

  private getMessagesUrl(): string {
    return `${this.getBaseUrl()}/v1/messages`;
  }

  async chat(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const response = await fetchWithTimeout(
      this.getMessagesUrl(),
      {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey?.trim() || '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mergeRequestParams({
          model: this.config.modelId,
          max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
          system: systemContext?.trim() || undefined,
          messages: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'user' ? 'user' : 'assistant',
              content: message.content,
            })),
        }, this.config.requestParams)),
      },
      this.config.timeoutMs ?? 60000,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return data.content?.map((block) => block.text || '').join('').trim() || '';
  }

  async testConnection(): Promise<string> {
    await this.chat([{ role: 'user', content: 'ping' }], undefined);
    return 'Connection successful.';
  }

  private buildToolCallBody(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Record<string, unknown> {
    type AnthropicContentBlock =
      | { type: 'text'; text: string; cache_control?: CacheControl }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown>; cache_control?: CacheControl }
      | { type: 'tool_result'; tool_use_id: string; content: string; cache_control?: CacheControl };

    type AnthropicMessage = {
      role: 'user' | 'assistant';
      content: AnthropicContentBlock[];
    };

    // Rolling breakpoints keep the growing agent-loop prefix cache-hot across iterations;
    // the system breakpoint below also covers the tool definitions rendered before it.
    const breakpointIndexes = computeCacheBreakpointIndexes(messages, MAX_MESSAGE_CACHE_BREAKPOINTS);
    const mapped: AnthropicMessage[] = [];

    messages.forEach((message, index) => {
      if (message.role === 'system') return;
      const cacheControl = breakpointIndexes.has(index) ? EPHEMERAL : undefined;

      if (message.role === 'tool') {
        mapped.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content,
            ...(cacheControl ? { cache_control: cacheControl } : {}),
          }],
        });
        return;
      }

      if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls?.length) {
        const blocks: AnthropicContentBlock[] = [];
        if (message.content?.trim()) {
          blocks.push({ type: 'text', text: message.content.trim() });
        }
        message.toolCalls.forEach((call) => {
          blocks.push({
            type: 'tool_use',
            id: call.id,
            name: call.name,
            input: call.args ?? {},
          });
        });
        if (cacheControl && blocks.length > 0) {
          blocks[blocks.length - 1].cache_control = cacheControl;
        }
        mapped.push({ role: 'assistant', content: blocks });
        return;
      }

      mapped.push({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: [{
          type: 'text',
          // Anthropic rejects empty text blocks.
          text: message.content?.trim() ? message.content : ' ',
          ...(cacheControl ? { cache_control: cacheControl } : {}),
        }],
      });
    });

    const systemText = systemContext?.trim();
    return mergeRequestParams({
      model: this.config.modelId,
      max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      system: systemText
        ? [{ type: 'text', text: systemText, cache_control: EPHEMERAL }]
        : undefined,
      messages: mapped,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
    }, this.config.requestParams);
  }

  private async postMessages(body: Record<string, unknown>): Promise<Response> {
    const response = await fetchWithTimeout(
      this.getMessagesUrl(),
      {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey?.trim() || '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      this.config.timeoutMs ?? TOOL_CALL_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    return response;
  }

  async chatWithTools(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult> {
    const response = await this.postMessages(this.buildToolCallBody(messages, tools, systemContext));

    const data = await response.json() as {
      content?: Array<
        | { type: 'text'; text?: string }
        | { type: 'tool_use'; id?: string; name?: string; input?: Record<string, unknown> }
      >;
    };

    const toolUses = (data.content ?? []).filter((block) => block.type === 'tool_use') as Array<{
      type: 'tool_use';
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;

    if (toolUses.length > 0) {
      return {
        toolCalls: toolUses.map((call, index) => ({
          id: call.id || `call-${index + 1}`,
          name: call.name || 'unknown',
          args: call.input ?? {},
        })),
        text: (data.content ?? [])
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text || '' : ''))
          .join('')
          .trim() || undefined,
      };
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text || '' : ''))
      .join('')
      .trim();

    return { text };
  }

  async chatWithToolsStream(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext: string | undefined,
    onTextDelta: (delta: string) => void,
  ): Promise<ChatWithToolsResult> {
    const body = { ...this.buildToolCallBody(messages, tools, systemContext), stream: true };
    const response = await this.postMessages(body);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Anthropic stream response is not readable.');
    }

    type StreamBlock =
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; inputJson: string };
    const blocks = new Map<number, StreamBlock>();

    const decoder = new TextDecoder();
    let buffer = '';

    const handleEvent = (payload: string): void => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return; // Ignore malformed stream chunks.
      }

      if (parsed.type === 'content_block_start') {
        const index = Number(parsed.index ?? 0);
        const block = parsed.content_block as { type?: string; id?: string; name?: string } | undefined;
        if (block?.type === 'tool_use') {
          blocks.set(index, { type: 'tool_use', id: block.id || '', name: block.name || '', inputJson: '' });
        } else if (block?.type === 'text') {
          blocks.set(index, { type: 'text', text: '' });
        }
        return;
      }

      if (parsed.type === 'content_block_delta') {
        const index = Number(parsed.index ?? 0);
        const delta = parsed.delta as { type?: string; text?: string; partial_json?: string } | undefined;
        const block = blocks.get(index);
        if (!block || !delta) return;
        if (delta.type === 'text_delta' && block.type === 'text' && delta.text) {
          block.text += delta.text;
          onTextDelta(delta.text);
        } else if (delta.type === 'input_json_delta' && block.type === 'tool_use') {
          block.inputJson += delta.partial_json ?? '';
        }
      }

      if (parsed.type === 'error') {
        const error = parsed.error as { message?: string } | undefined;
        throw new Error(error?.message || 'Anthropic stream error.');
      }
    };

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
        if (payload) handleEvent(payload);
      }
    }

    const ordered = [...blocks.entries()].sort(([a], [b]) => a - b).map(([, block]) => block);
    const text = ordered
      .filter((block): block is Extract<StreamBlock, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    const toolCalls = ordered
      .filter((block): block is Extract<StreamBlock, { type: 'tool_use' }> => block.type === 'tool_use')
      .map((block, index) => {
        let args: Record<string, unknown> = {};
        try {
          args = block.inputJson ? JSON.parse(block.inputJson) as Record<string, unknown> : {};
        } catch {
          args = {};
        }
        return {
          id: block.id || `call-${index + 1}`,
          name: block.name || 'unknown',
          args,
        };
      });

    if (toolCalls.length > 0) {
      return { toolCalls, text: text || undefined };
    }
    return { text };
  }
}
