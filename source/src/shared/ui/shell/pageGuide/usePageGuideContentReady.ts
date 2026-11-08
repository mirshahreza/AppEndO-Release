import { useLayoutEffect, useRef, useState } from 'react';

const ROUTE_LOADING_SELECTOR = '[data-testid="app-route-loading"]';
const DEFAULT_QUIET_MS = 140;
const DEFAULT_MAX_WAIT_MS = 8000;

/**
 * False until the current route has finished loading: nested AppRouteLoading is gone
 * and the document tree has been quiet for a short beat.
 * When `enabled` is false the page is already treated as ready (first open on a loaded screen).
 */
export const usePageGuideContentReady = (resetKey: string, enabled: boolean): boolean => {
  const waitedKeyRef = useRef<string | null>(null);
  const [, setTick] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const root = document.getElementById('root') ?? document.body;
    let cancelled = false;
    let finished = false;
    let quietTimer: number | undefined;
    let maxTimer: number | undefined;

    const hasRouteLoading = (): boolean => Boolean(root.querySelector(ROUTE_LOADING_SELECTOR));

    const finish = (): void => {
      if (cancelled || finished) return;
      finished = true;
      if (quietTimer !== undefined) window.clearTimeout(quietTimer);
      if (maxTimer !== undefined) window.clearTimeout(maxTimer);
      waitedKeyRef.current = resetKey;
      setTick((value) => value + 1);
    };

    const armQuiet = (): void => {
      if (finished || cancelled) return;
      if (quietTimer !== undefined) window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => {
        if (cancelled || finished) return;
        if (hasRouteLoading()) {
          armQuiet();
          return;
        }
        finish();
      }, DEFAULT_QUIET_MS);
    };

    const observer = new MutationObserver(() => {
      armQuiet();
    });
    observer.observe(root, { childList: true, subtree: true });
    armQuiet();
    maxTimer = window.setTimeout(finish, DEFAULT_MAX_WAIT_MS);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (quietTimer !== undefined) window.clearTimeout(quietTimer);
      if (maxTimer !== undefined) window.clearTimeout(maxTimer);
    };
  }, [enabled, resetKey]);

  if (!enabled) return true;
  return waitedKeyRef.current === resetKey;
};
