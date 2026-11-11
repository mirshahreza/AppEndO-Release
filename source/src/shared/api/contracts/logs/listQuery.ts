import type { GridQueryState } from '../../../lib/appTableGridQuery';
import type { LogLevel } from './types';

export type LogsListQuery = {
  limit: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  level?: LogLevel | LogLevel[];
  actor?: string;
  context?: string;
  folder?: string;
  functionName?: string;
  key?: string;
  timestampFrom?: string;
  timestampTo?: string;
  duration?: string;
    callSuccess?: 'true' | 'false';
  requestId?: string;
  includeArchived?: boolean;
  offset?: number;
  where?: string;
};

const SORT_FIELDS = new Set([
  'level',
  'actor',
  'context',
  'folder',
  'functionName',
  'key',
  'timestamp',
  'durationMs',
  'callSuccess',
]);

const LOG_LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR']);

function parseSortDir(raw: unknown): 'asc' | 'desc' | undefined {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'asc') return 'asc';
  if (value === 'desc') return 'desc';
  return undefined;
}

export function parseLogsListQuery(raw: Record<string, unknown>): LogsListQuery {
  const limitRaw = Number(raw.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 5000) : 200;

  const sortBy = String(raw.sortBy ?? '').trim();
  const sortDir = parseSortDir(raw.sortDir ?? raw.sortDirection);

  const levelRaw = raw.level;
  let level: LogLevel | LogLevel[] | undefined;
  if (Array.isArray(levelRaw)) {
    const levels = levelRaw
      .map((item) => String(item).trim().toUpperCase())
      .filter((item): item is LogLevel => LOG_LEVELS.has(item as LogLevel));
    if (levels.length > 0) {
      level = levels;
    }
  } else if (typeof levelRaw === 'string' && levelRaw.trim()) {
    const values = levelRaw.split(',').map((item) => item.trim().toUpperCase());
    const levels = values.filter((item): item is LogLevel => LOG_LEVELS.has(item as LogLevel));
    if (levels.length === 1) {
      level = levels[0];
    } else if (levels.length > 1) {
      level = levels;
    }
  }

  const callSuccessRaw = String(raw.callSuccess ?? '').trim().toLowerCase();
  const callSuccess = callSuccessRaw === 'true' || callSuccessRaw === 'false'
    ? callSuccessRaw
    : undefined;

  return {
    limit,
    sortBy: SORT_FIELDS.has(sortBy) ? sortBy : undefined,
    sortDir,
    level,
    actor: String(raw.actor ?? '').trim() || undefined,
    context: String(raw.context ?? '').trim() || undefined,
    folder: String(raw.folder ?? '').trim() || undefined,
    functionName: String(raw.functionName ?? raw.function ?? '').trim() || undefined,
    key: String(raw.key ?? '').trim() || undefined,
    timestampFrom: String(raw.timestampFrom ?? '').trim() || undefined,
    timestampTo: String(raw.timestampTo ?? '').trim() || undefined,
    duration: String(raw.duration ?? '').trim() || undefined,
    callSuccess,
    requestId: String(raw.requestId ?? '').trim() || undefined,
    includeArchived: String(raw.includeArchived ?? '').trim() === '1'
      || String(raw.includeArchived ?? '').toLowerCase() === 'true',
    offset: Number.isFinite(Number(raw.offset)) && Number(raw.offset) >= 0
      ? Math.floor(Number(raw.offset))
      : undefined,
    where: String(raw.where ?? '').trim() || undefined,
  };
}

export function mapGridQueryToLogsListQuery(
  query: GridQueryState,
  limit: number,
): LogsListQuery {
  const params: LogsListQuery = { limit };

  if (query.sort) {
    params.sortBy = query.sort.columnId;
    params.sortDir = query.sort.direction;
  }

  for (const [columnId, filter] of Object.entries(query.filters)) {
    if (filter.type === 'text') {
      if (columnId === 'actor') params.actor = filter.value;
      if (columnId === 'context') params.context = filter.value;
      if (columnId === 'folder') params.folder = filter.value;
      if (columnId === 'functionName') params.functionName = filter.value;
      if (columnId === 'key') params.key = filter.value;
      if (columnId === 'durationMs') params.duration = filter.value;
    }
    if (filter.type === 'select' && columnId === 'level') {
      const values = Array.isArray(filter.value)
        ? filter.value
        : filter.value
          ? [filter.value]
          : [];
      const levels = values
        .map((value) => String(value).trim().toUpperCase())
        .filter((value): value is LogLevel => LOG_LEVELS.has(value as LogLevel));
      if (levels.length === 1) {
        params.level = levels[0];
      } else if (levels.length > 1) {
        params.level = levels;
      }
    }
    if (filter.type === 'boolean' && columnId === 'callSuccess') {
      if (filter.value === 'true' || filter.value === 'false') {
        params.callSuccess = filter.value;
      }
    }
    if (filter.type === 'dateRange' && columnId === 'timestamp') {
      params.timestampFrom = filter.from ?? undefined;
      params.timestampTo = filter.to ?? undefined;
    }
  }

  return params;
}
