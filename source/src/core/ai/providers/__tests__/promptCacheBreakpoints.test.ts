import { describe, expect, it } from 'vitest';
import type { ChatWithToolsMessage } from '../../IAiProvider';
import { computeCacheBreakpointIndexes } from '../promptCacheBreakpoints';

const user = (content: string): ChatWithToolsMessage => ({ role: 'user', content });
const assistant = (content: string): ChatWithToolsMessage => ({ role: 'assistant', content });
const assistantWithTools = (content: string): ChatWithToolsMessage => ({
  role: 'assistant',
  content,
  toolCalls: [{ id: 'call-1', name: 'read_file', args: {} }],
});
const toolResult = (content: string): ChatWithToolsMessage => ({
  role: 'tool',
  content,
  toolCallId: 'call-1',
});

describe('computeCacheBreakpointIndexes', () => {
  it('returns nothing for an empty budget or empty conversation', () => {
    expect(computeCacheBreakpointIndexes([user('hi')], 0).size).toBe(0);
    expect(computeCacheBreakpointIndexes([], 3).size).toBe(0);
  });

  it('anchors the current user message on a fresh turn', () => {
    const messages = [user('build a page')];
    expect([...computeCacheBreakpointIndexes(messages, 3)]).toEqual([0]);
  });

  it('anchors the last tool result of each round during an agent loop', () => {
    const messages = [
      user('build a page'),        // 0
      assistantWithTools(''),      // 1
      toolResult('round 1 result'), // 2
      assistantWithTools(''),      // 3
      toolResult('round 2 result'), // 4
    ];
    const flagged = computeCacheBreakpointIndexes(messages, 3);
    // Newest tool results first, then the turn's user message.
    expect(flagged).toEqual(new Set([4, 2, 0]));
  });

  it('uses terminal assistant messages as anchors above the current user message', () => {
    const messages = [
      user('first question'),      // 0
      assistant('first answer'),   // 1
      user('second question'),     // 2
    ];
    const flagged = computeCacheBreakpointIndexes(messages, 3);
    expect(flagged.has(2)).toBe(true);  // current user message
    expect(flagged.has(1)).toBe(true);  // previous terminal assistant message
  });

  it('never exceeds the breakpoint budget', () => {
    const messages: ChatWithToolsMessage[] = [user('q')];
    for (let i = 0; i < 10; i += 1) {
      messages.push(assistantWithTools(''), toolResult(`round ${i}`));
    }
    expect(computeCacheBreakpointIndexes(messages, 3).size).toBe(3);
  });

  it('skips system and empty messages', () => {
    const messages: ChatWithToolsMessage[] = [
      { role: 'system', content: 'system prompt' },
      user('  '),
      user('real question'),
    ];
    expect([...computeCacheBreakpointIndexes(messages, 4)]).toEqual([2]);
  });
});
