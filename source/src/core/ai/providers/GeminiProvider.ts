import { GoogleGenAI } from '@google/genai';
import type {
  ChatMessage,
  ChatWithToolsMessage,
  ChatWithToolsResult,
  IAiProvider,
  ToolDefinition,
} from '../IAiProvider';
import type { ProviderRuntimeConfig } from './providerUtils';

export class GeminiProvider implements IAiProvider {
  private ai: GoogleGenAI;
  private config: ProviderRuntimeConfig;

  constructor(config: ProviderRuntimeConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error('Gemini provider requires apiKey.');
    }
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey.trim() });
  }

  getProviderName(): string {
    return this.config.displayName;
  }

  private geminiConfig(systemContext?: string): Record<string, unknown> {
    return {
      systemInstruction: systemContext,
      ...(this.config.requestParams ?? {}),
    };
  }

  async chat(messages: ChatMessage[], systemContext?: string): Promise<string> {
    const history = messages.filter((message) => message.role !== 'system').map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));

    const lastMessage = history.pop();
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message provided or invalid message sequence.');
    }

    const response = await this.ai.models.generateContent({
      model: this.config.modelId,
      contents: [...history, lastMessage],
      config: this.geminiConfig(systemContext),
    });

    return response.text || '';
  }

  async streamChat(
    messages: ChatMessage[],
    systemContext: string | undefined,
    onDelta: (delta: string) => void,
  ): Promise<string> {
    const history = messages.filter((message) => message.role !== 'system').map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));

    const lastMessage = history.pop();
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message provided or invalid message sequence.');
    }

    const stream = await this.ai.models.generateContentStream({
      model: this.config.modelId,
      contents: [...history, lastMessage],
      config: this.geminiConfig(systemContext),
    });

    let fullText = '';
    for await (const chunk of stream) {
      const delta = chunk.text || '';
      if (!delta) continue;
      fullText += delta;
      onDelta(delta);
    }

    return fullText;
  }

  async testConnection(): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.config.modelId,
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      config: {
        maxOutputTokens: 8,
      },
    });
    return response.text?.trim() || 'Connection successful.';
  }

  async chatWithTools(
    messages: ChatWithToolsMessage[],
    tools: ToolDefinition[],
    systemContext?: string,
  ): Promise<ChatWithToolsResult> {
    const contents = messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        if (message.role === 'tool') {
          return {
            role: 'user' as const,
            parts: [{
              functionResponse: {
                name: message.name || 'tool',
                response: { output: message.content },
              },
            }],
          };
        }

        return {
          role: message.role === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: message.content }],
        };
      });

    const response = await this.ai.models.generateContent({
      model: this.config.modelId,
      contents,
      config: {
        ...this.geminiConfig(systemContext),
        tools: tools.length > 0
          ? [{
            functionDeclarations: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters,
            })),
          }]
          : undefined,
      },
    });

    const functionCalls = response.functionCalls;
    if (functionCalls?.length) {
      return {
        toolCalls: functionCalls.map((call, index) => ({
          id: call.id || `call-${index + 1}`,
          name: call.name || 'unknown',
          args: (call.args ?? {}) as Record<string, unknown>,
        })),
        text: response.text?.trim() || undefined,
      };
    }

    return { text: response.text?.trim() || '' };
  }
}
