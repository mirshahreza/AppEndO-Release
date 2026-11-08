import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FieldAssistService } from '../fieldAssist.service';
import { aiManager } from '../../../../core/ai/AiManager';

const CHAT_MODEL = {
  id: 'gpt-test',
  name: 'GPT Test',
  provider: 'openai' as const,
  modelId: 'gpt-4.1',
  enabled: true,
  capabilities: { chat: true },
};

vi.mock('../../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: vi.fn(),
    processChat: vi.fn(),
    resolveModel: vi.fn(),
  },
}));

describe('FieldAssistService', () => {
  const service = new FieldAssistService();

  beforeEach(() => {
    vi.mocked(aiManager.getSettings).mockReturnValue({
      enabled: true,
      defaultModelId: 'gpt-test',
      models: [CHAT_MODEL],
    } as ReturnType<typeof aiManager.getSettings>);
    vi.mocked(aiManager.resolveModel).mockReturnValue({
      entry: CHAT_MODEL,
      provider: {} as never,
    });
    vi.mocked(aiManager.processChat).mockResolvedValue('Rewritten text');
  });

  it('returns EUA status with chat default model', () => {
    const status = service.getStatus();
    expect(status.aiEnabled).toBe(true);
    expect(status.defaultModelId).toBe('gpt-test');
    expect(status.capabilities['eua.contextMenu']).toBe(true);
  });

  it('reports unavailable when default model is not chat-capable', () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({
      enabled: true,
      defaultModelId: 'dall-e',
      models: [
        { ...CHAT_MODEL, id: 'dall-e', capabilities: { imageGeneration: true } },
      ],
    } as ReturnType<typeof aiManager.getSettings>);
    vi.mocked(aiManager.resolveModel).mockImplementation(() => {
      throw new Error('not registered');
    });

    const status = service.getStatus();
    expect(status.aiEnabled).toBe(false);
    expect(status.defaultModelId).toBeUndefined();
  });

  it('transforms full textarea text with resolved chat model', async () => {
    const result = await service.transformText({
      action: 'formal',
      text: 'hey there',
    });
    expect(result.text).toBe('Rewritten text');
    expect(result.modelId).toBe('gpt-test');
    expect(aiManager.processChat).toHaveBeenCalledWith(expect.any(Array), 'gpt-test');
  });

  it('semantic validation parses model JSON', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      ValidationResult: 'Not Valid',
      Reasons: ['Need more detail'],
    }));

    const result = await service.semanticValidateText({
      text: 'Short note',
      rubric: 'Must include two reasons',
    });

    expect(result.valid).toBe(false);
    expect(result.reasons).toEqual(['Need more detail']);
  });

  it('rejects when AI is disabled', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({
      enabled: false,
      defaultModelId: 'gpt-test',
      models: [CHAT_MODEL],
    } as ReturnType<typeof aiManager.getSettings>);

    await expect(service.transformText({ action: 'expand', text: 'hello' }))
      .rejects
      .toMatchObject({ statusCode: 503 });
  });
});
