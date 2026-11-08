import { describe, expect, it } from 'vitest';
import { parseServerPerfHeader } from '../parseServerPerfHeader';

describe('parseServerPerfHeader', () => {
  it('parses encoded perf payload with database and application sections', () => {
    const query = { ms: 45, sql: 'SELECT 1', source: 'control-plane', rowCount: 1 };
    const payload = encodeURIComponent(JSON.stringify({
      totalMs: 120,
      sections: {
        database: { totalMs: 45, queryCount: 1, queries: [query] },
        application: { totalMs: 75 },
      },
      dbMs: 45,
      dbQueries: 1,
      queries: [query],
    }));
    const response = new Response(null, {
      headers: { 'x-appendo-server-perf': payload },
    });
    expect(parseServerPerfHeader(response)).toEqual({
      totalMs: 120,
      dbMs: 45,
      dbQueries: 1,
      applicationMs: 75,
      queries: [query],
      sections: {
        database: { totalMs: 45, queryCount: 1, queries: [query] },
        application: { totalMs: 75 },
      },
    });
  });

  it('parses legacy flat perf payload', () => {
    const query = { ms: 45, sql: 'SELECT 1', source: 'control-plane', rowCount: 1 };
    const payload = encodeURIComponent(JSON.stringify({
      totalMs: 120,
      dbMs: 45,
      dbQueries: 1,
      queries: [query],
    }));
    const response = new Response(null, {
      headers: { 'x-appendo-server-perf': payload },
    });
    expect(parseServerPerfHeader(response)).toMatchObject({
      totalMs: 120,
      applicationMs: 75,
      sections: {
        database: { totalMs: 45, queryCount: 1 },
        application: { totalMs: 75 },
      },
    });
  });

  it('returns null when header is missing', () => {
    const response = new Response(null);
    expect(parseServerPerfHeader(response)).toBeNull();
  });
});
