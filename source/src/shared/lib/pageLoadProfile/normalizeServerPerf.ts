import type { PageLoadProfileDbQuery, PageLoadProfileServerPerf } from './types';

export const buildPageLoadProfileServerPerf = (input: {
  totalMs: number;
  dbMs: number;
  queryCount: number;
  queries: PageLoadProfileDbQuery[];
}): PageLoadProfileServerPerf => {
  const totalMs = Math.max(0, Math.round(input.totalMs));
  const dbMs = Math.max(0, Math.round(input.dbMs));
  const applicationMs = Math.max(0, totalMs - dbMs);
  const queryCount = Math.max(0, Math.round(input.queryCount));
  const queries = input.queries;
  return {
    totalMs,
    dbMs,
    dbQueries: queryCount,
    queries,
    applicationMs,
    sections: {
      database: {
        totalMs: dbMs,
        queryCount,
        queries,
      },
      application: {
        totalMs: applicationMs,
      },
    },
  };
};
