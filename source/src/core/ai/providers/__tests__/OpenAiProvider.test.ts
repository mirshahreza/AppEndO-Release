import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAiProvider } from '../OpenAiProvider';
import { resolveEffectiveRequestParams } from '../modelRequestParams';

describe('OpenAiProvider chat request body', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send temperature for gpt-5 models with user-configured requestParams', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.temperature).toBeUndefined();
      expect(body.max_completion_tokens).toBe(128000);

      return new Response(JSON.stringify({
        choices: [{ message: { content: 'pong' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const requestParams = resolveEffectiveRequestParams({
      modelId: 'gpt-5.4',
      requestParams: {
        max_completion_tokens: 128000,
        temperature: 0.7,
      },
    });

    const provider = new OpenAiProvider({
      displayName: 'GPT-5.4',
      modelId: 'gpt-5.4',
      apiKey: 'test-key',
      requestParams,
    });

    const text = await provider.chat([{ role: 'user', content: 'ping' }]);
    expect(text).toBe('pong');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries without temperature when the API rejects a custom value', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

      if (callCount === 1) {
        expect(body.temperature).toBe(0.5);
        return new Response(JSON.stringify({
          error: { message: "Unsupported value: 'temperature' does not support 0.5 with this model. Only the default (1) value is supported." },
        }), { status: 400 });
      }

      expect(body.temperature).toBeUndefined();
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiProvider({
      displayName: 'Custom',
      modelId: 'custom-model',
      apiKey: 'test-key',
      requestParams: {
        max_completion_tokens: 1024,
        temperature: 0.5,
      },
    });

    const text = await provider.chat([{ role: 'user', content: 'ping' }]);
    expect(text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('OpenAiProvider.chatWithTools message content', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('never sends an empty content string for tool-call or tool-result messages', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<Record<string, unknown>> };

      body.messages.forEach((message) => {
        if (typeof message.content === 'string') {
          expect(message.content.length).toBeGreaterThan(0);
        }
      });

      const assistantToolCallMessage = body.messages.find((message) => (
        message.role === 'assistant' && Array.isArray(message.tool_calls)
      ));
      expect(assistantToolCallMessage?.content).toBeUndefined();

      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiProvider({
      displayName: 'OpenRouter',
      modelId: 'openai/gpt-5.1',
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    await provider.chatWithTools([
      { role: 'user', content: 'run the tool' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'search', args: {} }] },
      { role: 'tool', content: '', toolCallId: 'call_1', name: 'search' },
    ], [{ name: 'search', description: 'Search', parameters: {} }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('OpenAiProvider.listRemoteModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses OpenRouter-style /models entries, including pricing and context length', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://openrouter.ai/api/v1/models');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

      return new Response(JSON.stringify({
        data: [
          {
            id: 'anthropic/claude-sonnet-5',
            name: 'Claude Sonnet 5',
            description: 'Anthropic flagship model.',
            context_length: 200000,
            pricing: { prompt: '0.000003', completion: '0.000015' },
          },
          { id: '', name: 'Malformed entry without id' },
        ],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiProvider({
      displayName: 'OpenRouter',
      modelId: 'probe',
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    const models = await provider.listRemoteModels();
    expect(models).toEqual([{
      id: 'anthropic/claude-sonnet-5',
      name: 'Claude Sonnet 5',
      description: 'Anthropic flagship model.',
      contextLength: 200000,
      pricingPrompt: '0.000003',
      pricingCompletion: '0.000015',
    }]);
  });

  it('throws when the remote endpoint responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'Unauthorized' } }),
      { status: 401 },
    )));

    const provider = new OpenAiProvider({
      displayName: 'OpenRouter',
      modelId: 'probe',
      apiKey: 'bad-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    });

    await expect(provider.listRemoteModels()).rejects.toThrow();
  });
});
