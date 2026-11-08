import React, { useEffect, useRef, useState } from 'react';
import { AppRouteLoading, type AppRouteLoadingVariant } from '../../../components/AppRouteLoading';
import { cn } from '../../../lib/utils';
import { useFormattedRevealReady } from './useFormattedRevealReady';
import { markPageLoadProfileShellReady } from '../../lib/pageLoadProfile/store';

export type ShellFormattedRevealProps = {
  children: React.ReactNode;
  resetKey: string | number;
  /** Loading cover shown until the formatted tree is complete. */
  cover: AppRouteLoadingVariant;
  className?: string;
  contentClassName?: string;
  /**
   * When false, children stay visible with no cover (parent surface owns the wait).
   * DOM structure stays stable so enabling later does not remount children.
   */
  enabled?: boolean;
  /**
   * Stay covered without treating the current (still previous) tree as ready.
   * Lift once the destination URL has committed.
   */
  hold?: boolean;
  /** Fires when the formatted tree is ready to reveal (and when reset). */
  onReadyChange?: (ready: boolean) => void;
  /** Fires once the cover has finished exiting and unmounted (page fully visible). */
  onRevealed?: () => void;
};

const COVER_EXIT_MS = 380;

/**
 * Philosophy: the user must see a fully formed page appear — never watch it
 * assemble piece by piece. Content mounts under an opaque loading cover; after
 * the DOM goes quiet, cover and content crossfade in one step.
 */
export const ShellFormattedReveal: React.FC<ShellFormattedRevealProps> = ({
  children,
  resetKey,
  cover,
  className,
  contentClassName,
  enabled = true,
  hold = false,
  onReadyChange,
  onRevealed,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const revealedForKeyRef = useRef<string | number | null>(null);
  const ready = useFormattedRevealReady(resetKey, contentRef, { enabled, hold });
  const [coverMounted, setCoverMounted] = useState(enabled);

  useEffect(() => {
    onReadyChange?.(enabled ? ready : true);
  }, [enabled, onReadyChange, ready]);

  useEffect(() => {
    if (hold || !ready) {
      return;
    }
    if (typeof resetKey === 'string') {
      markPageLoadProfileShellReady(resetKey);
    }
  }, [hold, ready, resetKey]);

  useEffect(() => {
    if (!enabled) {
      setCoverMounted(false);
      return;
    }
    revealedForKeyRef.current = null;
    setCoverMounted(true);
  }, [enabled, resetKey]);

  useEffect(() => {
    if (!enabled || hold || !ready || !coverMounted) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCoverMounted(false);
    }, COVER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [coverMounted, enabled, hold, ready]);

  useEffect(() => {
    const visible = !hold && ready && (!enabled || !coverMounted);
    if (!visible) {
      return;
    }
    if (revealedForKeyRef.current === resetKey) {
      return;
    }
    revealedForKeyRef.current = resetKey;
    onRevealed?.();
  }, [coverMounted, enabled, hold, onRevealed, ready, resetKey]);

  const pending = enabled && (hold || !ready);
  const reveal = enabled && ready && !hold;
  const coverIsFullscreen = cover === 'fullscreen';
  const showCover = enabled && (pending || coverMounted);

  return (
    <div
      className={cn('shell-formatted-reveal relative flex h-full min-h-0 min-w-0 flex-1 flex-col', className)}
      data-testid="shell-formatted-reveal"
      data-ready={!enabled || (ready && !hold) ? 'true' : 'false'}
      data-nav-pending={hold ? 'true' : 'false'}
      aria-busy={pending}
    >
      <div
        ref={contentRef}
        className={cn(
          'shell-formatted-reveal__content flex min-h-0 min-w-0 flex-1',
          pending && 'shell-formatted-reveal__content--pending',
          reveal && 'shell-formatted-reveal__content--ready',
          contentClassName,
        )}
        aria-hidden={pending}
      >
        {children}
      </div>

      {showCover ? (
        <div
          className={cn(
            'shell-formatted-reveal__cover z-30',
            // Fullscreen first-surface cover must own the viewport (siblings like
            // AtmosphereBackdrop sit outside this host and would otherwise flash).
            coverIsFullscreen ? 'fixed inset-0' : 'absolute inset-0',
            ready && 'shell-formatted-reveal__cover--exit',
          )}
          data-testid="shell-formatted-reveal-cover"
        >
          <AppRouteLoading
            variant={cover}
            className={coverIsFullscreen ? 'min-h-full' : 'h-full min-h-full'}
          />
        </div>
      ) : null}
    </div>
  );
};
