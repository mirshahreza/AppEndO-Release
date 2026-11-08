import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDER_OPTIONS,
  AI_PROVIDER_SETUP_TEMPLATES,
  buildAiProviderConfigFromTemplate,
  resolveAiProviderHostKind,
} from '../constants';

describe('AI provider setup templates', () => {
  it('covers every supported provider kind at least once', () => {
    const kindsInTemplates = new Set(AI_PROVIDER_SETUP_TEMPLATES.map((item) => item.kind));
    for (const option of AI_PROVIDER_OPTIONS) {
      expect(kindsInTemplates.has(option.value)).toBe(true);
    }
  });

  it('assigns local host kind only to on-prem style providers', () => {
    expect(resolveAiProviderHostKind('ollama')).toBe('local');
    expect(resolveAiProviderHostKind('openai-compatible')).toBe('local');
    expect(resolveAiProviderHostKind('openai-compatible', 'https://api.groq.com/openai/v1')).toBe('cloud');
    expect(resolveAiProviderHostKind('openai-compatible', 'http://localhost:1234/v1')).toBe('local');
    expect(resolveAiProviderHostKind('openai')).toBe('cloud');
    expect(resolveAiProviderHostKind('google-gemini')).toBe('cloud');
  });

  it('includes Other templates for cloud and local', () => {
    expect(AI_PROVIDER_SETUP_TEMPLATES.some((item) => item.id === 'other-cloud')).toBe(true);
    expect(AI_PROVIDER_SETUP_TEMPLATES.some((item) => item.id === 'other-local')).toBe(true);
  });

  it('prefills LM Studio with the default local OpenAI-compatible base URL', () => {
    const config = buildAiProviderConfigFromTemplate('lm-studio');
    expect(config.provider).toBe('openai-compatible');
    expect(config.providerLabel).toBe('LM Studio');
    expect(config.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('uses unique template ids', () => {
    const ids = AI_PROVIDER_SETUP_TEMPLATES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
