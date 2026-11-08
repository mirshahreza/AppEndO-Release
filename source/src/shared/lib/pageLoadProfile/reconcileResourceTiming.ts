import { apiPathFromResourceUrl } from './httpApiPath';
import { NAV_API_SLACK_MS, navigationAnchorMs } from './navigationScope';
import type { PageLoadProfileApiCall, PageLoadProfileSnapshot } from './types';

const windowStartForSnapshot = (snapshot: PageLoadProfileSnapshot): number => (
  navigationAnchorMs(snapshot) - NAV_API_SLACK_MS
);

/** Merge browser PerformanceResourceTiming rows for /api/ calls missing from the manual log. */
export const reconcileSnapshotWithResourceTiming = (
  snapshot: PageLoadProfileSnapshot,
): PageLoadProfileSnapshot => {
  if (typeof performance === 'undefined') {
    return snapshot;
  }

  const windowStart = windowStartForSnapshot(snapshot);
  const windowEnd = snapshot.lastApiAtMs ?? snapshot.revealedAtMs ?? performance.now();
  const known = new Set(snapshot.apiCalls.map((call) => `${call.path}|${Math.round(call.finishedAtMs)}`));
  const merged: PageLoadProfileApiCall[] = [...snapshot.apiCalls];

  for (const entry of performance.getEntriesByType('resource')) {
    const resource = entry as PerformanceResourceTiming;
    const finishedAtMs = resource.startTime + resource.duration;
    if (resource.startTime < windowStart || finishedAtMs > windowEnd + 200) {
      continue;
    }
    const path = apiPathFromResourceUrl(resource.name);
    if (!path) {
      continue;
    }
    const durationMs = Math.max(0, Math.round(resource.duration));
    const key = `${path}|${Math.round(finishedAtMs)}`;
    if (known.has(key)) {
      continue;
    }
    known.add(key);
    merged.push({
      path,
      durationMs,
      requestId: null,
      server: null,
      startedAtMs: resource.startTime,
      finishedAtMs,
    });
  }

  merged.sort((a, b) => a.startedAtMs - b.startedAtMs);

  const firstApiAtMs = merged.length > 0
    ? Math.min(...merged.map((call) => call.startedAtMs))
    : snapshot.firstApiAtMs;
  const lastApiAtMs = merged.length > 0
    ? Math.max(...merged.map((call) => call.finishedAtMs))
    : snapshot.lastApiAtMs;

  return {
    ...snapshot,
    apiCalls: merged,
    firstApiAtMs: firstApiAtMs ?? snapshot.firstApiAtMs,
    lastApiAtMs: lastApiAtMs ?? snapshot.lastApiAtMs,
  };
};
