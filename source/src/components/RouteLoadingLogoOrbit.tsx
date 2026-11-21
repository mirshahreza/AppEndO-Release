import React, { useEffect, useState } from 'react';

import { OrbitBorderFrame } from '../shared/ui/OrbitBorderFrame';
import { cn } from '../lib/utils';
import {
  ROUTE_LOADING_ORBIT_BORDER_WIDTH,
  ROUTE_LOADING_ORBIT_COLOR_STEPS,
  ROUTE_LOADING_ORBIT_DURATION_SECONDS,
  ROUTE_LOADING_ORBIT_GLOW_BLUR,
  ROUTE_LOADING_ORBIT_GLOW_OPACITY,
  ROUTE_LOADING_ORBIT_REVERSE_COLORS,
  ROUTE_LOADING_ORBIT_TAIL_LENGTH,
} from './routeLoadingOrbitContract';

export type RouteLoadingLogoOrbitProps = {
  children: React.ReactNode;
  /** Platform route-loading `logoGlow` — show orbit border. */
  enabled?: boolean;
  /** Platform route-loading `logoBreathe` — comet travels the perimeter. */
  animate?: boolean;
  className?: string;
  innerClassName?: string;
};

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Base Components orbit-border around the portal / AppEnd logo during route loading.
 */
export const RouteLoadingLogoOrbit: React.FC<RouteLoadingLogoOrbitProps> = ({
  children,
  enabled = true,
  animate = true,
  className,
  innerClassName,
}) => {
  const [reducedMotion, setReducedMotion] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <OrbitBorderFrame
      enabled={enabled}
      preset="accent"
      borderWidth={ROUTE_LOADING_ORBIT_BORDER_WIDTH}
      borderRadius="0.625rem"
      hostBackground="transparent"
      showGlow
      showTrack
      glowBlur={ROUTE_LOADING_ORBIT_GLOW_BLUR}
      glowOpacity={ROUTE_LOADING_ORBIT_GLOW_OPACITY}
      durationSeconds={ROUTE_LOADING_ORBIT_DURATION_SECONDS}
      tailLength={ROUTE_LOADING_ORBIT_TAIL_LENGTH}
      colorSteps={ROUTE_LOADING_ORBIT_COLOR_STEPS}
      reverseColors={ROUTE_LOADING_ORBIT_REVERSE_COLORS}
      cometCount={1}
      direction="forward"
      reducedMotion={reducedMotion || !animate}
      className={cn('app-route-loading-logo-orbit', className)}
      innerClassName={innerClassName}
    >
      {children}
    </OrbitBorderFrame>
  );
};