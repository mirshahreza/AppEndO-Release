import { useSyncExternalStore } from 'react';

export type DevToolbarActivePage = {
  pageKey: string;
  loaderKind: string;
  loaderRef: string;
} | null;

export type DevToolbarLastApiCall = {
  requestId: string | null;
  durationMs: number;
  path: string;
} | null;

/** PDK-7 — the active "view as" grant for this tab, if any. Persists across page navigation. */
export type DevToolbarImpersonation = {
  grantId: string;
  targetUserId: number | null;
  targetEmail: string | null;
  targetRoles: string[];
  expiresAt: string;
} | null;

type DevToolbarSnapshot = {
  activePage: DevToolbarActivePage;
  lastApiCall: DevToolbarLastApiCall;
  impersonation: DevToolbarImpersonation;
};

let snapshot: DevToolbarSnapshot = { activePage: null, lastApiCall: null, impersonation: null };
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

/** Published by the portal route resolver on every navigation — resets the stale last-call reading. */
export const setDevToolbarActivePage = (activePage: DevToolbarActivePage): void => {
  if (snapshot.activePage?.pageKey === activePage?.pageKey
    && snapshot.activePage?.loaderRef === activePage?.loaderRef) {
    return;
  }
  snapshot = { ...snapshot, activePage, lastApiCall: null };
  emit();
};

/** Published from the shared `apiRequest` choke point after each response resolves. */
export const recordDevToolbarApiCall = (lastApiCall: NonNullable<DevToolbarLastApiCall>): void => {
  snapshot = { ...snapshot, lastApiCall };
  emit();
};

/** Set/clear the active impersonation grant — read synchronously by `apiRequest()` on every call. */
export const setDevToolbarImpersonation = (impersonation: DevToolbarImpersonation): void => {
  snapshot = { ...snapshot, impersonation };
  emit();
};

/**
 * Plain (non-hook) getter — `apiRequest()` in `client.ts` is not a component. The server is the
 * real source of truth for expiry; this client-side check just avoids sending an obviously-stale
 * header for one extra request cycle.
 */
export const getActiveImpersonationGrantId = (): string | null => {
  const impersonation = snapshot.impersonation;
  if (!impersonation) {
    return null;
  }
  if (new Date(impersonation.expiresAt).getTime() <= Date.now()) {
    setDevToolbarImpersonation(null);
    return null;
  }
  return impersonation.grantId;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): DevToolbarSnapshot => snapshot;

export const useDevToolbarSnapshot = (): DevToolbarSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
