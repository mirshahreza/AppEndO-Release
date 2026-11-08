import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import { parseServerFunctionAssistResponse, ServerFunctionAiService } from '../serverFunctionAi.service';

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

const SAMPLE_SOURCE = `const edgeReq = req as EdgeReq;
const edgeRes = res as EdgeRes;
async function handler(): Promise<void> {
  edgeRes.json({ success: true, data: { sum: 3 } });
}
(async () => { await handler(); })();`;

describe('parseServerFunctionAssistResponse', () => {
  it('reads text and source from a JSON envelope', () => {
    expect(parseServerFunctionAssistResponse(JSON.stringify({
      text: 'Adds a and b from the body.',
      source: SAMPLE_SOURCE,
    }))).toEqual({
      text: 'Adds a and b from the body.',
      source: SAMPLE_SOURCE,
    });
  });

  it('keeps a source longer than 2000 characters (full handler replacement)', () => {
    const longSource = `${'// pad\n'.repeat(400)}${SAMPLE_SOURCE}`;
    expect(longSource.length).toBeGreaterThan(2000);
    const parsed = parseServerFunctionAssistResponse(JSON.stringify({
      text: 'Expanded handler.',
      source: longSource,
    }));
    expect(parsed.source).toBe(longSource);
  });

  it('understands a JSON envelope wrapped in a markdown fence', () => {
    const parsed = parseServerFunctionAssistResponse([
      '```json',
      JSON.stringify({ text: 'Clarified the handler.', source: SAMPLE_SOURCE }),
      '```',
    ].join('\n'));
    expect(parsed.text).toBe('Clarified the handler.');
    expect(parsed.source).toBe(SAMPLE_SOURCE);
  });

  it('falls back to commands[0] when source is missing', () => {
    const parsed = parseServerFunctionAssistResponse(JSON.stringify({
      text: 'Updated.',
      commands: [SAMPLE_SOURCE],
    }));
    expect(parsed.source).toBe(SAMPLE_SOURCE);
  });

  it('extracts a bare TypeScript fence when JSON is absent', () => {
    const parsed = parseServerFunctionAssistResponse(`Here you go:\n\`\`\`typescript\n${SAMPLE_SOURCE}\n\`\`\``);
    expect(parsed.source).toBe(SAMPLE_SOURCE);
  });

  it('returns text-only when the reply is plain prose', () => {
    expect(parseServerFunctionAssistResponse('  This handler returns the current timestamp.  ')).toEqual({
      text: 'This handler returns the current timestamp.',
      source: '',
    });
  });
});

describe('ServerFunctionAiService', () => {
  const service = new ServerFunctionAiService();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockResolvedValue('This handler returns JSON with success: true.');
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('rejects when AI is disabled in platform settings', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, enabled: false });
    await expect(service.assist({ prompt: 'Explain this handler.' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('returns plain prose with empty source when the model replies in text', async () => {
    const result = await service.assist({
      prompt: 'What does this do?',
      functionSnapshot: JSON.stringify({ name: 'sum', method: 'POST', source: SAMPLE_SOURCE }),
    });

    expect(result.body).toEqual({
      text: 'This handler returns JSON with success: true.',
      source: '',
      modelId: 'gpt-test',
    });
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('Server Functions editor'),
    );
  });

  it('includes the function snapshot in the user message sent to the model', async () => {
    await service.assist({
      prompt: 'Add input validation.',
      functionSnapshot: '{"name":"sum-two-numbers","method":"POST"}',
    });

    const [messages] = vi.mocked(aiManager.processChat).mock.calls[0];
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('sum-two-numbers');
    expect(lastMessage.content).toContain('Add input validation.');
  });

  it('passes through a proposed source from a JSON envelope reply', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      text: 'Reads a and b from the body and returns the sum.',
      source: SAMPLE_SOURCE,
    }));

    const result = await service.assist({ prompt: 'Add two numbers from the POST body.' });

    expect(result.body.text).toBe('Reads a and b from the body and returns the sum.');
    expect(result.body.source).toBe(SAMPLE_SOURCE);
  });
});
