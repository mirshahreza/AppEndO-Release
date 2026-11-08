import { describe, expect, it } from 'vitest';
import { computePageLoadProfileTotals } from '../computeTotals';
import type { PageLoadProfileSnapshot } from '../types';

const baseSnapshot = (): PageLoadProfileSnapshot => ({
  pathname: '/iq/demo',
  pageKey: 'demo',
  startedAtMs: 1000,
  navigationPendingAtMs: 900,
  pathnameCommittedAtMs: 1100,
  firstApiAtMs: 1200,
  lastApiAtMs: 4200,
  shellReadyAtMs: 5100,
  revealedAtMs: 5400,
  apiCalls: [
    {
      path: '/api/a',
      durationMs: 300,
      startedAtMs: 1200,
      finishedAtMs: 1500,
      requestId: '1',
      server: { totalMs: 80, dbMs: 40, dbQueries: 2, queries: [] },
    },
    {
      path: '/api/b',
      durationMs: 500,
      startedAtMs: 3700,
      finishedAtMs: 4200,
      requestId: '2',
      server: { totalMs: 120, dbMs: 60, dbQueries: 1, queries: [] },
    },
  ],
});

describe('computePageLoadProfileTotals', () => {
  it('computes wall clock and server/client split', () => {
    const totals = computePageLoadProfileTotals(baseSnapshot());
    expect(totals.wallClockMs).toBeGreaterThanOrEqual(5400 - 900);
    expect(totals.serverHandlerSumMs).toBe(200);
    expect(totals.clientUiWallMs).toBe((1200 - 900) + (5400 - 4200));
    expect(totals.serverPlusClientMs).toBe(totals.serverHandlerSumMs + totals.clientUiWallMs);
    expect(totals.apiPhaseWallMs).toBe(4200 - 1200);
  });
});
