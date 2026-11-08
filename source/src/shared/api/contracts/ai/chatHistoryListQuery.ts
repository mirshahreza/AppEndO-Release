export type ChatSessionListQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export const CHAT_SESSION_DEFAULT_PAGE_SIZE = 50;
export const CHAT_SESSION_MAX_PAGE_SIZE = 200;

const SORT_FIELDS = new Set(['updated_at', 'created_at', 'title', 'username', 'id']);
const DEFAULT_PAGE_SIZE = CHAT_SESSION_DEFAULT_PAGE_SIZE;
const MAX_PAGE_SIZE = CHAT_SESSION_MAX_PAGE_SIZE;

function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseSortDir(raw: unknown): 'asc' | 'desc' | undefined {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'asc') return 'asc';
  if (value === 'desc') return 'desc';
  return undefined;
}

export function parseChatSessionListQuery(raw: Record<string, unknown>): ChatSessionListQuery {
  const sortBy = String(raw.sortBy ?? raw.sort_by ?? '').trim();
  const sortDir = parseSortDir(raw.sortDir ?? raw.sort_dir ?? raw.sortDirection);

  return {
    search: String(raw.q ?? raw.search ?? '').trim() || undefined,
    page: parsePositiveInt(raw.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: parsePositiveInt(raw.pageSize ?? raw.page_size ?? raw.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    sortBy: SORT_FIELDS.has(sortBy) ? sortBy : undefined,
    sortDir,
  };
}

export function appendChatSessionListParams(searchParams: URLSearchParams, query: ChatSessionListQuery) {
  if (query.search?.trim()) searchParams.set('q', query.search.trim());
  if (query.sortBy) searchParams.set('sortBy', query.sortBy);
  if (query.sortDir) searchParams.set('sortDir', query.sortDir);
  if (query.page != null) searchParams.set('page', String(query.page));
  if (query.pageSize != null) searchParams.set('pageSize', String(query.pageSize));
}
