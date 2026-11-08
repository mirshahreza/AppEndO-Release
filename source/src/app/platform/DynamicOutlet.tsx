import React, { useEffect } from 'react';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { RouteNotFoundPage } from '../../pages/RouteNotFoundPage';
import { LazyRoute } from '../routes/LazyRoute';
import { RequireRouteBindingAccess } from '../guards/RequireRouteBindingAccess';
import type { PlatformRouteBinding } from '../../shared/api/contracts/platform/types';
import { usePlatformMount } from './PlatformMountContext';
import { usePlatformConfig } from './PlatformConfigProvider';
import { DesktopOnlyGate } from '../../layouts/adminShell/DesktopOnlyGate';
import { isBindingAllowedForViewport } from '../../shared/lib/resolveBindingMinViewport';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import {
  getPageModuleByKey,
  getRouteBindingById,
  parseComponentAloneRoutePattern,
} from './platformConfigHelpers';
import { PackagePageModule } from './PackagePageModule';
import { resolvePageModule } from './resolvers';
import { useOptionalPortal } from './PortalContext';
import { resolvePortalNotFoundPageRef } from './resolvePortalNotFoundPage';
import { ActiveStudioPageKeyProvider } from '../../shared/context/ActiveStudioPageKeyContext';
import { setDevToolbarActivePage } from '../../shared/lib/devToolbarSignal';
import { useCultureT } from '../../core/culture/CultureContext';
import { errorsKey } from '../../core/culture/translations/cultureKeyHelpers';

export type DynamicOutletProps = {
  binding: PlatformRouteBinding;
};

const DesignerPublishedPage = React.lazy(() =>
  import('./DesignerPublishedPage').then((module) => ({ default: module.DesignerPublishedPage })),
);

const PublishedDesignerPage: React.FC<{ slug: string }> = ({ slug }) => (
  <LazyRoute>
    <DesignerPublishedPage slug={slug} />
  </LazyRoute>
);

const MountRuntimeMissingPage: React.FC<{ pageKey: string }> = ({ pageKey }) => {
  const t = useCultureT();
  const message = t(errorsKey('pageModuleNotAvailable.message')).replace('{pageKey}', pageKey);
  const parts = message.split(pageKey);
  return (
    <div className="flex min-h-[240px] items-center justify-center p-6">
      <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
        {parts.length === 2 ? (
          <>
            {parts[0]}
            <span className="font-semibold">{pageKey}</span>
            {parts[1]}
          </>
        ) : (
          message
        )}
      </div>
    </div>
  );
};

const ResolvedPage: React.FC<{ loaderRef: string }> = ({ loaderRef }) => {
  const t = useCultureT();
  const resolved = resolvePageModule(loaderRef);
  if (!resolved) {
    const message = t(errorsKey('pageModuleUnsupportedLoader.message')).replace('{loaderRef}', loaderRef);
    const parts = message.split(loaderRef);
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          {parts.length === 2 ? (
            <>
              {parts[0]}
              <span className="font-semibold">{loaderRef}</span>
              {parts[1]}
            </>
          ) : (
            message
          )}
        </div>
      </div>
    );
  }

  const { component: PageComponent, lazy } = resolved;

  if (lazy) {
    return (
      <LazyRoute>
        <PageComponent />
      </LazyRoute>
    );
  }

  return <PageComponent />;
};

const DefaultMountNotFound: React.FC = () => {
  const { toMountPath } = usePlatformMount();
  return (
    <RouteNotFoundPage
      variant="embedded"
      homeTo={toMountPath('')}
      homeLabel="Go to dashboard"
    />
  );
};

/**
 * Portal-aware 404: when the active portal shell has `notFoundPageRef`, render that
 * published Designer page; otherwise fall back to the hardcoded RouteNotFoundPage.
 */
export const PortalAwareNotFoundPage: React.FC<{
  variant?: 'fullscreen' | 'embedded';
  homeTo?: string;
  homeLabel?: string;
}> = ({
  variant = 'embedded',
  homeTo,
  homeLabel,
}) => {
  const { config } = usePlatformConfig();
  const portal = useOptionalPortal();
  const customRef = resolvePortalNotFoundPageRef(config, portal);

  if (customRef) {
    return (
      <div data-testid="portal-custom-not-found-page" className="min-h-0 flex-1 overflow-auto">
        <PublishedDesignerPage slug={customRef} />
      </div>
    );
  }

  if (variant === 'embedded' && homeTo == null && homeLabel == null) {
    return <DefaultMountNotFound />;
  }

  return (
    <RouteNotFoundPage
      variant={variant}
      homeTo={homeTo}
      homeLabel={homeLabel}
    />
  );
};

export const DynamicOutlet: React.FC<DynamicOutletProps> = ({ binding }) => {
  const { config } = usePlatformConfig();
  const { toMountPath } = usePlatformMount();
  const viewportTier = useViewportTier();
  const activeBinding = getRouteBindingById(config, binding.id) ?? binding;
  const componentAlonePath = parseComponentAloneRoutePattern(activeBinding.routePattern);
  const pageModule = getPageModuleByKey(config, activeBinding.pageKey);

  useEffect(() => {
    setDevToolbarActivePage(
      componentAlonePath
        ? { pageKey: activeBinding.pageKey, loaderKind: 'designer', loaderRef: componentAlonePath }
        : pageModule
          ? { pageKey: activeBinding.pageKey, loaderKind: pageModule.loaderKind, loaderRef: pageModule.loaderRef }
          : null,
    );
  }, [activeBinding.pageKey, componentAlonePath, pageModule?.loaderKind, pageModule?.loaderRef]);

  if (!isBindingAllowedForViewport(activeBinding, viewportTier)) {
    return (
      <DesktopOnlyGate
        homeTo={toMountPath('users')}
        homeLabel="Back to Users"
      />
    );
  }

  if (!activeBinding.enabled) {
    return (
      <PortalAwareNotFoundPage
        variant="embedded"
        homeTo={toMountPath('')}
        homeLabel="Go to dashboard"
      />
    );
  }

  if (!componentAlonePath && (!pageModule || !pageModule.enabled)) {
    return <MountRuntimeMissingPage pageKey={activeBinding.pageKey} />;
  }

  const page = componentAlonePath
    ? <PublishedDesignerPage slug={componentAlonePath} />
    : pageModule!.loaderKind === 'designer'
      ? <PublishedDesignerPage slug={pageModule.loaderRef} />
      : pageModule!.loaderKind === 'package'
        ? <PackagePageModule loaderRef={pageModule.loaderRef} />
        : <ResolvedPage loaderRef={pageModule!.loaderRef} />;

  return (
    <RequireRouteBindingAccess
      binding={activeBinding}
      pageModule={pageModule ?? null}
      redirectTo={toMountPath('')}
    >
      <ActiveStudioPageKeyProvider pageKey={activeBinding.pageKey}>
        {page}
      </ActiveStudioPageKeyProvider>
    </RequireRouteBindingAccess>
  );
};

export const MountRouteFallback: React.FC = () => <PortalAwareNotFoundPage />;
