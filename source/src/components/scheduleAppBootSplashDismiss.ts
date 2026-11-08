import { dismissAppBootSplash } from './dismissAppBootSplash';

const QUIET_MS = 320;
const MIN_READY_MS = 360;
const MAX_WAIT_MS = 5000;

let dismissTimer: number | undefined;
let quietTimer: number | undefined;
let maxTimer: number | undefined;
let startedAt = 0;
let scheduled = false;

function clearTimers(): void {
  if (dismissTimer !== undefined) {
    window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
  }
  if (quietTimer !== undefined) {
    window.clearTimeout(quietTimer);
    quietTimer = undefined;
  }
  if (maxTimer !== undefined) {
    window.clearTimeout(maxTimer);
    maxTimer = undefined;
  }
}

function usesShellFormattedReveal(): boolean {
  return Boolean(document.querySelector('[data-shell-chrome-enter="true"]'));
}

function hasRouteLoadingSurface(): boolean {
  return Boolean(document.querySelector('[data-testid="app-route-loading"]'));
}

function canDismissNow(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  if (usesShellFormattedReveal()) {
    return false;
  }
  if (hasRouteLoadingSurface()) {
    return false;
  }
  const splash = document.getElementById('app-boot-splash');
  if (!splash || splash.hasAttribute('hidden')) {
    return false;
  }
  const root = document.getElementById('root');
  if (!root || root.childElementCount === 0) {
    return false;
  }
  return true;
}

function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    return Promise.resolve();
  }
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 800);
    }),
  ]);
}

function finishDismiss(): void {
  scheduled = false;
  clearTimers();
  void waitForFonts().then(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (canDismissNow()) {
          dismissAppBootSplash();
        }
      });
    });
  });
}

function armQuietDismiss(): void {
  if (quietTimer !== undefined) {
    window.clearTimeout(quietTimer);
  }
  quietTimer = window.setTimeout(() => {
    if (!canDismissNow()) {
      scheduled = false;
      return;
    }
    const elapsed = performance.now() - startedAt;
    const waitMore = Math.max(0, MIN_READY_MS - elapsed);
    if (dismissTimer !== undefined) {
      window.clearTimeout(dismissTimer);
    }
    dismissTimer = window.setTimeout(() => {
      if (canDismissNow()) {
        finishDismiss();
      } else {
        scheduled = false;
      }
    }, waitMore);
  }, QUIET_MS);
}

/**
 * Wait for route content to settle (no loaders, DOM quiet, fonts) before
 * crossfading splash → page — avoids the pre-reveal layout jump on public routes.
 */
export function scheduleAppBootSplashDismiss(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!canDismissNow()) {
    scheduled = false;
    clearTimers();
    return;
  }

  if (!scheduled) {
    scheduled = true;
    startedAt = performance.now();
    maxTimer = window.setTimeout(() => {
      if (canDismissNow()) {
        finishDismiss();
      } else {
        scheduled = false;
      }
    }, MAX_WAIT_MS);
  }

  armQuietDismiss();
}
