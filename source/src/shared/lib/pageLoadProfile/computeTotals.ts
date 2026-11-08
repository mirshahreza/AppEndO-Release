import { navigationAnchorMs, scopeSnapshotToNavigation } from './navigationScope';
import { reconcileSnapshotWithResourceTiming } from './reconcileResourceTiming';
import type { PageLoadProfileSnapshot } from './types';

export type PageLoadProfileTotals = {
  wallClockMs: number;
  serverHandlerSumMs: number;
  serverDbSumMs: number;
  networkFetchSumMs: number;
  clientUiWallMs: number;
  apiPhaseWallMs: number;
  serverPlusClientMs: number;
  isComplete: boolean;
};

const nowMs = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

const effectiveWindowStart = (snapshot: PageLoadProfileSnapshot): number => (
  navigationAnchorMs(snapshot)
);

const effectiveWindowEnd = (snapshot: PageLoadProfileSnapshot, isComplete: boolean): number => {
  const markers = [
    snapshot.revealedAtMs,
    snapshot.shellReadyAtMs,
    snapshot.lastApiAtMs,
  ].filter((value): value is number => value != null);
  if (markers.length === 0) {
    return nowMs();
  }
  const derived = Math.max(...markers);
  if (!isComplete) {
    return Math.max(derived, nowMs());
  }
  return derived;
};

export type PageLoadProfileWallSplit = {
  windowStartMs: number;
  windowEndMs: number;
  clientBeforeMs: number;
  apiPhaseWallMs: number;
  clientAfterMs: number;
};

export const computePageLoadProfileWallSplit = (
  rawSnapshot: PageLoadProfileSnapshot,
): PageLoadProfileWallSplit => {
  const snapshot = reconcileSnapshotWithResourceTiming(scopeSnapshotToNavigation(rawSnapshot));
  const isComplete = snapshot.revealedAtMs != null;
  const windowStartMs = effectiveWindowStart(snapshot);
  const windowEndMs = effectiveWindowEnd(snapshot, isComplete);
  const firstApiStart = snapshot.firstApiAtMs ?? windowEndMs;
  const lastApiEnd = snapshot.lastApiAtMs ?? firstApiStart;
  const clientBeforeMs = Math.max(0, Math.round(firstApiStart - windowStartMs));
  const apiPhaseWallMs = Math.max(0, Math.round(lastApiEnd - firstApiStart));
  const clientAfterMs = Math.max(0, Math.round(windowEndMs - lastApiEnd));
  return {
    windowStartMs,
    windowEndMs,
    clientBeforeMs,
    apiPhaseWallMs,
    clientAfterMs,
  };
};

export const computePageLoadProfileTotals = (
  rawSnapshot: PageLoadProfileSnapshot,
): PageLoadProfileTotals => {
  const snapshot = reconcileSnapshotWithResourceTiming(scopeSnapshotToNavigation(rawSnapshot));
  const isComplete = snapshot.revealedAtMs != null;
  const split = computePageLoadProfileWallSplit(rawSnapshot);
  const wallClockMs = Math.max(0, Math.round(split.windowEndMs - split.windowStartMs));
  const { clientBeforeMs, apiPhaseWallMs, clientAfterMs } = split;
  const clientUiWallMs = clientBeforeMs + clientAfterMs;

  const serverHandlerSumMs = snapshot.apiCalls.reduce(
    (sum, call) => sum + (call.server?.totalMs ?? 0),
    0,
  );
  const serverDbSumMs = snapshot.apiCalls.reduce(
    (sum, call) => sum + (call.server?.dbMs ?? 0),
    0,
  );
  const networkFetchSumMs = snapshot.apiCalls.reduce(
    (sum, call) => sum + call.durationMs,
    0,
  );

  const serverPlusClientMs = serverHandlerSumMs + clientUiWallMs;

  const wallFromParts = Math.max(wallClockMs, apiPhaseWallMs + clientBeforeMs + clientAfterMs);

  return {
    wallClockMs: wallFromParts,
    serverHandlerSumMs,
    serverDbSumMs,
    networkFetchSumMs,
    clientUiWallMs,
    apiPhaseWallMs,
    serverPlusClientMs,
    isComplete,
  };
};
