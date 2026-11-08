import { useSyncExternalStore } from 'react';
import { isShellSoftNavigation } from '../../../app/platform/shellSoftNavigation';
import { normalizeNavigationPath } from '../../lib/navigationGuardRegistry';
import { markPageLoadProfileNavigationPending } from '../../lib/pageLoadProfile/store';
import { normalizeProfilePath } from '../../lib/pageLoadProfile/normalizeProfilePath';

type Listener = () => void;

let pendingToPath: string | null = null;
const listeners = new Set<Listener>();

const getSnapshot = (): string | null => pendingToPath;
const getServerSnapshot = (): string | null => null;

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/**
 * Mark in-shell navigation pending so `ShellRouteEnter` can cover the content
 * host from the click, not after the URL commits.
 */
export function beginShellNavigationPending(fromPath: string, toPath: string): void {
  const from = normalizeNavigationPath(fromPath);
  const to = normalizeNavigationPath(toPath);
  if (!to || to === from || isShellSoftNavigation(from, to)) {
    return;
  }
  if (pendingToPath === to) {
    return;
  }
  pendingToPath = to;
  markPageLoadProfileNavigationPending(normalizeProfilePath(to));
  notify();
}

export function clearShellNavigationPending(): void {
  if (pendingToPath === null) {
    return;
  }
  pendingToPath = null;
  notify();
}

/** Test-only: drop pending without requiring a paint. */
export function resetShellNavigationPendingForTests(): void {
  pendingToPath = null;
  listeners.forEach((listener) => listener());
}

/** Destination path while a shell nav click is in flight; otherwise null. */
export function useShellNavigationPending(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
