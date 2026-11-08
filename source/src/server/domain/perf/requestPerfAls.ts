import { AsyncLocalStorage } from 'node:async_hooks';

export type RecordedDbQuery = {
  ms: number;
  sql: string;
  source: string;
  rowCount: number | null;
};

export type RequestPerfStore = {
  dbMs: number;
  queryCount: number;
  queries: RecordedDbQuery[];
};

const MAX_QUERIES_PER_REQUEST = 60;
const MAX_SQL_LENGTH = 240;

export const requestPerfAls = new AsyncLocalStorage<RequestPerfStore>();

export const getRequestPerfStore = (): RequestPerfStore | undefined => requestPerfAls.getStore();

export const createRequestPerfStore = (): RequestPerfStore => ({
  dbMs: 0,
  queryCount: 0,
  queries: [],
});

const truncateSql = (sql: string): string => {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SQL_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SQL_LENGTH)}…`;
};

export const recordSequelizeQueryTiming = (
  source: string,
  sql: string,
  timingMs: number | undefined,
): void => {
  const store = getRequestPerfStore();
  if (!store) {
    return;
  }
  store.queryCount += 1;
  const ms = typeof timingMs === 'number' && Number.isFinite(timingMs)
    ? Math.round(timingMs)
    : 0;
  if (ms > 0) {
    store.dbMs += ms;
  }
  if (store.queries.length < MAX_QUERIES_PER_REQUEST) {
    store.queries.push({
      ms,
      sql: truncateSql(sql),
      source,
      rowCount: null,
    });
  }
};

export const recordEdgeDbQueryTiming = (
  source: string,
  operation: string,
  timingMs: number,
  rowCount: number | null,
): void => {
  const store = getRequestPerfStore();
  if (!store) {
    return;
  }
  store.queryCount += 1;
  const ms = Math.max(0, Math.round(timingMs));
  store.dbMs += ms;
  if (store.queries.length < MAX_QUERIES_PER_REQUEST) {
    store.queries.push({
      ms,
      sql: truncateSql(operation),
      source,
      rowCount,
    });
  }
};
