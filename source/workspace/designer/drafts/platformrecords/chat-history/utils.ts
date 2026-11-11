import type { AiChatSessionAdminSummary } from '@/src/shared/api/contracts/ai/chatHistoryTypes';
import { formatApproxTokensK, formatSessionTokenTotalsLabel } from '@/src/shared/lib/appendoo/chatTurnTokenUsage';

export const formatDateYmd = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 10);
};

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
