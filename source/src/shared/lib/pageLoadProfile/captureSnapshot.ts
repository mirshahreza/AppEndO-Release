import { drainPageLoadProfileApiRingSince } from './apiRingBuffer';
import { apiPathFromResourceUrl } from './httpApiPath';
import { reconcileSnapshotWithResourceTiming } from './reconcileResourceTiming';
import { normalizeProfilePath } from './normalizeProfilePath';
import type { PageLoadProfileApiCall, PageLoadProfileSnapshot } from './types';

const RECENT_MS = 120_000;

const nowMs = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

export const mergeRecentApiCallsForProfiling = (
  sinceMs: number,
  includeRing = true,
): PageLoadProfileApiCall[] => {
  const ringCalls = includeRing ? drainPageLoadProfileApiRingSince(sinceMs) : [];
  const resourceCalls = callsFromResourceTiming(sinceMs);
  const merged = new Map<string, PageLoadProfileApiCall>();
  for (const call of [...ringCalls, ...resourceCalls]) {
    const key = `${call.path}|${Math.round(call.startedAtMs)}|${Math.round(call.finishedAtMs)}`;
    merged.set(key, call);
  }
  return [...merged.values()].sort((a, b) => a.startedAtMs - b.startedAtMs);
};

const callsFromResourceTiming = (sinceMs: number): PageLoadProfileApiCall[] => {
  if (typeof performance === 'undefined') {
    return [];
  }
  const calls: PageLoadProfileApiCall[] = [];
  for (const entry of performance.getEntriesByType('resource')) {
    const resource = entry as PerformanceResourceTiming;
    const finishedAtMs = resource.startTime + resource.duration;
    if (finishedAtMs < sinceMs) {
      continue;
    }
    const path = apiPathFromResourceUrl(resource.name);
    if (!path) {
      continue;
    }
    calls.push({
      path,
      durationMs: Math.max(0, Math.round(resource.duration)),
      requestId: null,
      server: null,
      startedAtMs: resource.startTime,
      finishedAtMs,
    });
  }
  return calls.sort((a, b) => a.startedAtMs - b.startedAtMs);
};

export const buildPageLoadProfileSnapshotFromBrowser = (
  pathname: string,
  pageKey: string | null,
): PageLoadProfileSnapshot | null => {
  const now = nowMs();
  const since = now - RECENT_MS;
  const apiCalls = mergeRecentApiCallsForProfiling(since);
  if (apiCalls.length === 0) {
    return null;
  }

  const startedAtMs = Math.min(...apiCalls.map((call) => call.startedAtMs));
  const lastApiAtMs = Math.max(...apiCalls.map((call) => call.finishedAtMs));
  const end = Math.max(now, lastApiAtMs);

  const draft: PageLoadProfileSnapshot = {
    pathname: normalizeProfilePath(pathname),
    pageKey: pageKey?.trim() || null,
    startedAtMs,
    navigationPendingAtMs: null,
    pathnameCommittedAtMs: startedAtMs,
    firstApiAtMs: startedAtMs,
    lastApiAtMs,
    shellReadyAtMs: end,
    revealedAtMs: end,
    apiCalls,
  };

  return reconcileSnapshotWithResourceTiming(draft);
};
