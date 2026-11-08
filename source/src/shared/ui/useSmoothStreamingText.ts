import { useEffect, useRef, useState } from 'react';

/** Minimum characters revealed per animation frame — keeps short answers snappy. */
const MIN_REVEAL_CHARS_PER_FRAME = 8;
/** Fraction of the outstanding backlog revealed per frame — catch-up stays proportional. */
const BACKLOG_CATCHUP_RATIO = 0.12;
/** How far past the reveal point to look for a word boundary before giving up (code has long runs). */
const WORD_BOUNDARY_LOOKAHEAD = 40;

/**
 * Paced reveal for streamed chat text (React analog of vscode `chatIncrementalRendering`):
 * pure appends are revealed word-by-word on requestAnimationFrame ticks, with the reveal
 * rate proportional to the backlog so the display never lags unboundedly behind the network.
 * Any non-append change (final authoritative text at `done`, history load, message switch)
 * snaps immediately — smoothing must never delay or alter the settled content.
 */
export const useSmoothStreamingText = (target: string, enabled: boolean): string => {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = target;
    const shown = displayedRef.current;

    if (!enabled || typeof requestAnimationFrame !== 'function' || !target.startsWith(shown)) {
      displayedRef.current = target;
      setDisplayed(target);
      return undefined;
    }
    if (shown === target) {
      return undefined;
    }

    const tick = (): void => {
      rafRef.current = null;
      const full = targetRef.current;
      const current = displayedRef.current;

      if (!full.startsWith(current)) {
        displayedRef.current = full;
        setDisplayed(full);
        return;
      }

      const backlog = full.length - current.length;
      if (backlog <= 0) {
        return;
      }

      let next = current.length + Math.max(MIN_REVEAL_CHARS_PER_FRAME, Math.ceil(backlog * BACKLOG_CATCHUP_RATIO));
      if (next < full.length) {
        const boundary = full.slice(next, next + WORD_BOUNDARY_LOOKAHEAD).search(/\s/);
        if (boundary > -1) {
          next += boundary + 1;
        }
      }
      next = Math.min(next, full.length);

      displayedRef.current = full.slice(0, next);
      setDisplayed(displayedRef.current);

      if (next < full.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, enabled]);

  return displayed;
};
