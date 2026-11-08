import type { AiChatSessionAdminSummary } from '../../shared/api/contracts/ai/chatHistoryTypes';
import { formatApproxTokensK, formatSessionTokenTotalsLabel } from '../../shared/lib/appendoo/chatTurnTokenUsage';

import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';

export const formatDateYmd = (value?: string | null) => formatDisplayDateYmd(value);

export const formatChatSessionTokenTotals = (
  session: Pick<AiChatSessionAdminSummary, 'totalInputTokens' | 'totalOutputTokens'>,
): string => (
  formatSessionTokenTotalsLabel(session) ?? '-'
);

export const formatChatSessionTokenCount = (tokens: number): string => (
  formatApproxTokensK(tokens)
);

export const getMutationError = (
  data: { success?: boolean; error?: string },
  fallback: string,
): string | null => {
  if (data.success) {
    return null;
  }
  return typeof data.error === 'string' ? data.error : fallback;
};

export const matchesChatHistorySearch = (
  session: AiChatSessionAdminSummary,
  query: string,
): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    session.title.toLowerCase().includes(needle)
    || session.username.toLowerCase().includes(needle)
    || String(session.id).includes(needle)
    || String(session.userId).includes(needle)
    || (session.modelId?.toLowerCase().includes(needle) ?? false)
  );
};

export const sortChatHistorySessions = (
  sessions: AiChatSessionAdminSummary[],
  sortBy: string,
  sortDirection: 'asc' | 'desc',
): AiChatSessionAdminSummary[] => {
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...sessions].sort((left, right) => {
    const compareText = (a: string, b: string) => a.localeCompare(b) * direction;
    const compareNumber = (a: number, b: number) => (a - b) * direction;

    switch (sortBy) {
      case 'title':
        return compareText(left.title, right.title);
      case 'username':
        return compareText(left.username, right.username);
      case 'created_at':
        return compareText(left.createdAt, right.createdAt);
      case 'id':
        return compareNumber(left.id, right.id);
      case 'updated_at':
      default:
        return compareText(left.updatedAt, right.updatedAt);
    }
  });
};
