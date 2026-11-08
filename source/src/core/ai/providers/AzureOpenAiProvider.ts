import type { ChatMessage, ChatWithToolsMessage, ChatWithToolsResult, IAiProvider, ToolDefinition } from '../IAiProvider';
import { isMaxTokensUnsupportedError } from './openAiModelRouting';
import { fetchWithTimeout, mergeRequestParams, readResponseError, type ProviderRuntimeConfig } from './providerUtils';

export class AzureOpenAiProvider implements IAiProvider {
  constructor(private readonly config: ProviderRuntimeConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error('Azure OpenAI provider requires apiKey.');
    }
    if (!config.baseUrl?.trim()) {
      throw new Error('Azure OpenAI provider requires baseUrl.');
    }
    if (!config.deploymentName?.trim()) {
      throw new Error('Azure OpenAI provider requires deploymentName.');
    }
  }

  getProviderName(): string {
    return this.config.displayName;
  }

  private buildChatUrl(): string {
    const apiVersion = this.config.apiVersion?.trim() || '2024-02-15-preview';
    return `${this.config.baseUrl?.replace(/\/$/, '')}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  }

  private buildChatBody(messages: unknown[]): Record<string, unknown> {
    return mergeRequestParams({
      messages,
    }, this.config.requestParams);
  }

  private async postChatCompletions(
    body: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<Response> {
    return fetchWithTimeout(
      this.buildChatUrl(),
      {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey?.trim() || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      timeoutMs ?? this.config.timeoutMs ?? 60000,
    );
  }

  async chat(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const mappedMessages = [
      ...(systemContext?.trim()
        ? [{ role: 'system', content: systemContext.trim() }]
        : []),
      ...messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'user' ? 'user' : 'assistant',
          content: message.content,
        })),
    ];

    let body = this.buildChatBody(mappedMessages);
    let response = await this.postChatCompletions(body);

    if (!response.ok) {
      const errorMessage = await readResponseError(response);
      if (isMaxTokensUnsupportedError(errorMessage) && 'max_tokens' in body) {
        const { max_tokens: maxTokens, ...rest } = body;
        body = mergeRequestParams({
          ...rest,
          max_completion_tokens: typeof maxTokens === 'number' ? maxTokens : 8_192,
        }, this.config.requestParams);
        response = await this.postChatCompletions(body);
        if (!response.ok) {
          throw new Error(await readResponseError(response));
        }
      } else {
        throw new Error(errorMessage);
      }
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  async testConnection(): Promise<string> {
    await this.chat([{ role: 'user', content: 'ping' }]);
    return 'Connection successful.';
  }

  async chatWithTools(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult> {
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
          content: message.content,
        });
        return;
      }
      if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls?.length) {
        mapped.push({
          role: 'assistant',
          content: message.content || '',
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
        content: message.content,
      });
    });

    // p-63 F-2 — agent tool-call generations routinely exceed the generic 60 s default.
    const response = await this.postChatCompletions(mergeRequestParams({
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
    }, this.config.requestParams), this.config.timeoutMs ?? 300_000);

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
}
