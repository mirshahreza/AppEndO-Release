import { buildPageLoadProfilePhaseRows } from './buildPhaseRows';
import { buildSimplePageLoadProfileSummary } from './buildSimpleSummary';
import { computePageLoadProfileTotals, computePageLoadProfileWallSplit } from './computeTotals';
import { isHttpApiRequestPath } from './httpApiPath';
import { reconcileSnapshotWithResourceTiming } from './reconcileResourceTiming';
import type { PageLoadProfileSnapshot } from './types';

export type PageLoadProfileVerifyIssue = {
  code: string;
  message: string;
  expected?: number;
  actual?: number;
};

export type PageLoadProfileVerifyReport = {
  ok: boolean;
  issues: PageLoadProfileVerifyIssue[];
  totals: ReturnType<typeof computePageLoadProfileTotals>;
  simple: ReturnType<typeof buildSimplePageLoadProfileSummary>;
  wallSplit: ReturnType<typeof computePageLoadProfileWallSplit>;
};

const within = (a: number, b: number, toleranceMs = 2): boolean => Math.abs(a - b) <= toleranceMs;

/** Cross-check numbers shown in Simple vs Advanced against the same snapshot math. */
export const verifyPageLoadProfileDisplay = (
  rawSnapshot: PageLoadProfileSnapshot,
): PageLoadProfileVerifyReport => {
  const issues: PageLoadProfileVerifyIssue[] = [];
  const totals = computePageLoadProfileTotals(rawSnapshot);
  const simple = buildSimplePageLoadProfileSummary(rawSnapshot);
  const wallSplit = computePageLoadProfileWallSplit(rawSnapshot);
  const snapshot = reconcileSnapshotWithResourceTiming(rawSnapshot);
  const phases = buildPageLoadProfilePhaseRows(rawSnapshot);

  if (!within(simple.wallClockMs, totals.wallClockMs)) {
    issues.push({
      code: 'simple-total-mismatch',
      message: 'Simple total wall clock must match Advanced totals.',
      expected: totals.wallClockMs,
      actual: simple.wallClockMs,
    });
  }

  const bucketSum = simple.buckets.reduce((sum, bucket) => sum + bucket.durationMs, 0);
  if (!within(bucketSum, totals.wallClockMs)) {
    issues.push({
      code: 'simple-buckets-sum',
      message: 'Simple bucket durations should sum to total wall clock.',
      expected: totals.wallClockMs,
      actual: bucketSum,
    });
  }

  const splitSum = wallSplit.clientBeforeMs + wallSplit.apiPhaseWallMs + wallSplit.clientAfterMs;
  if (!within(splitSum, totals.wallClockMs)) {
    issues.push({
      code: 'wall-split-sum',
      message: 'Client before + API window + client after should equal wall clock.',
      expected: totals.wallClockMs,
      actual: splitSum,
    });
  }

  const totalPhase = phases.find((row) => row.id === 'total');
  if (totalPhase?.durationMs != null && !within(totalPhase.durationMs, totals.wallClockMs)) {
    issues.push({
      code: 'phase-total-mismatch',
      message: 'Advanced phase total row must match totals.wallClockMs.',
      expected: totals.wallClockMs,
      actual: totalPhase.durationMs,
    });
  }

  const apiSpan = phases.find((row) => row.id === 'api-span');
  if (apiSpan?.durationMs != null && !within(apiSpan.durationMs, totals.apiPhaseWallMs)) {
    issues.push({
      code: 'phase-api-span',
      message: 'API span phase must match apiPhaseWallMs.',
      expected: totals.apiPhaseWallMs,
      actual: apiSpan.durationMs,
    });
  }

  const handlerSum = snapshot.apiCalls.reduce((sum, call) => sum + (call.server?.totalMs ?? 0), 0);
  if (!within(handlerSum, totals.serverHandlerSumMs)) {
    issues.push({
      code: 'server-handler-sum',
      message: 'Server handler sum must match API rows.',
      expected: totals.serverHandlerSumMs,
      actual: handlerSum,
    });
  }

  const dbSum = snapshot.apiCalls.reduce(
    (sum, call) => sum + (call.server?.dbMs ?? 0),
    0,
  );
  if (!within(dbSum, totals.serverDbSumMs)) {
    issues.push({
      code: 'server-db-sum',
      message: 'Database sum must match API rows.',
      expected: totals.serverDbSumMs,
      actual: dbSum,
    });
  }

  const httpCalls = snapshot.apiCalls.filter((call) => isHttpApiRequestPath(call.path));
  if (simple.slowestApi && httpCalls.length > 0) {
    const maxNetwork = Math.max(...httpCalls.map((call) => call.durationMs));
    if (simple.slowestApi.durationMs !== maxNetwork) {
      issues.push({
        code: 'slowest-api',
        message: 'Simple slowest API must match max network duration in snapshot.',
        expected: maxNetwork,
        actual: simple.slowestApi.durationMs,
      });
    }
  }

  if (typeof performance !== 'undefined' && httpCalls.length > 0) {
    for (const call of httpCalls) {
      let bestDelta = Infinity;
      for (const entry of performance.getEntriesByType('resource')) {
        const resource = entry as PerformanceResourceTiming;
        if (!resource.name.includes(call.path.split('?')[0])) {
          continue;
        }
        const delta = Math.abs(Math.round(resource.duration) - call.durationMs);
        if (delta < bestDelta) {
          bestDelta = delta;
        }
      }
      if (Number.isFinite(bestDelta) && bestDelta > 50) {
        issues.push({
          code: 'resource-timing-drift',
          message: `Network ms for ${call.path} differs from PerformanceResourceTiming by more than 50ms.`,
          expected: call.durationMs,
          actual: call.durationMs + bestDelta,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    totals,
    simple,
    wallSplit,
  };
};
