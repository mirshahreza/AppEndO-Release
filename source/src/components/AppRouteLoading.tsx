import React, { useLayoutEffect, useMemo } from 'react';

import { cn } from '../lib/utils';

import { useAppBootQuery } from '../shared/api/queries/boot';

import {
  guessPortalSegmentFromPathname,
  readCachedPortalBrandForPathname,
  resolvePortalLoadingBrandForPathname,
} from '../shared/lib/portalBrandCache';
import { EXTX_PUBLIC_PORTAL_SEGMENT } from '../oss/excludedModuleStub';
import { isPortalxPackageEnabledOnBoot } from '../oss/excludedModuleStub';

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
import { RouteLoadingLogoOrbit } from './RouteLoadingLogoOrbit';
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
  /** Screen-reader only — never shown in the loading stack. */
  label?: string;
  /** Portal logo URL. When omitted, uses portal Settings brand (/api/boot shells) or cache. */
  logoSrc?: string;
  logoAlt?: string;
  /** Live preview or tests — skips boot config when set. */
  experienceOverride?: EffectiveRouteLoadingExperience | null;
  /**
   * Settings (or other) in-form preview — must not participate in boot splash
   * handoff or formatted-reveal "nested loader" waits.
   */
  preview?: boolean;
};

function isPortalxLoadingIdentity(pathname: string): boolean {
  return guessPortalSegmentFromPathname(pathname) === EXTX_PUBLIC_PORTAL_SEGMENT;
}

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
  orbitGlow: boolean;
  orbitAnimate: boolean;
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
  orbitGlow,
  orbitAnimate,
}) => {
  const embedded = variant === 'embedded';
  const resolvedSrc = src?.trim();
  const hasPortalLogo = Boolean(resolvedSrc);
  const hasVisual = showAppEndMark || hasPortalLogo;

  if (!hasVisual) {
    return null;
  }

  const shape = resolveLogoStageShape(showAppEndMark, resolvedSrc);

  const logoInner = showAppEndMark ? (
    <span className="appendo-logo-themed app-route-loading__logo app-route-loading__logo--appendo" />
  ) : (
    <img
      src={resolvedSrc}
      alt={alt}
      className="app-route-loading__logo object-contain"
      draggable={false}
      decoding="async"
    />
  );

  return (
    <div
      className={cn(
        'app-route-loading__logo-stage',
        `app-route-loading__logo-stage--${shape}`,
        embedded && 'app-route-loading__logo-stage--embedded',
      )}
      aria-hidden={showAppEndMark || hasPortalLogo ? true : undefined}
    >
      <RouteLoadingLogoOrbit
        enabled={orbitGlow}
        animate={orbitAnimate}
        innerClassName="app-route-loading__logo-frame"
      >
        {logoInner}
      </RouteLoadingLogoOrbit>
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
  preview = false,
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
  const showAppEndMark = !logo.custom && !logo.src && !portalRouteBoot;
  const hasLogoStage = showAppEndMark || Boolean(logo.src?.trim());
  const portalxIdentity =
    isPortalxLoadingIdentity(pathname) && isPortalxPackageEnabledOnBoot(bootPayload);
  const participatesInBootSplash = !preview && variant === 'fullscreen';
  const splashDelegated = participatesInBootSplash && isAppBootSplashDelegated();

  useLayoutEffect(() => {
    if (preview || !portalxIdentity) {
      return;
    }
    document.documentElement.setAttribute('data-loading-identity', 'portalx');
  }, [portalxIdentity, preview]);

  useLayoutEffect(() => {
    if (!participatesInBootSplash) {
      return;
    }
    const logoPath = logo.src?.trim();
    if (logoPath) {
      syncAppBootSplashLogo(logoPath);
    }
    return () => {
      dismissAppBootSplashIfNoFullscreenLoading();
    };
  }, [logo.src, participatesInBootSplash]);

  const rootClass = cn(
    variant === 'embedded'
      ? 'app-route-loading app-route-loading--embedded flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 bg-[var(--color-surface-base,#ffffff)]'
      : 'app-route-loading app-route-loading--fullscreen relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 py-10',
    portalxIdentity && 'app-route-loading--portalx',
    splashDelegated && 'app-route-loading--splash-delegated',
    routeLoadingExperienceClassName(experience),
    className,
  );

  const logoStage = experience.showLogo && hasLogoStage ? (
    <LoadingLogoStage
      variant={variant}
      src={logo.src}
      alt={alt}
      showAppEndMark={showAppEndMark}
      orbitGlow={experience.logoGlow}
      orbitAnimate={experience.logoBreathe}
    />
  ) : null;

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="app-route-loading"
      data-variant={variant}
      data-route-loading-preview={preview ? 'true' : undefined}
    >
      <div
        className={cn(
          'app-route-loading__stack relative z-10 flex flex-col items-center',
          variant === 'embedded' ? 'gap-3' : 'gap-5',
        )}
        style={buildRouteLoadingExperienceStyle(experience)}
      >
        {logoStage}
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
};