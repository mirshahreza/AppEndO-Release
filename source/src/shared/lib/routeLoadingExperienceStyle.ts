import type { CSSProperties } from 'react';

import type { EffectiveRouteLoadingExperience } from '../api/contracts/routeLoading/schema';
import { routeLoadingLogoScale } from '../api/contracts/routeLoading/normalizers';

export function buildRouteLoadingExperienceStyle(
  experience: EffectiveRouteLoadingExperience,
): CSSProperties {
  const scale = routeLoadingLogoScale(experience.logoSize);
  return {
    ['--loading-logo-scale' as string]: String(scale),
    gap: `${experience.stackGapRem}rem`,
  };
}

export function routeLoadingExperienceClassName(
  experience: EffectiveRouteLoadingExperience,
): string {
  const classes: string[] = [];
  if (!experience.logoGlow) {
    classes.push('app-route-loading--no-logo-glow');
  }
  if (!experience.logoBreathe) {
    classes.push('app-route-loading--no-logo-breathe');
  }
  return classes.join(' ');
}
