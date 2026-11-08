import { buildPageLoadProfilePhaseRows } from './buildPhaseRows';
import { computePageLoadProfileTotals } from './computeTotals';
import { scopeSnapshotToNavigation } from './navigationScope';
import type { PageLoadProfileSnapshot } from './types';

export const PAGE_LOAD_PROFILE_EXPORT_VERSION = 1 as const;

export type PageLoadProfileExportPayload = {
  exportVersion: typeof PAGE_LOAD_PROFILE_EXPORT_VERSION;
  capturedAtIso: string;
  pathname: string;
  pageKey: string | null;
  isComplete: boolean;
  markers: {
    startedAtMs: number;
    navigationPendingAtMs: number | null;
    pathnameCommittedAtMs: number | null;
    firstApiAtMs: number | null;
    lastApiAtMs: number | null;
    shellReadyAtMs: number | null;
    revealedAtMs: number | null;
  };
  totals: ReturnType<typeof computePageLoadProfileTotals>;
  phases: ReturnType<typeof buildPageLoadProfilePhaseRows>;
  apiCalls: PageLoadProfileSnapshot['apiCalls'];
};

export const buildPageLoadProfileExportPayload = (
  snapshot: PageLoadProfileSnapshot,
): PageLoadProfileExportPayload => {
  const scoped = scopeSnapshotToNavigation(snapshot);
  return {
    exportVersion: PAGE_LOAD_PROFILE_EXPORT_VERSION,
    capturedAtIso: new Date().toISOString(),
    pathname: scoped.pathname,
    pageKey: scoped.pageKey,
    isComplete: computePageLoadProfileTotals(scoped).isComplete,
    markers: {
      startedAtMs: scoped.startedAtMs,
      navigationPendingAtMs: scoped.navigationPendingAtMs,
      pathnameCommittedAtMs: scoped.pathnameCommittedAtMs,
      firstApiAtMs: scoped.firstApiAtMs,
      lastApiAtMs: scoped.lastApiAtMs,
      shellReadyAtMs: scoped.shellReadyAtMs,
      revealedAtMs: scoped.revealedAtMs,
    },
    totals: computePageLoadProfileTotals(scoped),
    phases: buildPageLoadProfilePhaseRows(scoped),
    apiCalls: scoped.apiCalls,
  };
};

export const serializePageLoadProfileExport = (snapshot: PageLoadProfileSnapshot): string => (
  JSON.stringify(buildPageLoadProfileExportPayload(snapshot), null, 2)
);
