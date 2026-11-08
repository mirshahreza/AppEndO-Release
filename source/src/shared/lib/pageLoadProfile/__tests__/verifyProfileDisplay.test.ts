import { describe, expect, it } from 'vitest';
import type { PageLoadProfileSnapshot } from '../types';
import { verifyPageLoadProfileDisplay } from '../verifyProfileDisplay';

const sampleSnapshot = (): PageLoadProfileSnapshot => ({
  pathname: '/studio/demo',
  pageKey: 'demo',
  startedAtMs: 1000,
  navigationPendingAtMs: 980,
  pathnameCommittedAtMs: 1020,
  firstApiAtMs: 1100,
  lastApiAtMs: 1800,
  shellReadyAtMs: 2100,
  revealedAtMs: 2200,
  apiCalls: [
    {
      path: '/api/data/list',
      durationMs: 420,
      requestId: 'a',
      startedAtMs: 1100,
      finishedAtMs: 1520,
      server: {
        totalMs: 380,
        dbMs: 120,
        dbQueries: 2,
        applicationMs: 260,
        queries: [{ ms: 80, sql: 'SELECT 1', source: 'cp', rowCount: 1 }],
        sections: {
          database: {
            totalMs: 120,
            queryCount: 2,
            queries: [{ ms: 80, sql: 'SELECT 1', source: 'cp', rowCount: 1 }],
          },
          application: { totalMs: 260 },
        },
      },
    },
    {
      path: '/api/boot',
      durationMs: 280,
      requestId: 'b',
      startedAtMs: 1200,
      finishedAtMs: 1480,
      server: {
        totalMs: 240,
        dbMs: 40,
        dbQueries: 1,
        applicationMs: 200,
        queries: [],
        sections: {
          database: { totalMs: 40, queryCount: 1, queries: [] },
          application: { totalMs: 200 },
        },
      },
    },
  ],
});

describe('verifyPageLoadProfileDisplay', () => {
  it('Simple and Advanced totals stay aligned on a complete snapshot', () => {
    const report = verifyPageLoadProfileDisplay(sampleSnapshot());
    expect(report.ok).toBe(true);
    expect(report.totals.wallClockMs).toBe(1220);
    expect(report.wallSplit.clientBeforeMs + report.wallSplit.apiPhaseWallMs + report.wallSplit.clientAfterMs)
      .toBe(report.totals.wallClockMs);
    expect(report.simple.wallClockMs).toBe(report.totals.wallClockMs);
  });
});
