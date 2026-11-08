import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { bootstrapCultureRegistry } from '../../core/culture/CultureRegistry';
import { setPlatformWebFonts } from '../../core/culture/platformWebFontRegistry';
import { bootstrapCultureTranslationRuntime } from '../../core/culture/CultureTranslationOverrides';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { AppButton } from '../../shared/ui/AppButton';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { queryClient } from '../../shared/api/queryClient';
import { seedAppBootQueryCaches, useAppBootQuery } from '../../shared/api/queries/boot';
import { platformQueryKeys } from '../../shared/api/queries/platform';
import {
  primePortalBrandCacheFromShells,
  readCachedPortalBrandForPathname,
} from '../../shared/lib/portalBrandCache';
import { isPublicAppPath } from './publicAppPaths';

type PlatformConfigContextValue = {
  config: PlatformRuntimeConfig;
  version: string;
  refetch: () => Promise<unknown>;
};

const PlatformConfigContext = createContext<PlatformConfigContextValue | null>(null);

const PlatformConfigBootError: React.FC<{
  message: string;
  onRetry: () => void;
}> = ({ message, onRetry }) => {
  const t = useOptionalCultureT();

  return (
  <div className="flex min-h-screen w-full items-center justify-center bg-surface-loading p-6">
    <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
      <h1 className="text-base font-semibold text-slate-900">{t('shell.platformConfigUnavailable')}</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <div className="mt-4">
        <AppButton intent="utility" size="sm" onClick={onRetry}>
          {t('errors.retry')}
        </AppButton>
      </div>
    </div>
  </div>
  );
};

export const PlatformConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useOptionalCultureT();
  const { pathname } = useLocation();
  const isPublicRoute = isPublicAppPath(pathname);
  const {
    data: bootPayload,
    isLoading,
    isPending,
    isError,
    error,
    refetch,
  } = useAppBootQuery();

  if (bootPayload) {
    bootstrapCultureRegistry({
      enabledCulturePackIds: bootPayload.cultures.enabledCulturePackIds,
      defaultCultureId: bootPayload.cultures.defaultCultureId,
      packs: bootPayload.cultures.packs ?? [],
    });
  }

  useEffect(() => {
    if (!bootPayload) {
      return;
    }

    seedAppBootQueryCaches(queryClient, bootPayload);
    setPlatformWebFonts(bootPayload.webFonts ?? []);
    bootstrapCultureTranslationRuntime(bootPayload.cultureTranslations);
    primePortalBrandCacheFromShells(bootPayload.runtimeConfig.shells);
  }, [bootPayload]);

  const value = useMemo<PlatformConfigContextValue | null>(() => {
    if (!bootPayload) {
      return null;
    }

    primePortalBrandCacheFromShells(bootPayload.runtimeConfig.shells);

    return {
      config: bootPayload.runtimeConfig,
      version: bootPayload.runtimeConfig.version,
      refetch: async () => {
        await refetch();
        await queryClient.invalidateQueries({ queryKey: platformQueryKeys.all });
      },
    };
  }, [bootPayload, refetch]);

  if (!value && !isPublicRoute) {
    const cachedBrand = readCachedPortalBrandForPathname(pathname);
    const bootStillPending = (isPending || isLoading) && !isError;
    if (bootStillPending) {
      return (
        <AppRouteLoading
          logoSrc={cachedBrand?.logoUrl}
          logoAlt={cachedBrand?.title}
        />
      );
    }

    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : t('errors.platformConfigLoadFailed');
    return (
      <PlatformConfigBootError
        message={message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!value) {
    return <>{children}</>;
  }

  return (
    <PlatformConfigContext.Provider value={value}>{children}</PlatformConfigContext.Provider>
  );
};

export function usePlatformConfig(): PlatformConfigContextValue {
  const context = useContext(PlatformConfigContext);
  if (!context) {
    throw new Error('usePlatformConfig must be used within PlatformConfigProvider.');
  }
  return context;
}

export function useOptionalPlatformConfig(): PlatformConfigContextValue | null {
  return useContext(PlatformConfigContext);
}
