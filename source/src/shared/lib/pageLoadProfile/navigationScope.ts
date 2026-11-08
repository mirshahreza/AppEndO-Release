import type { PageLoadProfileApiCall, PageLoadProfileSnapshot } from './types';

/** Small slack so a fetch started just before route commit still counts for this navigation. */
export const NAV_API_SLACK_MS = 150;

export const navigationAnchorMs = (snapshot: PageLoadProfileSnapshot): number => (
  snapshot.navigationPendingAtMs
  ?? snapshot.pathnameCommittedAtMs
  ?? snapshot.startedAtMs
);

export const callBelongsToNavigation = (
  snapshot: PageLoadProfileSnapshot,
  call: PageLoadProfileApiCall,
): boolean => call.startedAtMs >= navigationAnchorMs(snapshot) - NAV_API_SLACK_MS;

export const scopeSnapshotToNavigation = (
  snapshot: PageLoadProfileSnapshot,
): PageLoadProfileSnapshot => {
  const apiCalls = snapshot.apiCalls
    .filter((call) => callBelongsToNavigation(snapshot, call))
    .sort((a, b) => a.startedAtMs - b.startedAtMs);
  const firstApiAtMs = apiCalls.length > 0
    ? Math.min(...apiCalls.map((call) => call.startedAtMs))
    : null;
  const lastApiAtMs = apiCalls.length > 0
    ? Math.max(...apiCalls.map((call) => call.finishedAtMs))
    : null;
  const anchor = navigationAnchorMs(snapshot);
  return {
    ...snapshot,
    startedAtMs: anchor,
    apiCalls,
    firstApiAtMs,
    lastApiAtMs,
  };
};
