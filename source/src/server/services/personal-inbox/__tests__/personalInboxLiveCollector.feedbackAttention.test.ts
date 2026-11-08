import { describe, expect, it } from 'vitest';
import { resolveFeedbackInboxAttention } from '../personalInboxLiveCollector';

describe('resolveFeedbackInboxAttention', () => {
  const key = 'feedback:12';
  const seen = new Set(['feedback:12']);

  it('returns none when inbox seen row exists', () => {
    expect(resolveFeedbackInboxAttention(key, { unreadCount: 3, messageCount: 3 }, seen)).toBe('none');
  });

  it('returns unread when thread has unread messages and not seen', () => {
    expect(resolveFeedbackInboxAttention(key, { unreadCount: 2, messageCount: 2 }, new Set())).toBe('unread');
  });

  it('returns unread when thread is fully read in cursor but inbox not dismissed (submitter-only)', () => {
    expect(resolveFeedbackInboxAttention(key, { unreadCount: 0, messageCount: 1 }, new Set())).toBe('unread');
  });

  it('returns none when not seen but no messages', () => {
    expect(resolveFeedbackInboxAttention(key, { unreadCount: 0, messageCount: 0 }, new Set())).toBe('none');
  });
});
