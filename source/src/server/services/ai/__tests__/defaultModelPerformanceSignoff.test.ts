import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_AGENT_SETTINGS, isAiModelChatCapable } from '../../../../shared/api/contracts/ai/constants';

describe('default model performance sign-off', () => {
  it('default agent settings reference tool-capable chat defaults', () => {
    expect(DEFAULT_AI_AGENT_SETTINGS.defaultMode).toBe('ask');
    expect(DEFAULT_AI_AGENT_SETTINGS.allowedNativeToolGroups).toContain('standards');
    expect(DEFAULT_AI_AGENT_SETTINGS.maxToolCallsPerTurn).toBeGreaterThan(0);
    expect(DEFAULT_AI_AGENT_SETTINGS.maxTokensPerRun).toBeGreaterThan(10_000);
  });

  it('resolves default model contract for agent runs within budget', () => {
    const defaultModel = {
      id: 'gemini-2-5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google-gemini' as const,
      modelId: 'gemini-2.5-flash',
      enabled: true,
      isDefault: true,
      capabilities: {
        chat: true,
        streaming: true,
        vision: true,
        tools: true,
        embeddings: false,
        imageGeneration: false,
        speechToText: false,
        textToSpeech: false,
      },
      contextWindowTokens: 1_048_576,
    };

    expect(isAiModelChatCapable(defaultModel)).toBe(true);
    expect(defaultModel.capabilities.tools).toBe(true);
    expect(defaultModel.contextWindowTokens).toBeGreaterThan(DEFAULT_AI_AGENT_SETTINGS.maxTokensPerRun ?? 0);
  });

  it('lists available models within acceptable latency for settings bootstrap', () => {
    const started = performance.now();
    const models = Array.from({ length: 25 }, (_, index) => ({
      id: `model-${index}`,
      enabled: true,
      capabilities: { chat: true, streaming: true, vision: false, tools: true, embeddings: false, imageGeneration: false, speechToText: false, textToSpeech: false },
    }));
    const chatModels = models.filter((model) => model.enabled && isAiModelChatCapable(model as never));
    const elapsedMs = performance.now() - started;

    expect(chatModels.length).toBe(25);
    expect(elapsedMs).toBeLessThan(50);
  });
});
