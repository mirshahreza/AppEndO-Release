import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import { SshHubAiService } from '../sshHubAi.service';

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

describe('SshHubAiService', () => {
  const service = new SshHubAiService();

  beforeEach(() => {
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockResolvedValue('{"text":"Disk is 12% full","commands":["df -h"]}');
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('rejects when AI is disabled', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({
      ...enabledSettings,
      enabled: false,
    });

    await expect(service.assist({ prompt: 'Show disk usage' })).rejects.toMatchObject({
      statusCode: 503,
      message: 'AI is disabled in platform settings.',
    } satisfies Partial<HttpError>);
  });

  it('returns parsed text and commands from the chat model', async () => {
    const result = await service.assist({
      prompt: 'How full is the disk?',
      terminalSnapshot: 'user@host:~$ ',
    });

    expect(result.body).toEqual({
      text: 'Disk is 12% full',
      commands: ['df -h'],
      modelId: 'gpt-test',
    });
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('SSH operator assistant'),
    );
  });
});
