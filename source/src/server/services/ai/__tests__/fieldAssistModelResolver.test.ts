import { describe, expect, it, vi, beforeEach } from 'vitest';
import { aiManager } from '../../../../core/ai/AiManager';
import { resolveFieldAssistChatModelId } from '../fieldAssistModelResolver';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    resolveModel: vi.fn(),
  },
}));

const CHAT_MODEL = {
  id: 'openai-gpt-4-1',
  name: 'GPT 4.1',
  provider: 'openai' as const,
  modelId: 'gpt-4.1',
  enabled: true,
  capabilities: { chat: true },
};

const IMAGE_MODEL = {
  id: 'openai-gpt-image',
  name: 'GPT Image',
  provider: 'openai' as const,
  modelId: 'gpt-image-1',
  enabled: true,
  capabilities: { imageGeneration: true },
};

describe('resolveFieldAssistChatModelId', () => {
  beforeEach(() => {
    vi.mocked(aiManager.resolveModel).mockImplementation((modelId?: string) => {
      const entry = modelId === IMAGE_MODEL.id ? IMAGE_MODEL : CHAT_MODEL;
      return { entry, provider: {} as never };
    });
  });

  it('uses settings default when chat-capable', () => {
    const resolved = resolveFieldAssistChatModelId({
      enabled: true,
      defaultModelId: 'openai-gpt-4-1',
      models: [CHAT_MODEL, IMAGE_MODEL],
    } as never);

    expect(resolved).toBe('openai-gpt-4-1');
  });

  it('falls back to first chat model when default is image-only', () => {
    const resolved = resolveFieldAssistChatModelId({
      enabled: true,
      defaultModelId: 'openai-gpt-image',
      models: [IMAGE_MODEL, CHAT_MODEL],
    } as never);

    expect(resolved).toBe('openai-gpt-4-1');
  });
});
