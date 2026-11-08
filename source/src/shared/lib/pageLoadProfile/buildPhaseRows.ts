import { computePageLoadProfileTotals } from './computeTotals';
import { PAGE_LOAD_PROFILE_COPY as COPY } from './pageLoadProfileCopy';
import { scopeSnapshotToNavigation } from './navigationScope';
import { reconcileSnapshotWithResourceTiming } from './reconcileResourceTiming';
import type { PageLoadProfileDbQuery, PageLoadProfilePhaseRow, PageLoadProfileSnapshot } from './types';

const phaseDuration = (start: number | null, end: number | null): number | null => {
  if (start == null || end == null) {
    return null;
  }
  return Math.max(0, Math.round(end - start));
};

const collectSlowestScriptResourceMs = (sinceMs: number): number | null => {
  if (typeof performance === 'undefined') {
    return null;
  }
  let max = 0;
  for (const entry of performance.getEntriesByType('resource')) {
    const resource = entry as PerformanceResourceTiming;
    if (resource.startTime + 5 < sinceMs) {
      continue;
    }
    const isScript = resource.initiatorType === 'script'
      || /\.m?js(\?|$)/i.test(resource.name);
    if (!isScript) {
      continue;
    }
    if (resource.duration > max) {
      max = resource.duration;
    }
  }
  return max > 0 ? Math.round(max) : null;
};

export const collectAllDbQueries = (snapshot: PageLoadProfileSnapshot): PageLoadProfileDbQuery[] => {
  const rows: PageLoadProfileDbQuery[] = [];
  for (const call of snapshot.apiCalls) {
    if (call.server?.queries?.length) {
      rows.push(...call.server.queries);
    }
  }
  return rows.sort((a, b) => b.ms - a.ms);
};

export const buildPageLoadProfilePhaseRows = (
  rawSnapshot: PageLoadProfileSnapshot,
): PageLoadProfilePhaseRow[] => {
  const snapshot = reconcileSnapshotWithResourceTiming(scopeSnapshotToNavigation(rawSnapshot));
  const totals = computePageLoadProfileTotals(rawSnapshot);
  const origin = snapshot.startedAtMs;
  const committed = snapshot.pathnameCommittedAtMs ?? origin;
  const firstApi = snapshot.firstApiAtMs;
  const lastApi = snapshot.lastApiAtMs;
  const shellReady = snapshot.shellReadyAtMs;
  const revealed = snapshot.revealedAtMs;

  const apiWallMs = snapshot.apiCalls.reduce((max, call) => Math.max(max, call.durationMs), 0);
  const serverDbQueries = snapshot.apiCalls.reduce(
    (sum, call) => sum + (call.server?.dbQueries ?? 0),
    0,
  );

  const jsChunkMs = collectSlowestScriptResourceMs(origin);
  const reactShellMs = phaseDuration(lastApi ?? committed, shellReady);
  const coverExitMs = shellReady != null && revealed != null
    ? phaseDuration(shellReady, revealed)
    : null;

  return [
    {
      id: 'nav-click',
      label: COPY.phaseNavPending,
      durationMs: phaseDuration(origin, snapshot.navigationPendingAtMs ?? committed),
    },
    {
      id: 'route-first-api',
      label: COPY.phaseRouteCommit,
      durationMs: phaseDuration(committed, firstApi),
    },
    {
      id: 'api-span',
      label: COPY.phaseApiSpan,
      durationMs: totals.apiPhaseWallMs > 0 ? totals.apiPhaseWallMs : null,
      detail: snapshot.apiCalls.length > 0 ? `${snapshot.apiCalls.length} calls` : undefined,
    },
    {
      id: 'api-network',
      label: COPY.phaseApiNetwork,
      durationMs: snapshot.apiCalls.length > 0 ? apiWallMs : null,
      detail: snapshot.apiCalls.length > 0 ? `${totals.networkFetchSumMs} ms Σ fetch` : undefined,
    },
    {
      id: 'server-handler',
      label: COPY.phaseServerHandler,
      durationMs: totals.serverHandlerSumMs > 0 ? totals.serverHandlerSumMs : null,
    },
    {
      id: 'server-db',
      label: COPY.phaseServerDb,
      durationMs: totals.serverDbSumMs > 0 ? totals.serverDbSumMs : null,
      detail: serverDbQueries > 0 ? `${serverDbQueries} queries` : undefined,
    },
    {
      id: 'js-chunks',
      label: COPY.phaseJsChunks,
      durationMs: jsChunkMs,
    },
    {
      id: 'react-shell',
      label: COPY.phaseReactShell,
      durationMs: reactShellMs,
    },
    {
      id: 'cover-exit',
      label: COPY.phaseCoverExit,
      durationMs: coverExitMs,
    },
    {
      id: 'total',
      label: COPY.phaseTotal,
      durationMs: totals.wallClockMs,
    },
  ];
};

export const formatProfileDurationMs = (durationMs: number | null): string => {
  if (durationMs == null) {
    return '—';
  }
  if (durationMs >= 10_000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }
  return `${durationMs} ms`;
};
