import { afterEach, describe, expect, it, vi } from 'vitest';

import { aiManager } from '../../../../core/ai/AiManager';
import type { AiModelEntry, AiSettings } from '../../../../shared/api/contracts/ai/types';
import { DEFAULT_AI_CAPABILITIES } from '../../../../shared/api/contracts/ai/constants';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: vi.fn(),
  },
}));

import { EuaVisionService } from '../euaVision.service';

const baseModel = (overrides: Partial<AiModelEntry>): AiModelEntry => ({
  id: 'ollama-gemma3',
  name: 'Gemma 3 12B (Ollama)',
  provider: 'ollama',
  modelId: 'gemma3:12b',
  enabled: true,
  capabilities: { ...DEFAULT_AI_CAPABILITIES, chat: true, vision: true },
  ...overrides,
});

const baseSettings = (models: AiModelEntry[]): AiSettings => ({
  enabled: true,
  defaultModelId: models[0]?.id ?? '',
  chatRateLimitPerMinute: 60,
  models,
  providers: [{ provider: 'ollama' }],
  agent: { enabled: false, defaultMode: 'agent', capabilityScope: 'full', allowedPacks: [] },
  mcp: { enabled: false, servers: [] },
  mcpServers: [],
  http: { enabled: false, allowedHosts: [] },
  webSearch: { enabled: false, provider: 'brave' },
});

const IMAGE_DATA_URL = `data:image/png;base64,${Buffer.from('fake-image-bytes').toString('base64')}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('EuaVisionService.runImageTask with an Ollama model', () => {
  it('sends the image via /api/chat images field with no API key required', async () => {
    const model = baseModel({});
    vi.mocked(aiManager.getSettings).mockReturnValue(baseSettings([model]));

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://localhost:11434/api/chat');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe('gemma3:12b');
      const messages = body.messages as Array<{ role: string; content: string; images: string[] }>;
      expect(messages).toHaveLength(1);
      expect(messages[0].images).toEqual([Buffer.from('fake-image-bytes').toString('base64')]);

      return new Response(JSON.stringify({ message: { content: 'A red square.' } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new EuaVisionService();
    const result = await service.runImageTask({
      imageDataUrl: IMAGE_DATA_URL,
      systemPrompt: 'Describe the image.',
      userPrompt: 'What is in it?',
      modelId: model.id,
    });

    expect(result.text).toBe('A red square.');
    expect(result.modelId).toBe(model.id);
  });
});
