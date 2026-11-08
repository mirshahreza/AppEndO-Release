import { afterEach, describe, expect, it, vi } from 'vitest';

import { aiManager } from '../AiManager';
import { DEFAULT_AI_SETTINGS } from '../../../shared/api/contracts/ai/constants';
import type { AiSettings } from '../../../shared/api/contracts/ai/types';

describe('AiManager with sanitized gpt-5 request params', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send temperature when chatting with gpt-5.4', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.temperature).toBeUndefined();
      expect(body.max_completion_tokens).toBe(128000);

      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Hello from GPT-5.4' } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const settings: AiSettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      defaultModelId: 'openai-gpt-5-4',
      providers: [{ provider: 'openai', providerLabel: 'OpenAI', apiKey: 'test-openai-key' }],
      models: [{
        id: 'openai-gpt-5-4',
        name: 'GPT-5.4',
        provider: 'openai',
        modelId: 'gpt-5.4',
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: true,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
        requestParams: {
          max_completion_tokens: 128000,
          temperature: 0.7,
        },
      }],
    };

    aiManager.reloadFromSettings(settings);

    const text = await aiManager.processChat(
      [{ role: 'user', content: 'Hello' }],
      'openai-gpt-5-4',
    );

    expect(text).toBe('Hello from GPT-5.4');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
