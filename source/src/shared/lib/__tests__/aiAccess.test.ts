import { describe, expect, it } from 'vitest';
import { hasConfiguredAiProvider, isAiGloballyEnabled } from '../aiAccess';

describe('aiAccess', () => {
  it('treats AI as enabled only when the global flag is true', () => {
    expect(isAiGloballyEnabled(true)).toBe(true);
    expect(isAiGloballyEnabled(false)).toBe(false);
    expect(isAiGloballyEnabled(undefined)).toBe(false);
  });

  it('detects configured providers with API keys', () => {
    expect(hasConfiguredAiProvider(
      [{ provider: 'openai', hasApiKey: true }],
      [],
    )).toBe(true);
  });

  it('treats ollama providers as configured without API keys', () => {
    expect(hasConfiguredAiProvider(
      [{ provider: 'ollama', hasApiKey: false }],
      [],
    )).toBe(true);
  });

  it('falls back to enabled ollama models when provider credentials are absent', () => {
    expect(hasConfiguredAiProvider(
      [],
      [{
        id: 'ollama-1',
        name: 'Local',
        provider: 'ollama',
        modelId: 'llama3.2',
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: false,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
      }],
    )).toBe(true);
  });

  it('returns false when AI is enabled but no provider credentials exist', () => {
    expect(hasConfiguredAiProvider(
      [{ provider: 'openai', hasApiKey: false }],
      [{
        id: 'gpt-1',
        name: 'GPT',
        provider: 'openai',
        modelId: 'gpt-4.1',
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: false,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
      }],
    )).toBe(false);
  });
});
