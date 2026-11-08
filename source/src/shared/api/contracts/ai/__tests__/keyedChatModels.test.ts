import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_AGENT_SETTINGS,
  DEFAULT_AI_HTTP_SETTINGS,
  DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS,
  DEFAULT_AI_MCP_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_AI_WEB_SEARCH_SETTINGS,
  REDACTED_API_KEY,
} from '../constants';
import { isAiChatModelKeyedAndEnabled } from '../validators';
import type { AiModelEntry, AiSettings } from '../types';

const CHAT_CAPABILITIES: AiModelEntry['capabilities'] = {
  chat: true,
  streaming: true,
  vision: false,
  tools: true,
  embeddings: false,
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
};

const EMBEDDING_CAPABILITIES: AiModelEntry['capabilities'] = {
  chat: false,
  streaming: false,
  vision: false,
  tools: false,
  embeddings: true,
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
};

const BASE_SETTINGS: AiSettings = {
  enabled: true,
  defaultModelId: 'gemini-2-5-flash',
  chatRateLimitPerMinute: 20,
  providers: [
    { provider: 'google-gemini', providerLabel: 'Google Gemini' },
    { provider: 'ollama', providerLabel: 'Ollama' },
  ],
  models: [
    {
      id: 'gemini-2-5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google-gemini',
      modelId: 'gemini-2.5-flash',
      enabled: true,
      capabilities: CHAT_CAPABILITIES,
    },
    {
      id: 'ollama-llama-3-2',
      name: 'Llama 3.2',
      provider: 'ollama',
      modelId: 'llama3.2',
      enabled: true,
      capabilities: CHAT_CAPABILITIES,
    },
    {
      id: 'google-text-embedding-004',
      name: 'Google Embedding',
      provider: 'google-gemini',
      modelId: 'text-embedding-004',
      enabled: true,
      capabilities: EMBEDDING_CAPABILITIES,
    },
  ],
  agent: { ...DEFAULT_AI_AGENT_SETTINGS, allowedNativeToolGroups: [...DEFAULT_AI_AGENT_SETTINGS.allowedNativeToolGroups] },
  mcp: {
    ...DEFAULT_AI_MCP_SETTINGS,
    stdioAllowlist: [],
    inboundHost: { ...DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS },
  },
  mcpServers: [],
  webSearch: { ...DEFAULT_AI_WEB_SEARCH_SETTINGS },
  http: { ...DEFAULT_AI_HTTP_SETTINGS, allowedHostnames: [] },
  eua: { ...DEFAULT_AI_SETTINGS.eua, capabilities: { ...DEFAULT_AI_SETTINGS.eua.capabilities } },
};

const withProviderKey = (settings: AiSettings, provider: AiSettings['providers'][number]['provider'], apiKey: string): AiSettings => ({
  ...settings,
  providers: settings.providers.map((item) => (
    item.provider === provider ? { ...item, apiKey } : item
  )),
});

describe('isAiChatModelKeyedAndEnabled', () => {
  it('drops enabled Ollama chat models that have no API key', () => {
    const ollama = BASE_SETTINGS.models.find((model) => model.id === 'ollama-llama-3-2');
    expect(ollama?.enabled).toBe(true);
    expect(isAiChatModelKeyedAndEnabled(ollama!, BASE_SETTINGS)).toBe(false);
  });

  it('drops enabled Gemini chat models when the provider key is empty', () => {
    const gemini = BASE_SETTINGS.models.find((model) => model.id === 'gemini-2-5-flash');
    expect(gemini?.enabled).toBe(true);
    expect(isAiChatModelKeyedAndEnabled(gemini!, BASE_SETTINGS)).toBe(false);
  });

  it('keeps an enabled chat model only when its provider has a real key', () => {
    const keyed = withProviderKey(BASE_SETTINGS, 'google-gemini', 'real-gemini-key');
    const gemini = keyed.models.find((model) => model.id === 'gemini-2-5-flash')!;
    const ollama = keyed.models.find((model) => model.id === 'ollama-llama-3-2')!;
    expect(isAiChatModelKeyedAndEnabled(gemini, keyed)).toBe(true);
    expect(isAiChatModelKeyedAndEnabled(ollama, keyed)).toBe(false);
  });

  it('treats the redacted placeholder as no key', () => {
    const redacted = withProviderKey(BASE_SETTINGS, 'google-gemini', REDACTED_API_KEY);
    const gemini = redacted.models.find((model) => model.id === 'gemini-2-5-flash')!;
    expect(isAiChatModelKeyedAndEnabled(gemini, redacted)).toBe(false);
  });

  it('drops embeddings models even when the provider has a key', () => {
    const keyed = withProviderKey(BASE_SETTINGS, 'google-gemini', 'real-gemini-key');
    const embedding = keyed.models.find((model) => model.id === 'google-text-embedding-004')!;
    expect(embedding.enabled).toBe(true);
    expect(isAiChatModelKeyedAndEnabled(embedding, keyed)).toBe(false);
  });

  it('keeps an enabled chat model when the provider only has a stored-key flag', () => {
    const keyed: AiSettings = {
      ...BASE_SETTINGS,
      providers: BASE_SETTINGS.providers.map((item) => (
        item.provider === 'google-gemini' ? { ...item, hasApiKey: true } : item
      )),
    };
    const gemini = keyed.models.find((model) => model.id === 'gemini-2-5-flash')!;
    expect(isAiChatModelKeyedAndEnabled(gemini, keyed)).toBe(true);
  });

  it('keeps Ollama only when a key is actually stored', () => {
    const keyed = withProviderKey(BASE_SETTINGS, 'ollama', 'local-token');
    const ollama = keyed.models.find((model) => model.id === 'ollama-llama-3-2')!;
    expect(isAiChatModelKeyedAndEnabled(ollama, keyed)).toBe(true);
  });
});
