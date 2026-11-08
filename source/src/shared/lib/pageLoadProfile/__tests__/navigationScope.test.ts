import { describe, expect, it } from 'vitest';
import { computePageLoadProfileTotals } from '../computeTotals';
import { scopeSnapshotToNavigation } from '../navigationScope';
import type { PageLoadProfileSnapshot } from '../types';

describe('scopeSnapshotToNavigation', () => {
  it('drops API calls from the previous page load', () => {
    const snapshot: PageLoadProfileSnapshot = {
      pathname: '/studio/roles',
      pageKey: 'roles',
      startedAtMs: 5000,
      navigationPendingAtMs: 4980,
      pathnameCommittedAtMs: 5000,
      firstApiAtMs: 1000,
      lastApiAtMs: 9000,
      shellReadyAtMs: 6200,
      revealedAtMs: 6300,
      apiCalls: [
        {
          path: '/api/users',
          durationMs: 400,
          requestId: null,
          startedAtMs: 1000,
          finishedAtMs: 1400,
          server: null,
        },
        {
          path: '/api/roles',
          durationMs: 120,
          requestId: null,
          startedAtMs: 5100,
          finishedAtMs: 5220,
          server: null,
        },
      ],
    };
    const scoped = scopeSnapshotToNavigation(snapshot);
    expect(scoped.apiCalls.map((call) => call.path)).toEqual(['/api/roles']);
    const totals = computePageLoadProfileTotals(snapshot);
    expect(totals.wallClockMs).toBeLessThan(2000);
    expect(totals.wallClockMs).toBe(1320);
  });
});
