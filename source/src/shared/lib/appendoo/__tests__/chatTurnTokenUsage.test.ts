import { describe, expect, it } from 'vitest';
import {
  computeSessionTokenTotals,
  computeMonotonicSessionTokenTotals,
  ensureStoredMessagesHaveTokenUsage,
  estimateAssistantTurnTokenUsage,
} from '../chatTurnTokenUsage';
import type { AiChatStoredMessage } from '../../../api/contracts/ai/chatHistoryTypes';

describe('chatTurnTokenUsage', () => {
  const messages: AiChatStoredMessage[] = [
    { role: 'user', content: 'Hello there' },
    { role: 'assistant', content: 'Hi back' },
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' },
  ];

  it('estimates per-assistant-turn input and output tokens', () => {
    expect(estimateAssistantTurnTokenUsage(messages, 1)).toEqual({
      inputTokens: 7,
      outputTokens: 6,
    });
    expect(estimateAssistantTurnTokenUsage(messages, 3)).toEqual({
      inputTokens: 21,
      outputTokens: 8,
    });
  });

  it('fills missing assistant token usage and aggregates session totals', () => {
    const withUsage = ensureStoredMessagesHaveTokenUsage(messages);

    expect(withUsage[1]?.tokenUsage).toEqual({ inputTokens: 7, outputTokens: 6 });
    expect(withUsage[3]?.tokenUsage).toEqual({ inputTokens: 21, outputTokens: 8 });
    expect(computeSessionTokenTotals(withUsage)).toEqual({
      totalInputTokens: 28,
      totalOutputTokens: 14,
    });
  });

  it('keeps session totals monotonic when messages are removed', () => {
    const withUsage = ensureStoredMessagesHaveTokenUsage(messages);
    const previousTotals = computeSessionTokenTotals(withUsage);

    const trimmed = withUsage.slice(0, 2);
    const nextTotals = computeMonotonicSessionTokenTotals(
      withUsage,
      trimmed,
      previousTotals,
    );

    expect(nextTotals).toEqual(previousTotals);
  });

  it('adds token deltas when new assistant turns are appended', () => {
    const initial = ensureStoredMessagesHaveTokenUsage(messages.slice(0, 2));
    const initialTotals = computeSessionTokenTotals(initial);
    const extended = ensureStoredMessagesHaveTokenUsage(messages);

    expect(computeMonotonicSessionTokenTotals(
      initial,
      extended,
      initialTotals,
    )).toEqual(computeSessionTokenTotals(extended));
  });

  it('backfills totals for legacy sessions with missing stored totals', () => {
    const prepared = ensureStoredMessagesHaveTokenUsage(messages);

    expect(computeMonotonicSessionTokenTotals(
      messages,
      messages,
      { totalInputTokens: 0, totalOutputTokens: 0 },
    )).toEqual(computeSessionTokenTotals(prepared));
  });
});
