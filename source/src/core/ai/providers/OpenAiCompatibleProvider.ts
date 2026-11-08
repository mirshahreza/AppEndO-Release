import { OpenAiProvider } from './OpenAiProvider';
import type { ProviderRuntimeConfig } from './providerUtils';

type OpenAiBodyMessage = {
  role: string;
  content?: unknown;
  [key: string]: unknown;
};

const EPHEMERAL_CACHE = { type: 'ephemeral' as const };

const toCachedTextParts = (content: unknown): unknown => {
  if (typeof content !== 'string' || !content.trim()) return content;
  return [{ type: 'text', text: content, cache_control: EPHEMERAL_CACHE }];
};

export class OpenAiCompatibleProvider extends OpenAiProvider {
  constructor(config: ProviderRuntimeConfig) {
    if (!config.baseUrl?.trim()) {
      throw new Error('OpenAI-compatible provider requires baseUrl.');
    }
    super(config);
  }

  private isOpenRouter(): boolean {
    return (this.config.baseUrl ?? '').includes('openrouter.ai');
  }

  private isAnthropicModel(): boolean {
    return /anthropic|claude/i.test(this.config.modelId);
  }

  protected override finalizeCompletionBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!this.isOpenRouter()) {
      return body;
    }

    const finalized = { ...body };

    // Same model, fastest upstream host. Operator requestParams still win: mergeRequestParams
    // ran before this hook, so an explicit `provider` key is already present and respected.
    if (!('provider' in finalized)) {
      finalized.provider = { sort: 'throughput' };
    }

    // Anthropic models need explicit cache_control (OpenAI-family caching is automatic).
    // Marking the system message and the last plain user message caches the whole prefix —
    // tool definitions, system prompt, and history before the current turn.
    if (this.isAnthropicModel() && Array.isArray(finalized.messages)) {
      const messages = (finalized.messages as OpenAiBodyMessage[]).map((message) => ({ ...message }));
      const systemMessage = messages.find((message) => message.role === 'system');
      if (systemMessage) {
        systemMessage.content = toCachedTextParts(systemMessage.content);
      }
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
      if (lastUserMessage) {
        lastUserMessage.content = toCachedTextParts(lastUserMessage.content);
      }
      finalized.messages = messages;
    }

    return finalized;
  }
}
