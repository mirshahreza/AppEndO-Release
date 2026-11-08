import React, { useLayoutEffect, useMemo } from 'react';

import { cn } from '../lib/utils';

import { useAppBootQuery } from '../shared/api/queries/boot';

import {
  guessPortalSegmentFromPathname,
  readCachedPortalBrandForPathname,
  resolvePortalLoadingBrandForPathname,
} from '../shared/lib/portalBrandCache';
import { VX_PUBLIC_PORTAL_SEGMENT } from '../domain/vx/selfRegistration/vxSelfRegistrationRoutes';
import { isVerticalPackageEnabledOnBoot } from '../shared/packages/verticalRuntimeClient';

import {
  dismissAppBootSplashIfNoFullscreenLoading,
  isAppBootSplashDelegated,
  syncAppBootSplashLogo,
} from './appBootSplashBridge';
import {
  classifyLoadingLogoShape,
  type LoadingLogoStageShape,
} from './appRouteLoadingLogoStage';
import { APPENDO_LOGO_SRC } from './AppEndLogo';
import { LoadingEcgTrace } from './appRouteLoadingEcg';
import type { EffectiveRouteLoadingExperience } from '../shared/api/contracts/routeLoading/schema';
import { useRouteLoadingExperience } from '../shared/hooks/useRouteLoadingExperience';
import {
  buildRouteLoadingExperienceStyle,
  routeLoadingExperienceClassName,
} from '../shared/lib/routeLoadingExperienceStyle';

export type AppRouteLoadingVariant = 'fullscreen' | 'embedded';

export type AppRouteLoadingProps = {
  /**
   * `fullscreen` — portal/shell boot, auth, platform config (replaces the viewport).
   * `embedded` — lazy page inside an already-mounted shell content host.
   */
  variant?: AppRouteLoadingVariant;
  className?: string;
  label?: string;
  /** Portal logo URL. When omitted, uses portal Settings brand (/api/boot shells) or cache. */
  logoSrc?: string;
  logoAlt?: string;
  /** Live preview or tests — skips boot config when set. */
  experienceOverride?: EffectiveRouteLoadingExperience | null;
};

const LoadingSimpleLine: React.FC = () => (
  <div className="app-route-loading__simple-line" aria-hidden />
);

function isVerticalLoadingIdentity(pathname: string): boolean {
  return guessPortalSegmentFromPathname(pathname) === VX_PUBLIC_PORTAL_SEGMENT;
}

type LoadingActivityProps = {
  compact?: boolean;
  experience: EffectiveRouteLoadingExperience;
};

const LoadingActivity: React.FC<LoadingActivityProps> = ({ compact = false, experience }) => {
  const showProgress = experience.progressStyle !== 'none';

  if (!showProgress) {
    return null;
  }

  return (
    <div
      className={cn('app-route-loading__activity', compact && 'app-route-loading__activity--compact')}
      aria-hidden
    >
      <div
        className={cn(
          'app-route-loading__bar',
          experience.progressStyle === 'simple-line' && 'app-route-loading__bar--simple-line',
        )}
      >
        {experience.progressStyle === 'ecg' ? <LoadingEcgTrace /> : <LoadingSimpleLine />}
      </div>
    </div>
  );
};

function resolveLoadingLogoFromBrand(
  logoSrc: string | undefined,
  pathname: string,
  shells?: Parameters<typeof resolvePortalLoadingBrandForPathname>[1],
): { src?: string; custom: boolean } {
  const explicit = logoSrc?.trim();
  if (explicit) {
    return { src: explicit, custom: explicit !== APPENDO_LOGO_SRC };
  }

  const brand = resolvePortalLoadingBrandForPathname(pathname, shells)
    ?? readCachedPortalBrandForPathname(pathname);
  const url = brand?.logoUrl?.trim();
  if (url && url !== APPENDO_LOGO_SRC) {
    return { src: url, custom: true };
  }

  return { src: undefined, custom: false };
}

type LoadingLogoStageProps = {
  variant: AppRouteLoadingVariant;
  src?: string;
  alt: string;
  showAppEndMark: boolean;
};

function resolveLogoStageShape(
  showAppEndMark: boolean,
  src: string | undefined,
): LoadingLogoStageShape {
  if (showAppEndMark) {
    return 'appendo';
  }
  if (src) {
    return classifyLoadingLogoShape(src);
  }
  return 'wide';
}

const LoadingLogoStage: React.FC<LoadingLogoStageProps> = ({
  variant,
  src,
  alt,
  showAppEndMark,
}) => {
  const shape = resolveLogoStageShape(showAppEndMark, src);
  const embedded = variant === 'embedded';

  return (
    <div
      className={cn(
        'app-route-loading__logo-stage',
        `app-route-loading__logo-stage--${shape}`,
        embedded && 'app-route-loading__logo-stage--embedded',
      )}
      aria-hidden={showAppEndMark || !src ? true : undefined}
    >
      <div className="app-route-loading__logo-frame">
        {showAppEndMark ? (
          <span className="appendo-logo-themed app-route-loading__logo app-route-loading__logo--appendo" />
        ) : src ? (
          <img
            src={src}
            alt={alt}
            className="app-route-loading__logo object-contain"
            draggable={false}
            decoding="async"
          />
        ) : null}
      </div>
    </div>
  );
};

/**
 * Shared loading surface for every portal shell (studio and future shells).
 * Fullscreen matches `#app-boot-splash` (index.html) and the active accent theme.
 * Never leave a blank white viewport while boot, shell, or page chunks load.
 */
export const AppRouteLoading: React.FC<AppRouteLoadingProps> = ({
  variant = 'fullscreen',
  className,
  label = 'Loading…',
  logoSrc,
  logoAlt,
  experienceOverride,
}) => {
  const { data: bootPayload } = useAppBootQuery();
  const experience = useRouteLoadingExperience(variant, experienceOverride);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const logo = useMemo(
    () => resolveLoadingLogoFromBrand(logoSrc, pathname, bootPayload?.runtimeConfig.shells),
    [bootPayload?.runtimeConfig.shells, logoSrc, pathname],
  );
  const alt = logoAlt?.trim() || 'Loading';
  const portalRouteBoot =
    typeof document !== 'undefined'
    && document.documentElement.hasAttribute('data-portal-route');
  const showAppEndMark = !logo.custom && !portalRouteBoot;
  const verticalIdentity =
    isVerticalLoadingIdentity(pathname) && isVerticalPackageEnabledOnBoot(bootPayload);
  const splashDelegated = variant === 'fullscreen' && isAppBootSplashDelegated();

  useLayoutEffect(() => {
    if (!verticalIdentity) {
      return;
    }
    document.documentElement.setAttribute('data-loading-identity', 'vertical');
    // Keep Vertical splash tokens until #app-boot-splash is gone — removing early
    // re-styles the HTML loader and causes a visible glow/jump while splash is still up.
  }, [verticalIdentity]);

  useLayoutEffect(() => {
    if (variant !== 'fullscreen') {
      return;
    }
    if (logo.custom && logo.src) {
      syncAppBootSplashLogo(logo.src);
    }
    return () => {
      dismissAppBootSplashIfNoFullscreenLoading();
    };
  }, [logo.custom, logo.src, variant]);

  const rootClass = cn(
    variant === 'embedded'
      ? 'app-route-loading app-route-loading--embedded flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 bg-[var(--color-surface-base,#ffffff)]'
      : 'app-route-loading app-route-loading--fullscreen relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-10',
    verticalIdentity && 'app-route-loading--vertical',
    splashDelegated && 'app-route-loading--splash-delegated',
    routeLoadingExperienceClassName(experience),
    className,
  );

  const logoStage = experience.showLogo ? (
    <LoadingLogoStage
      variant={variant}
      src={logo.custom ? logo.src : undefined}
      alt={alt}
      showAppEndMark={showAppEndMark}
    />
  ) : null;

  const activityStage = (
    <LoadingActivity compact={variant === 'embedded'} experience={experience} />
  );

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="app-route-loading"
      data-variant={variant}
    >
      <div
        className={cn(
          'app-route-loading__stack relative z-10 flex flex-col items-center',
          variant === 'embedded' ? 'gap-3' : 'gap-5',
        )}
        style={buildRouteLoadingExperienceStyle(experience)}
      >
        {experience.stackOrder === 'activity-first' ? (
          <>
            {activityStage}
            {logoStage}
          </>
        ) : (
          <>
            {logoStage}
            {activityStage}
          </>
        )}
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
};
