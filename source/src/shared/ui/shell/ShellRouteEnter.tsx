import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveShellFormattedRevealResetKey } from '../../../app/platform/experiencePageOutletKey';
import { isShellSoftNavigation } from '../../../app/platform/shellSoftNavigation';
import { normalizeNavigationPath } from '../../lib/navigationGuardRegistry';
import { ShellFormattedReveal } from './ShellFormattedReveal';
import { useShellReveal } from './ShellRevealContext';
import {
  clearShellNavigationPending,
  useShellNavigationPending,
} from './shellNavigationPending';
import { markPageLoadProfileRevealed } from '../../lib/pageLoadProfile/store';
import { normalizeProfilePath } from '../../lib/pageLoadProfile/normalizeProfilePath';

export type ShellRouteEnterProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * In-shell navigation: cover the content host until the new page is fully
 * formed, then reverse-fade once. The first surface reveal is owned by
 * ShellChromeEnter — page gating starts only after the first pathname change.
 *
 * Menu clicks raise that cover immediately (`beginShellNavigationPending`) so
 * React transitions cannot leave the previous page on screen with no feedback.
 *
 * Exception: CMS Settings left-rail sections (`/studio/cms/settings…`) skip the
 * cover so Base Info / General swaps stay soft (same shell family, separate
 * Designer pageKeys).
 */
export const ShellRouteEnter: React.FC<ShellRouteEnterProps> = ({ children, className }) => {
  const { pathname } = useLocation();
  const { surfaceReady } = useShellReveal();
  const pendingToPath = useShellNavigationPending();
  const pathAtSurfaceReadyRef = useRef<string | null>(null);
  const previousPathRef = useRef(pathname);
  const [gatePage, setGatePage] = useState(false);
  const [skipCover, setSkipCover] = useState(false);

  useEffect(() => {
    if (!surfaceReady) {
      pathAtSurfaceReadyRef.current = null;
      setGatePage(false);
      setSkipCover(false);
      return;
    }
    if (pathAtSurfaceReadyRef.current === null) {
      pathAtSurfaceReadyRef.current = pathname;
      previousPathRef.current = pathname;
      setGatePage(false);
      setSkipCover(false);
    }
  }, [pathname, surfaceReady]);

  useLayoutEffect(() => {
    if (!surfaceReady || pathAtSurfaceReadyRef.current === null) {
      return;
    }
    if (pathname === previousPathRef.current) {
      return;
    }
    const from = previousPathRef.current;
    const soft = isShellSoftNavigation(from, pathname);
    previousPathRef.current = pathname;
    pathAtSurfaceReadyRef.current = pathname;
    setSkipCover(soft);
    setGatePage(!soft);
  }, [pathname, surfaceReady]);

  const clickPending = surfaceReady && pendingToPath !== null;
  const holdForPending = Boolean(
    clickPending
    && normalizeNavigationPath(pendingToPath ?? '') !== normalizeNavigationPath(pathname),
  );
  const enabled = surfaceReady && !skipCover && (gatePage || clickPending);

  return (
    <ShellFormattedReveal
      resetKey={resolveShellFormattedRevealResetKey(pathname)}
      cover="embedded"
      className={className}
      contentClassName="flex h-full min-h-0 flex-1 flex-col"
      enabled={enabled}
      hold={holdForPending}
      onRevealed={() => {
        setGatePage(false);
        clearShellNavigationPending();
        markPageLoadProfileRevealed(normalizeProfilePath(pathname));
      }}
    >
      {children}
    </ShellFormattedReveal>
  );
};
