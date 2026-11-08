import type { PageLoadProfileApiCall, PageLoadProfileSnapshot } from './types';
import { drainPageLoadProfileApiRingSince, pushPageLoadProfileApiRing } from './apiRingBuffer';
import {
  buildPageLoadProfileSnapshotFromBrowser,
  mergeRecentApiCallsForProfiling,
} from './captureSnapshot';
import { normalizeProfilePath } from './normalizeProfilePath';
import {
  NAV_API_SLACK_MS,
  callBelongsToNavigation,
  navigationAnchorMs,
} from './navigationScope';

type Listener = () => void;

let profilingEnabled = false;
let active: PageLoadProfileSnapshot | null = null;
let lastCompleted: PageLoadProfileSnapshot | null = null;
let pendingNav: { toPath: string; atMs: number } | null = null;
const listeners = new Set<Listener>();

const nowMs = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const pathsMatch = (a: string, b: string): boolean => (
  normalizeProfilePath(a) === normalizeProfilePath(b)
);

const emptySnapshot = (pathname: string, startedAtMs: number): PageLoadProfileSnapshot => ({
  pathname: normalizeProfilePath(pathname),
  pageKey: null,
  startedAtMs,
  navigationPendingAtMs: null,
  pathnameCommittedAtMs: null,
  firstApiAtMs: null,
  lastApiAtMs: null,
  shellReadyAtMs: null,
  revealedAtMs: null,
  apiCalls: [],
});

const mergeApiCalls = (
  existing: PageLoadProfileApiCall[],
  incoming: PageLoadProfileApiCall[],
): PageLoadProfileApiCall[] => {
  const map = new Map<string, PageLoadProfileApiCall>();
  for (const call of [...existing, ...incoming]) {
    const key = `${call.path}|${Math.round(call.startedAtMs)}|${Math.round(call.finishedAtMs)}`;
    map.set(key, call);
  }
  return [...map.values()].sort((a, b) => a.startedAtMs - b.startedAtMs);
};

const recomputeApiMarkers = (
  calls: PageLoadProfileApiCall[],
): { firstApiAtMs: number | null; lastApiAtMs: number | null } => {
  if (calls.length === 0) {
    return { firstApiAtMs: null, lastApiAtMs: null };
  }
  return {
    firstApiAtMs: Math.min(...calls.map((call) => call.startedAtMs)),
    lastApiAtMs: Math.max(...calls.map((call) => call.finishedAtMs)),
  };
};

const applyApiCallsToActive = (calls: PageLoadProfileApiCall[]): boolean => {
  if (!active || calls.length === 0) {
    return false;
  }
  const scopedIncoming = calls.filter((call) => callBelongsToNavigation(active!, call));
  if (scopedIncoming.length === 0) {
    return false;
  }
  const scopedExisting = active.apiCalls.filter((call) => callBelongsToNavigation(active!, call));
  const merged = mergeApiCalls(scopedExisting, scopedIncoming);
  if (merged.length === active.apiCalls.length) {
    return false;
  }
  const { firstApiAtMs, lastApiAtMs } = recomputeApiMarkers(merged);
  active = {
    ...active,
    startedAtMs: navigationAnchorMs(active),
    firstApiAtMs,
    lastApiAtMs,
    apiCalls: merged,
  };
  return true;
};

const RECENT_BACKFILL_MS = 120_000;

const hydrateSessionFromRing = (): boolean => {
  if (!active) {
    return false;
  }
  const anchor = navigationAnchorMs(active);
  return applyApiCallsToActive(drainPageLoadProfileApiRingSince(anchor - NAV_API_SLACK_MS));
};

/** APIs that finished before profiling turned on only appear in resource timing / ring backfill. */
const backfillRecentApiCallsIntoActive = (): boolean => {
  if (!active || !profilingEnabled) {
    return false;
  }
  const anchor = navigationAnchorMs(active);
  const since = Math.max(anchor - NAV_API_SLACK_MS, nowMs() - RECENT_BACKFILL_MS);
  const calls = mergeRecentApiCallsForProfiling(since).filter(
    (call) => callBelongsToNavigation(active!, call),
  );
  if (calls.length === 0) {
    return false;
  }
  return applyApiCallsToActive(calls);
};

const ensureActiveSessionHasData = (): boolean => {
  let changed = hydrateSessionFromRing();
  if (active && active.apiCalls.length === 0) {
    changed = backfillRecentApiCallsIntoActive() || changed;
  }
  return changed;
};

const startFreshSession = (
  pathname: string,
  startedAtMs: number,
  navigationPendingAtMs: number | null,
  pathnameCommittedAtMs: number | null,
): void => {
  if (active?.revealedAtMs != null) {
    lastCompleted = { ...active };
  }
  active = {
    ...emptySnapshot(pathname, startedAtMs),
    navigationPendingAtMs,
    pathnameCommittedAtMs,
  };
  ensureActiveSessionHasData();
  emit();
};

export const setPageLoadProfilingEnabled = (enabled: boolean): void => {
  if (profilingEnabled === enabled) {
    return;
  }
  profilingEnabled = enabled;
  if (!enabled) {
    active = null;
  }
  emit();
};

export const isPageLoadProfilingEnabled = (): boolean => profilingEnabled;

export const setPageLoadProfilePageKey = (pageKey: string | null): void => {
  if (!active || !profilingEnabled) {
    return;
  }
  const trimmed = pageKey?.trim() || null;
  if (active.pageKey === trimmed) {
    return;
  }
  active = { ...active, pageKey: trimmed };
  emit();
};

export const markPageLoadProfileNavigationPending = (toPath: string): void => {
  if (!profilingEnabled) {
    return;
  }
  const normalized = normalizeProfilePath(toPath);
  const atMs = nowMs();
  pendingNav = { toPath: normalized, atMs };
  startFreshSession(normalized, atMs, atMs, null);
};

export const beginPageLoadProfileNavigation = (pathname: string, forceNew = false): void => {
  if (!profilingEnabled) {
    return;
  }
  const normalized = normalizeProfilePath(pathname);
  const committedAtMs = nowMs();
  const matchedPending = pendingNav && pathsMatch(pendingNav.toPath, normalized) ? pendingNav : null;
  pendingNav = null;

  if (!forceNew && active && pathsMatch(active.pathname, normalized) && active.revealedAtMs == null) {
    let changed = false;
    if (active.pathnameCommittedAtMs == null) {
      active = {
        ...active,
        pathnameCommittedAtMs: committedAtMs,
        navigationPendingAtMs: active.navigationPendingAtMs ?? matchedPending?.atMs ?? null,
        startedAtMs: matchedPending
          ? Math.min(active.startedAtMs, matchedPending.atMs)
          : active.startedAtMs,
      };
      changed = true;
    }
    if (ensureActiveSessionHasData()) {
      changed = true;
    }
    if (changed) {
      emit();
    }
    return;
  }

  if (!forceNew && active && pathsMatch(active.pathname, normalized) && active.revealedAtMs != null) {
    return;
  }

  const startedAtMs = matchedPending?.atMs ?? committedAtMs;
  startFreshSession(
    normalized,
    startedAtMs,
    matchedPending?.atMs ?? null,
    committedAtMs,
  );
};

export const recordPageLoadProfileApiCall = (call: PageLoadProfileApiCall): void => {
  if (!profilingEnabled) {
    return;
  }
  const startedAtMs = call.startedAtMs ?? (call.finishedAtMs - call.durationMs);
  const normalizedCall = { ...call, startedAtMs };
  pushPageLoadProfileApiRing(normalizedCall);
  if (!active) {
    return;
  }
  if (applyApiCallsToActive([normalizedCall])) {
    emit();
  }
};

export const markPageLoadProfileShellReady = (pathname: string): void => {
  if (!profilingEnabled || !active || !pathsMatch(active.pathname, pathname)) {
    return;
  }
  if (active.shellReadyAtMs != null) {
    return;
  }
  active = { ...active, shellReadyAtMs: nowMs() };
  emit();
};

export const markPageLoadProfileRevealed = (pathname: string): void => {
  if (!profilingEnabled || !active || !pathsMatch(active.pathname, pathname)) {
    return;
  }
  if (active.revealedAtMs != null) {
    return;
  }
  hydrateSessionFromRing();
  const now = nowMs();
  const revealedAtMs = Math.max(
    now,
    active.shellReadyAtMs ?? 0,
    active.lastApiAtMs ?? 0,
  );
  active = {
    ...active,
    revealedAtMs,
    shellReadyAtMs: active.shellReadyAtMs ?? revealedAtMs,
  };
  lastCompleted = { ...active };
  emit();
};

export const finalizePageLoadProfileIfStale = (pathname: string): void => {
  if (!profilingEnabled || !active || !pathsMatch(active.pathname, pathname)) {
    return;
  }
  if (active.revealedAtMs != null) {
    return;
  }
  ensureActiveSessionHasData();
  const now = nowMs();
  const lastApi = active.lastApiAtMs;
  const shellReady = active.shellReadyAtMs;
  const sessionAge = now - active.startedAtMs;

  if (sessionAge < 400) {
    return;
  }
  if (lastApi == null) {
    return;
  }
  if (now - lastApi < 500) {
    return;
  }
  const embeddedLoader = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="app-route-loading"][data-variant="embedded"]')
    : null;
  if (embeddedLoader) {
    return;
  }
  if (shellReady == null) {
    const reveal = document.querySelector('[data-testid="shell-formatted-reveal"]');
    if (reveal?.getAttribute('data-ready') !== 'true') {
      return;
    }
    active = { ...active, shellReadyAtMs: now };
  }
  markPageLoadProfileRevealed(pathname);
};

export const getPageLoadProfileSnapshot = (): PageLoadProfileSnapshot | null => {
  if (active?.revealedAtMs != null) {
    return active;
  }
  if (active) {
    return active;
  }
  return lastCompleted;
};

/** Refresh in-memory session from ring buffer + Performance resource timing (safe to call from UI timers). */
export const refreshPageLoadProfileSession = (): void => {
  if (!profilingEnabled) {
    return;
  }
  if (ensureActiveSessionHasData()) {
    emit();
  }
};

/** Ensure the profile dialog has data (live session, last run, or browser resource timing). */
export const materializePageLoadProfileForView = (
  pathname: string,
  pageKey: string | null,
): PageLoadProfileSnapshot | null => {
  const normalized = normalizeProfilePath(pathname);
  if (active && pathsMatch(active.pathname, normalized)) {
    if (ensureActiveSessionHasData()) {
      emit();
    }
    if (active.apiCalls.length > 0 || active.revealedAtMs != null) {
      return active;
    }
  }
  if (lastCompleted && pathsMatch(lastCompleted.pathname, normalized)) {
    return lastCompleted;
  }
  const built = buildPageLoadProfileSnapshotFromBrowser(normalized, pageKey);
  if (built) {
    const prev = lastCompleted;
    lastCompleted = built;
    if (!active || !pathsMatch(active.pathname, normalized)) {
      active = { ...built };
    }
    const changed =
      !prev
      || prev.pathname !== built.pathname
      || prev.apiCalls.length !== built.apiCalls.length
      || prev.revealedAtMs !== built.revealedAtMs;
    if (changed) {
      emit();
    }
    return built;
  }
  return null;
};

export const subscribePageLoadProfile = subscribe;
