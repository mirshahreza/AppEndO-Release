import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import { parseClientComponentAssistResponse, ClientComponentAiService } from '../clientComponentAi.service';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';

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

const SAMPLE_DOCUMENT = createInitialDesignerState('probe').document;

describe('parseClientComponentAssistResponse', () => {
  it('reads text and document from a JSON envelope', () => {
    expect(parseClientComponentAssistResponse(JSON.stringify({
      text: 'Adds a heading.',
      document: SAMPLE_DOCUMENT,
      bindingDefinitions: {},
    }))).toEqual({
      text: 'Adds a heading.',
      document: SAMPLE_DOCUMENT,
      bindingDefinitions: {},
    });
  });

  it('understands a JSON envelope wrapped in a markdown fence', () => {
    const parsed = parseClientComponentAssistResponse([
      '```json',
      JSON.stringify({ text: 'Clarified the layout.', document: SAMPLE_DOCUMENT }),
      '```',
    ].join('\n'));
    expect(parsed.text).toBe('Clarified the layout.');
    expect(parsed.document).toEqual(SAMPLE_DOCUMENT);
  });

  it('returns text-only when the reply is plain prose', () => {
    expect(parseClientComponentAssistResponse('  This layout is a contact form.  ')).toEqual({
      text: 'This layout is a contact form.',
      document: null,
      bindingDefinitions: {},
    });
  });
});

describe('ClientComponentAiService', () => {
  const service = new ClientComponentAiService();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockResolvedValue('This layout is a contact form.');
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('rejects when AI is disabled in platform settings', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, enabled: false });
    await expect(service.assist({ prompt: 'Explain this layout.' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('includes the layout snapshot in the user message sent to the model', async () => {
    await service.assist({
      prompt: 'Add a save button.',
      layoutSnapshot: '{"name":"probe","layoutId":"draft-1"}',
    });

    const [messages] = vi.mocked(aiManager.processChat).mock.calls[0];
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('probe');
    expect(lastMessage.content).toContain('Add a save button.');
  });

  it('passes through a proposed document from a JSON envelope reply', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      text: 'Added a heading.',
      document: SAMPLE_DOCUMENT,
      bindingDefinitions: {},
    }));

    const result = await service.assist({ prompt: 'Add a heading.' });

    expect(result.body.text).toBe('Added a heading.');
    expect(result.body.document).toEqual(SAMPLE_DOCUMENT);
  });
});
