import { describe, expect, it, vi } from 'vitest';
import { resolveSegmentHistorySummary, shouldBuildSegmentHistorySummary, summarizeHistoryWithLlm } from '../historySegmentSummary';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { AgentMessage } from '../types';
import type { IAiProvider } from '../../IAiProvider';

const buildMessages = (count: number): AgentMessage[] => (
  Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index}`,
  }))
);

describe('historySegmentSummary (TOK-15)', () => {
  it('uses heuristic when LLM flag is off (forced by the orchestrator under token pressure)', async () => {
    const messages = buildMessages(60);
    const summary = await resolveSegmentHistorySummary(messages, {
      mode: 'agent',
      agentSettings: {
        ...DEFAULT_AI_AGENT_SETTINGS,
        contextSummarizeAfterTurns: 8,
        contextSummarizeWithLlm: false,
      },
    }, { force: true });

    expect(summary).toContain('message-0');
    expect(summary).not.toContain('message-59');
  });

  it('uses LLM summary when enabled and falls back on failure', async () => {
    const messages = buildMessages(60);
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn()
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValueOnce('LLM-compressed history'),
    };

    const failed = await resolveSegmentHistorySummary(messages, {
      mode: 'agent',
      agentSettings: {
        ...DEFAULT_AI_AGENT_SETTINGS,
        contextSummarizeAfterTurns: 8,
        contextSummarizeWithLlm: true,
      },
    }, { provider, force: true });
    expect(failed).toContain('message-0');

    const llm = await resolveSegmentHistorySummary(messages, {
      mode: 'agent',
      agentSettings: {
        ...DEFAULT_AI_AGENT_SETTINGS,
        contextSummarizeAfterTurns: 8,
        contextSummarizeWithLlm: true,
      },
    }, { provider, force: true });
    expect(llm).toBe('LLM-compressed history');
  });

  it('does not build a summary on message count alone — token pressure only (p-61 Phase C)', () => {
    const messages = buildMessages(60);
    const shouldBuild = shouldBuildSegmentHistorySummary(messages, {
      mode: 'agent',
      agentSettings: { ...DEFAULT_AI_AGENT_SETTINGS, contextSummarizeAfterTurns: 8 },
    });
    expect(shouldBuild).toBe(false);
  });

  it('returns persisted summary when under threshold', async () => {
    const summary = await resolveSegmentHistorySummary(buildMessages(4), {
      mode: 'agent',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      persistedHistorySummary: 'Stored segment H',
    });
    expect(summary).toBe('Stored segment H');
  });

  it('triggers summary when token pressure is high (C.4)', () => {
    const messages = buildMessages(6);
    const shouldBuild = shouldBuildSegmentHistorySummary(messages, {
      mode: 'agent',
      agentSettings: { ...DEFAULT_AI_AGENT_SETTINGS, contextSummarizeAfterTurns: 99 },
    }, {
      tokensEstimate: 80_000,
      tokensBudget: 100_000,
    });
    expect(shouldBuild).toBe(true);
  });
});

describe('summarizeHistoryWithLlm', () => {
  it('truncates oversized LLM output', async () => {
    const provider: IAiProvider = {
      getProviderName: () => 'mock',
      chat: vi.fn().mockResolvedValue('x'.repeat(5000)),
    };
    const messages = buildMessages(12);
    const summary = await summarizeHistoryWithLlm(messages, provider, 100);
    expect(summary.length).toBeLessThanOrEqual(101);
    expect(summary.endsWith('…')).toBe(true);
  });
});
