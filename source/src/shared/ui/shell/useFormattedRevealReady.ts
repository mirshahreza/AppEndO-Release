import { type RefObject, useLayoutEffect, useState } from 'react';

export type FormattedRevealReadyOptions = {
  /** Require this many ms with no DOM childList mutations before reveal. */
  quietMs?: number;
  /** Never block longer than this while the tree is quiet (safety valve). */
  maxWaitMs?: number;
  /**
   * Absolute ceiling while nested `AppRouteLoading` is still mounted.
   * Prevents revealing the white embedded loader under a fullscreen cover.
   */
  loadingMaxWaitMs?: number;
  /** Minimum time under cover so instant pages do not flash. */
  minMs?: number;
  /** When false, stay unready and do not observe (parent cover owns the wait). */
  enabled?: boolean;
  /**
   * Keep the cover up and skip quiet-DOM observation. Used while a nav click
   * is in flight but the URL has not committed yet (React still showing the
   * previous page).
   */
  hold?: boolean;
};

const DEFAULT_QUIET_MS = 140;
const DEFAULT_MAX_WAIT_MS = 1800;
const DEFAULT_LOADING_MAX_WAIT_MS = 8000;
const DEFAULT_MIN_MS = 100;

/** Nested route/page loaders under the reveal content (not the cover sibling). */
const ROUTE_LOADING_SELECTOR = '[data-testid="app-route-loading"][data-variant="embedded"]';

/**
 * Ready only after the formatted tree under `rootRef` has gone quiet
 * (no childList mutations), nested route loaders are gone, fonts are ready,
 * and a paint has flushed.
 * Keeps the loading cover up until a complete page can appear at once.
 */
export function useFormattedRevealReady(
  resetKey: string | number,
  rootRef: RefObject<HTMLElement | null>,
  options: FormattedRevealReadyOptions = {},
): boolean {
  const {
    quietMs = DEFAULT_QUIET_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    loadingMaxWaitMs = DEFAULT_LOADING_MAX_WAIT_MS,
    minMs = DEFAULT_MIN_MS,
    enabled = true,
    hold = false,
  } = options;
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    if (hold) {
      setReady(false);
      return;
    }

    setReady(false);
    let cancelled = false;
    const root = rootRef.current;
    if (!root) {
      const retry = window.requestAnimationFrame(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(retry);
      };
    }

    let finished = false;
    let quietTimer: number | undefined;
    let maxTimer: number | undefined;
    let minTimer: number | undefined;
    let raf1 = 0;
    let raf2 = 0;
    const startedAt = performance.now();

    const hasRouteLoading = () => Boolean(root.querySelector(ROUTE_LOADING_SELECTOR));

    const finish = (force = false) => {
      if (cancelled || finished) {
        return;
      }

      // Do not lift the cover onto an embedded/route loader — wait for real page content.
      if (!force && hasRouteLoading()) {
        armQuiet();
        scheduleMax();
        return;
      }

      finished = true;
      if (quietTimer !== undefined) {
        window.clearTimeout(quietTimer);
        quietTimer = undefined;
      }
      if (maxTimer !== undefined) {
        window.clearTimeout(maxTimer);
        maxTimer = undefined;
      }

      const elapsed = performance.now() - startedAt;
      const waitMore = Math.max(0, minMs - elapsed);
      minTimer = window.setTimeout(() => {
        if (!cancelled) {
          setReady(true);
        }
      }, waitMore);
    };

    const armQuiet = () => {
      if (finished || cancelled) {
        return;
      }
      if (quietTimer !== undefined) {
        window.clearTimeout(quietTimer);
      }
      quietTimer = window.setTimeout(() => {
        if (cancelled || finished) {
          return;
        }
        if (hasRouteLoading()) {
          armQuiet();
          return;
        }

        const fontsReady =
          typeof document !== 'undefined' && document.fonts?.ready
            ? Promise.race([
              document.fonts.ready,
              new Promise<void>((resolve) => {
                window.setTimeout(resolve, 1_000);
              }),
            ])
            : Promise.resolve();

        void fontsReady.then(() => {
          if (cancelled || finished) {
            return;
          }
          raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => {
              finish();
            });
          });
        });
      }, quietMs);
    };

    const scheduleMax = () => {
      if (maxTimer !== undefined) {
        window.clearTimeout(maxTimer);
      }
      const elapsed = performance.now() - startedAt;
      const budget = hasRouteLoading() ? loadingMaxWaitMs : maxWaitMs;
      const remaining = Math.max(0, budget - elapsed);
      maxTimer = window.setTimeout(() => {
        finish(true);
      }, remaining);
    };

    const observer = new MutationObserver(() => {
      armQuiet();
      if (hasRouteLoading()) {
        scheduleMax();
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    armQuiet();
    scheduleMax();

    return () => {
      cancelled = true;
      observer.disconnect();
      if (quietTimer !== undefined) {
        window.clearTimeout(quietTimer);
      }
      if (maxTimer !== undefined) {
        window.clearTimeout(maxTimer);
      }
      if (minTimer !== undefined) {
        window.clearTimeout(minTimer);
      }
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [enabled, hold, loadingMaxWaitMs, maxWaitMs, minMs, quietMs, resetKey, rootRef]);

  return ready;
}
