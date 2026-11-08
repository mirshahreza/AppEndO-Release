import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../shared/api/contracts/ai/types';
import { HttpError } from '../../../errors/HttpError';
import { aiManager } from '../../../../core/ai/AiManager';
import { WorkflowDesignerAiService } from '../workflowDesignerAi.service';

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

describe('WorkflowDesignerAiService (p-99/WFT-12, scoped advisory chat)', () => {
  const service = new WorkflowDesignerAiService();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiManager.getSettings).mockReturnValue(enabledSettings);
    vi.mocked(aiManager.processChat).mockResolvedValue('This ACTION node calls crypto.hash on the incoming payload.');
  });

  it('requires prompt', async () => {
    await expect(service.assist({ prompt: '   ' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('rejects when AI is disabled in platform settings', async () => {
    vi.mocked(aiManager.getSettings).mockReturnValue({ ...enabledSettings, enabled: false });
    await expect(service.assist({ prompt: 'What does this node do?' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('returns plain prose text with no operations when the model replies in plain text (question-only)', async () => {
    const result = await service.assist({
      prompt: 'What does the hash node do?',
      workflowSnapshot: JSON.stringify({ nodes: [{ key: 'hash1', kind: 'ACTION' }], edges: [] }),
    });

    expect(result.body).toEqual({
      text: 'This ACTION node calls crypto.hash on the incoming payload.',
      operations: [],
      modelId: 'gpt-test',
    });
    expect(aiManager.processChat).toHaveBeenCalledWith(
      expect.any(Array),
      'gpt-test',
      expect.stringContaining('workflow design assistant'),
    );
  });

  it('includes the workflow snapshot in the user message sent to the model', async () => {
    await service.assist({
      prompt: 'Explain the flow.',
      workflowSnapshot: '{"nodes":[{"key":"a1","kind":"ACTION"}]}',
    });

    const [messages] = vi.mocked(aiManager.processChat).mock.calls[0];
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('"key":"a1"');
    expect(lastMessage.content).toContain('Explain the flow.');
  });

  it('passes through a valid proposed operation from a JSON envelope reply', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      text: 'Adding an END node wired after action1.',
      operations: [
        {
          operationSchemaVersion: '1',
          type: 'ADD_NODE',
          node: { kind: 'END', key: 'end-1', output: { type: 'OBJECT', fields: {} } },
        },
        {
          operationSchemaVersion: '1',
          type: 'ADD_EDGE',
          edge: { key: 'edge-1', fromNodeKey: 'action1', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } },
        },
      ],
    }));

    const result = await service.assist({
      prompt: 'Add an END node after action1.',
      workflowSnapshot: '{"nodes":[{"key":"action1","kind":"ACTION"}]}',
    });

    expect(result.body.text).toBe('Adding an END node wired after action1.');
    expect(result.body.operations).toHaveLength(2);
    expect(result.body.operations[0]).toMatchObject({ type: 'ADD_NODE' });
    expect(result.body.operations[1]).toMatchObject({ type: 'ADD_EDGE' });
  });

  it('understands a JSON envelope wrapped in a markdown code fence', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue([
      '```json',
      JSON.stringify({ text: 'Removing the dead node.', operations: [{ operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey: 'dead1' }] }),
      '```',
    ].join('\n'));

    const result = await service.assist({ prompt: 'Remove dead1.' });

    expect(result.body.text).toBe('Removing the dead node.');
    expect(result.body.operations).toEqual([{ operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey: 'dead1' }]);
  });

  it('drops the whole operations array and keeps only text when an operation fails schema validation (never trust an unvalidated proposal)', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue(JSON.stringify({
      text: 'Here is the change.',
      operations: [
        { operationSchemaVersion: '1', type: 'ADD_NODE', node: { kind: 'NOT_A_REAL_KIND', key: 'x' } },
      ],
    }));

    const result = await service.assist({ prompt: 'Do something weird.' });

    expect(result.body.text).toBe('Here is the change.');
    expect(result.body.operations).toEqual([]);
  });

  it('falls back to raw text when the reply is not valid JSON at all', async () => {
    vi.mocked(aiManager.processChat).mockResolvedValue('  Sure, node1 sends an email to the customer.  ');

    const result = await service.assist({ prompt: 'What does node1 do?' });

    expect(result.body.text).toBe('Sure, node1 sends an email to the customer.');
    expect(result.body.operations).toEqual([]);
  });
});
