import * as React from 'react';
import { VIEWPORT_MEDIA_QUERIES, VIEWPORT_TIER_MAX_WIDTH } from '../../../shared/lib/viewportTokens';
import type { ShellDirection, ShellViewportTier } from '../shell-foundation';

export type ShellRuntimeHostValue = {
  direction: ShellDirection;
  viewport: ShellViewportTier;
  motionPaused: boolean;
  setMotionPaused: (paused: boolean) => void;
  mobileNavigationOpen: boolean;
  setMobileNavigationOpen: (open: boolean) => void;
};

const ShellRuntimeHostContext = React.createContext<ShellRuntimeHostValue | null>(null);

function readViewport(): ShellViewportTier {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  if (window.matchMedia(VIEWPORT_MEDIA_QUERIES.phone).matches) return 'phone';
  if (window.matchMedia(`(max-width: ${VIEWPORT_TIER_MAX_WIDTH.tablet}px)`).matches) return 'tablet';
  return 'desktop';
}

export function ShellRuntimeHostProvider({
  children,
  direction,
  viewport: viewportOverride,
  motionPaused: motionPausedOverride,
  onMotionPausedChange,
  mobileNavigationOpen = false,
  onMobileNavigationOpenChange = () => undefined,
}: {
  children: React.ReactNode;
  direction?: ShellDirection;
  viewport?: ShellViewportTier;
  motionPaused?: boolean;
  onMotionPausedChange?: (paused: boolean) => void;
  mobileNavigationOpen?: boolean;
  onMobileNavigationOpenChange?: (open: boolean) => void;
}) {
  const [measuredViewport, setMeasuredViewport] = React.useState<ShellViewportTier>(readViewport);
  const [internalMotionPaused, setInternalMotionPaused] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(mobileNavigationOpen);
  const resolvedDirection: ShellDirection = direction
    ?? (typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');

  React.useEffect(() => {
    setMobileOpen(mobileNavigationOpen);
  }, [mobileNavigationOpen]);

  React.useEffect(() => {
    if (viewportOverride) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const phone = window.matchMedia(VIEWPORT_MEDIA_QUERIES.phone);
    const tablet = window.matchMedia(`(max-width: ${VIEWPORT_TIER_MAX_WIDTH.tablet}px)`);
    const update = () => setMeasuredViewport(phone.matches ? 'phone' : tablet.matches ? 'tablet' : 'desktop');
    phone.addEventListener?.('change', update);
    tablet.addEventListener?.('change', update);
    update();
    return () => {
      phone.removeEventListener?.('change', update);
      tablet.removeEventListener?.('change', update);
    };
  }, [viewportOverride]);

  const viewport = viewportOverride ?? measuredViewport;
  const motionPaused = motionPausedOverride ?? internalMotionPaused;

  const value = React.useMemo(
    () => ({
      direction: resolvedDirection,
      viewport,
      motionPaused,
      setMotionPaused: (paused: boolean) => {
        if (motionPausedOverride == null) setInternalMotionPaused(paused);
        onMotionPausedChange?.(paused);
      },
      mobileNavigationOpen: mobileOpen,
      setMobileNavigationOpen: (open: boolean) => {
        setMobileOpen(open);
        onMobileNavigationOpenChange(open);
      },
    }),
    [
      mobileOpen,
      motionPaused,
      motionPausedOverride,
      onMobileNavigationOpenChange,
      onMotionPausedChange,
      resolvedDirection,
      viewport,
    ],
  );

  return (
    <ShellRuntimeHostContext.Provider value={value}>
      {children}
    </ShellRuntimeHostContext.Provider>
  );
}

export function useShellRuntimeHost(): ShellRuntimeHostValue {
  const value = React.useContext(ShellRuntimeHostContext);
  if (!value) throw new Error('Shell runtime component rendered outside ShellRuntimeHostProvider.');
  return value;
}
