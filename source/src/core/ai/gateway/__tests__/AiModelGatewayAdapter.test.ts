import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { aiManager } from '../../AiManager';
import { aiModelGateway } from '../AiModelGatewayAdapter';
import { getModelGatewayTelemetryRecords, resetModelGatewayTelemetryForTests } from '../../../../shared/lib/appendoo/modelGatewayTelemetry';
import type { AiModelCapabilities, AiModelEntry } from '../../../../shared/api/contracts/ai/types';
import type { ChatMessage } from '../../../../shared/api/contracts/ai/agentTypes';

const TEST_MODEL_CAPABILITIES: AiModelCapabilities = {
  chat: true,
  tools: true,
  streaming: true,
  vision: false,
  embeddings: false,
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
};

const CHAT_MODEL: AiModelEntry = {
  id: 'gpt-test',
  name: 'GPT Test',
  provider: 'openai' as const,
  modelId: 'gpt-4.1',
  enabled: true,
  capabilities: TEST_MODEL_CAPABILITIES,
};

const mockChatWithTools = vi.fn();

vi.mock('../../AiManager', () => ({
  aiManager: {
    resolveModel: vi.fn(),
    processChat: vi.fn(),
  },
}));

describe('AiModelGatewayAdapter', () => {
  beforeEach(() => {
    resetModelGatewayTelemetryForTests();
    mockChatWithTools.mockReset();
    vi.mocked(aiManager.resolveModel).mockReturnValue({
      entry: CHAT_MODEL,
      provider: {
        getProviderName: () => 'openai',
        chatWithTools: mockChatWithTools,
        streamChat: vi.fn(),
      } as never,
    });
    vi.mocked(aiManager.processChat).mockResolvedValue('{"score": 9}');
  });

  it('computes effective capabilities from provider adapter surface', () => {
    const capabilities = aiModelGateway.getEffectiveCapabilities('gpt-test');
    expect(capabilities.effectiveTools).toBe(true);
    expect(capabilities.effectiveStreaming).toBe(true);
  });

  it('rejects TOOL_SESSION when effective tools are unavailable', async () => {
    vi.mocked(aiManager.resolveModel).mockReturnValue({
      entry: { ...CHAT_MODEL, capabilities: { ...TEST_MODEL_CAPABILITIES, tools: true } },
      provider: {
        getProviderName: () => 'openai',
      } as never,
    });

    await expect(aiModelGateway.invokeText({
      messages: [{ role: 'user', content: 'hello' }],
      taskProfile: 'TOOL_SESSION',
    })).rejects.toThrow(/tools/);
  });

  it('retries structured output when schema validation fails', async () => {
    vi.mocked(aiManager.processChat)
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce('{"score": 8}');

    const schema = z.object({ score: z.number().min(1).max(10) });
    const result = await aiModelGateway.invokeStructured({
      messages: [{ role: 'user', content: 'Grade this change' }],
      taskProfile: 'SEMANTIC_GRADE',
      schema,
    });

    expect(result.data.score).toBe(8);
    expect(result.telemetry.attemptCount).toBe(2);
    expect(result.telemetry.invokeKind).toBe('structured');
    expect(aiManager.processChat).toHaveBeenCalledTimes(2);
  });

  it('invokes governed tool sessions and records telemetry', async () => {
    mockChatWithTools.mockResolvedValue({
      text: 'Found 3 files',
      toolCalls: [{ id: 'call-1', name: 'glob_files', args: { pattern: '*.ts' } }],
    });

    const result = await aiModelGateway.invokeToolSession({
      messages: [{ role: 'user', content: 'Find ts files' }],
      tools: [{ name: 'glob_files', description: 'Glob files', parameters: { type: 'object', properties: {} } }],
      taskProfile: 'TOOL_SESSION',
      correlationId: 'corr-1',
    });

    expect(result.text).toBe('Found 3 files');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.telemetry.invokeKind).toBe('tool_session');
    expect(result.telemetry.toolCallCount).toBe(1);
    expect(result.telemetry.promptTemplateId).toBe('appendoo.tool-session');
    expect(getModelGatewayTelemetryRecords().at(-1)?.correlationId).toBe('corr-1');
    expect(mockChatWithTools).toHaveBeenCalledOnce();
  });

  it('rejects tool session when effective tools are unavailable', async () => {
    vi.mocked(aiManager.resolveModel).mockReturnValue({
      entry: { ...CHAT_MODEL, capabilities: { ...TEST_MODEL_CAPABILITIES, tools: true } },
      provider: {
        getProviderName: () => 'openai',
      } as never,
    });

    await expect(aiModelGateway.invokeToolSession({
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      taskProfile: 'TOOL_SESSION',
    })).rejects.toThrow(/tools/);
  });

  it('estimates token counts for a request', () => {
    const estimate = aiModelGateway.estimateRequest({
      messages: [{ role: 'user', content: 'Hello world' } satisfies ChatMessage],
      taskProfile: 'GENERAL_CHAT',
    });

    expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
    expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
  });
});
