import { describe, expect, it, vi, beforeEach } from 'vitest';
import { aiClassifyExecutor } from '../aiActions';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, getActionDefinition } from '../../registry';

vi.mock('../../../../../../core/ai/gateway/AiModelGatewayAdapter', () => ({
  aiModelGateway: {
    invokeStructured: vi.fn(),
    invokeText: vi.fn(),
  },
}));

import { aiModelGateway } from '../../../../../../core/ai/gateway/AiModelGatewayAdapter';

const invokeStructuredMock = vi.mocked(aiModelGateway.invokeStructured);

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('ai.classify (text+labels convenience)', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
    invokeStructuredMock.mockReset();
  });

  it('is registered AVAILABLE', () => {
    expect(getActionDefinition('ai.classify', '1')?.definition.availability).toBe('AVAILABLE');
  });

  it('classifies text into an allowed label', async () => {
    invokeStructuredMock.mockResolvedValue({ data: { label: 'HIGH' } } as never);
    const result = await aiClassifyExecutor.execute(fakeContext, {}, {
      text: 'Production is down',
      labels: ['LOW', 'MEDIUM', 'HIGH'],
    });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { label: 'HIGH' } });
    expect(invokeStructuredMock).toHaveBeenCalled();
    const messages = invokeStructuredMock.mock.calls[0]![0].messages;
    expect(messages.some((m) => m.role === 'user' && String(m.content).includes('Production is down'))).toBe(true);
  });

  it('normalizes case-insensitive labels', async () => {
    invokeStructuredMock.mockResolvedValue({ data: { label: 'high' } } as never);
    const result = await aiClassifyExecutor.execute(fakeContext, {}, {
      text: 'urgent',
      labels: ['LOW', 'HIGH'],
    });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { label: 'HIGH' } });
  });

  it('fails when model invents a label', async () => {
    invokeStructuredMock.mockResolvedValue({ data: { label: 'CRITICAL' } } as never);
    const result = await aiClassifyExecutor.execute(fakeContext, {}, {
      text: 'x',
      labels: ['LOW', 'HIGH'],
    });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'AI_CLASSIFY_LABEL_INVALID' });
  });

  it('fails without prompt or text+labels', async () => {
    const result = await aiClassifyExecutor.execute(fakeContext, {}, { text: 'only text' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'AI_INVALID_INPUT' });
  });
});
