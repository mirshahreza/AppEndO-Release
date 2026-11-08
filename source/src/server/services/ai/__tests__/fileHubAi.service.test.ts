import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import { FileHubAiService } from '../fileHubAi.service';

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: vi.fn(),
    processChat: vi.fn(),
    resolveModel: vi.fn((modelId: string) => ({
      entry: {
        id: modelId,
        name: 'GPT Test',
        provider: 'openai',
        modelId: 'gpt-4.1',
        enabled: true,
        capabilities: { chat: true },
      },
    })),
  },
}));

const CHAT_MODEL = {
  id: 'gpt-test',
  name: 'GPT Test',
  provider: 'openai' as const,
  modelId: 'gpt-4.1',
  enabled: true,
  capabilities: { chat: true },
};

const enabledSettings = {
  enabled: true,
  defaultModelId: 'gpt-test',
  models: [CHAT_MODEL],
} as unknown as AiSettings;

describe('FileHubAiService', () => {
  const service = new FileHubAiService();

  beforeEach(() => {
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockResolvedValue('{"text":"Two entries in this folder","commands":["ls"]}');
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('returns parsed text and commands from the chat model', async () => {
    const result = await service.assist({
      prompt: 'What is in this folder?',
      listingSnapshot: 'Path: /var/www',
    });

    expect(result.body).toEqual({
      text: 'Two entries in this folder',
      commands: ['ls'],
      modelId: 'gpt-test',
    });
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('File Hub assistant'),
    );
  });
});
