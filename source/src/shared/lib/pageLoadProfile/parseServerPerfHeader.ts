import { buildPageLoadProfileServerPerf } from './normalizeServerPerf';
import type { PageLoadProfileDbQuery, PageLoadProfileServerPerf } from './types';

const HEADER_NAME = 'x-appendo-server-perf';

const parseQueryRow = (row: unknown): PageLoadProfileDbQuery | null => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  const ms = Number(record.ms);
  const sql = typeof record.sql === 'string' ? record.sql : '';
  const source = typeof record.source === 'string' ? record.source : 'unknown';
  const rowCountRaw = record.rowCount;
  const rowCount = rowCountRaw == null ? null : Number(rowCountRaw);
  if (!Number.isFinite(ms) || !sql) {
    return null;
  }
  return {
    ms: Math.round(ms),
    sql,
    source,
    rowCount: rowCount != null && Number.isFinite(rowCount) ? Math.round(rowCount) : null,
  };
};

export const parseServerPerfHeader = (response: Response): PageLoadProfileServerPerf | null => {
  if (typeof response.headers?.get !== 'function') {
    return null;
  }
  const raw = response.headers.get(HEADER_NAME);
  if (!raw) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const totalMs = Number(parsed.totalMs);
    const dbMs = Number(parsed.dbMs);
    const dbQueries = Number(parsed.dbQueries);
    if (!Number.isFinite(totalMs)) {
      return null;
    }
    const queriesRaw = Array.isArray(parsed.queries) ? parsed.queries : [];
    const sectionsRaw = parsed.sections;
    if (sectionsRaw && typeof sectionsRaw === 'object') {
      const sections = sectionsRaw as Record<string, unknown>;
      const databaseRaw = sections.database;
      const applicationRaw = sections.application;
      const database = databaseRaw && typeof databaseRaw === 'object'
        ? databaseRaw as Record<string, unknown>
        : null;
      const application = applicationRaw && typeof applicationRaw === 'object'
        ? applicationRaw as Record<string, unknown>
        : null;
      const dbSectionMs = database ? Number(database.totalMs) : dbMs;
      const queryCountRaw = database ? Number(database.queryCount) : dbQueries;
      const sectionQueriesRaw = database && Array.isArray(database.queries) ? database.queries : queriesRaw;
      const sectionQueries = sectionQueriesRaw
        .map(parseQueryRow)
        .filter((item): item is PageLoadProfileDbQuery => item != null);
      const appSectionMs = application ? Number(application.totalMs) : NaN;
      const normalized = buildPageLoadProfileServerPerf({
        totalMs,
        dbMs: Number.isFinite(dbSectionMs) ? dbSectionMs : 0,
        queryCount: Number.isFinite(queryCountRaw) ? queryCountRaw : sectionQueries.length,
        queries: sectionQueries,
      });
      if (Number.isFinite(appSectionMs) && appSectionMs >= 0) {
        return {
          ...normalized,
          applicationMs: Math.round(appSectionMs),
          sections: {
            ...normalized.sections,
            application: { totalMs: Math.round(appSectionMs) },
          },
        };
      }
      return normalized;
    }

    const queries = queriesRaw
      .map(parseQueryRow)
      .filter((item): item is PageLoadProfileDbQuery => item != null);
    return buildPageLoadProfileServerPerf({
      totalMs,
      dbMs: Number.isFinite(dbMs) ? dbMs : 0,
      queryCount: Number.isFinite(dbQueries) ? dbQueries : queries.length,
      queries,
    });
  } catch {
    return null;
  }
};
