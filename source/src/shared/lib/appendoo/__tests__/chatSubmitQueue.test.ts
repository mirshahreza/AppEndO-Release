import { describe, expect, it } from 'vitest';
import {
  appendImmediateUserEcho,
  dequeueSubmitTurn,
  enqueueSubmitTurn,
  formatQueuedSubmitPlaceholder,
  resolveChatSubmitDispatch,
} from '../chatSubmitQueue';

describe('chatSubmitQueue (F.5)', () => {
  it('queues submit while processing instead of blocking', () => {
    expect(resolveChatSubmitDispatch(true)).toBe('queue');
    expect(resolveChatSubmitDispatch(false)).toBe('execute');
  });

  it('echoes user message immediately and enqueues turn metadata', () => {
    const echoed = appendImmediateUserEcho(
      [{ role: 'assistant', content: 'working' }],
      { role: 'user', content: 'second message' },
    );
    expect(echoed.userMessageIndex).toBe(1);
    expect(echoed.nextMessages).toHaveLength(2);
    expect(echoed.nextMessages[1]).toMatchObject({ role: 'user', content: 'second message' });

    const queue = enqueueSubmitTurn([], {
      userMessageIndex: echoed.userMessageIndex,
      trimmedInput: 'second message',
    });
    expect(queue).toHaveLength(1);

    const drained = dequeueSubmitTurn(queue);
    expect(drained.turn).toMatchObject({ trimmedInput: 'second message' });
    expect(drained.queue).toHaveLength(0);
  });

  it('formats queued placeholder for input', () => {
    expect(formatQueuedSubmitPlaceholder(0)).toBe('Ask AppEndO...');
    expect(formatQueuedSubmitPlaceholder(1)).toBe('1 message queued…');
    expect(formatQueuedSubmitPlaceholder(2)).toBe('2 messages queued…');
  });
});
