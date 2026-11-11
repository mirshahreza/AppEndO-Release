import { describe, expect, it } from 'vitest';
import type { AiChatSessionAdminSummary } from '@/src/shared/api/contracts/ai/chatHistoryTypes';
import { DEFAULT_AGENT_CAPABILITY_SCOPE } from '@/src/shared/api/contracts/ai/capabilityPacks';
import {
  formatChatSessionTokenTotals,
  formatDateYmd,
  getMutationError,
  matchesChatHistorySearch,
  sortChatHistorySessions,
} from '../utils';

const sampleSession = (overrides: Partial<AiChatSessionAdminSummary> = {}): AiChatSessionAdminSummary => ({
  id: 12,
  userId: 3,
  username: 'admin',
  title: 'Users CRUD draft',
  modelId: 'gemini-2-5-flash',
  agentCapabilityScope: DEFAULT_AGENT_CAPABILITY_SCOPE,
  messageCount: 8,
  totalInputTokens: 1200,
  totalOutputTokens: 450,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-15T14:30:00.000Z',
  userDeleted: false,
  ...overrides,
});

describe('chat-history utils', () => {
  it('formats dates as YYYY-MM-DD', () => {
    expect(formatDateYmd('2026-06-15T14:30:00.000Z')).toBe('2026-06-15');
    expect(formatDateYmd(null)).toBe('-');
    expect(formatDateYmd('invalid')).toBe('-');
  });

  it('extracts mutation errors', () => {
    expect(getMutationError({ success: true }, 'fallback')).toBeNull();
    expect(getMutationError({ success: false, error: 'Denied' }, 'fallback')).toBe('Denied');
    expect(getMutationError({ success: false }, 'fallback')).toBe('fallback');
  });

  it('matches search across title, username, ids, and model', () => {
    const session = sampleSession();
    expect(matchesChatHistorySearch(session, '')).toBe(true);
    expect(matchesChatHistorySearch(session, 'crud')).toBe(true);
    expect(matchesChatHistorySearch(session, 'admin')).toBe(true);
    expect(matchesChatHistorySearch(session, '12')).toBe(true);
    expect(matchesChatHistorySearch(session, 'gemini')).toBe(true);
    expect(matchesChatHistorySearch(session, 'missing-term')).toBe(false);
  });

  it('formats session token totals for admin surfaces', () => {
    expect(formatChatSessionTokenTotals(sampleSession())).toBe('In ~1.2 · Out ~0.5');
    expect(formatChatSessionTokenTotals(sampleSession({ totalInputTokens: 0, totalOutputTokens: 0 }))).toBe('-');
  });

  it('sorts sessions by supported fields and direction', () => {
    const sessions = [
      sampleSession({ id: 2, title: 'Beta', username: 'bob', updatedAt: '2026-06-01T00:00:00.000Z' }),
      sampleSession({ id: 1, title: 'Alpha', username: 'amy', updatedAt: '2026-06-20T00:00:00.000Z' }),
    ];

    const byTitleAsc = sortChatHistorySessions(sessions, 'title', 'asc');
    expect(byTitleAsc.map((item) => item.title)).toEqual(['Alpha', 'Beta']);

    const byUpdatedDesc = sortChatHistorySessions(sessions, 'updated_at', 'desc');
    expect(byUpdatedDesc[0]?.id).toBe(1);

    const byIdAsc = sortChatHistorySessions(sessions, 'id', 'asc');
    expect(byIdAsc.map((item) => item.id)).toEqual([1, 2]);
  });
});
