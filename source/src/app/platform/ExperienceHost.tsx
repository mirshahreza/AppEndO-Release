import React from 'react';

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import type { PlatformMount } from '../../shared/api/contracts/platform/types';

import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';

import { CmsSettingsKeepAliveOutlet } from './CmsSettingsKeepAliveOutlet';
import { isCmsSettingsSectionPath } from './cmsSettingsSoftNav';
import { resolveExperiencePageOutletKey } from './experiencePageOutletKey';
import { DynamicOutlet, MountRouteFallback } from './DynamicOutlet';
import { ROOT_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';
import { PackagePageModule } from './PackagePageModule';

import { MountAuthGate } from './MountAuthGate';

import { usePlatformConfig } from './PlatformConfigProvider';

import { PlatformMountProvider } from './PlatformMountContext';

import { CultureProvider } from './CultureContext';
import { InlineTranslationProvider } from '../../features/access-assistant/inlineTranslation/InlineTranslationProvider';
import { HwyGeoResponsibilityInlineListDialogHost } from '../../features/hwy-geo-responsibility/HwyGeoResponsibilityInlineListDialogHost';

import {
  getMountById,
  getPageModuleByKey,
  resolveRouteBindingForPortalRemainder,
} from './platformConfigHelpers';

import { PortalShell } from './PortalHost';

import { resolveLegacyRoutingRedirect } from './LegacyAdminUrlResolver';
import { resolvePortalFromPathname } from './PortalUrlResolver';

export type ExperienceHostProps = {
  mountId: string;
};

const ExperienceRuntimeDisabled: React.FC<{ mountId: string }> = ({ mountId }) => (
  <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
      Experience <span className="font-semibold">{mountId}</span> is disabled or missing.
    </div>
  </div>
);

const ExperiencePageOutlet: React.FC<{ mount: PlatformMount }> = ({ mount }) => {
  const { pathname } = useLocation();
  const { config } = usePlatformConfig();
  const applicationResolved = resolvePortalFromPathname(pathname, config);
  const binding = resolveRouteBindingForPortalRemainder(
    config,
    mount.id,
    applicationResolved.pageRemainderPath,
    applicationResolved.portalSegment,
  );

  if (binding) {
    // Soft section swaps: keep visited Designer pages mounted so Base Info /
    // General does not remount the whole settings shell on every click.
    if (isCmsSettingsSectionPath(pathname)) {
      return <CmsSettingsKeepAliveOutlet activeBinding={binding} />;
    }
    return (
      <DynamicOutlet
        key={resolveExperiencePageOutletKey(binding.pageKey, pathname)}
        binding={binding}
      />
    );
  }

  const remainder = applicationResolved.pageRemainderPath.trim();
  if (applicationResolved.portalSegment === ROOT_PORTAL_SEGMENT) {
    const pageKey = !remainder || remainder === '/' ? 'cms-site-home' : 'cms-site-article';
    const pageModule = getPageModuleByKey(config, pageKey);
    if (pageModule?.enabled && pageModule.loaderKind === 'package' && pageModule.loaderRef.trim()) {
      return <PackagePageModule loaderRef={pageModule.loaderRef} />;
    }
  }

  return <MountRouteFallback />;
};

const ExperienceRoutes: React.FC<{ mount: PlatformMount }> = ({ mount }) => {
  const { version } = usePlatformConfig();

  return (
    <Routes key={version}>
      <Route element={<PortalShell />}>
        <Route index element={<ExperiencePageOutlet mount={mount} />} />
        <Route path="*" element={<ExperiencePageOutlet mount={mount} />} />
      </Route>
    </Routes>
  );
};

export const ExperienceHost: React.FC<ExperienceHostProps> = ({ mountId }) => {
  const { pathname } = useLocation();
  const { config } = usePlatformConfig();
  const mount = getMountById(config, mountId);
  const { cultureId } = resolveCultureFromPathname(pathname);
  const legacyRedirectPath = resolveLegacyRoutingRedirect(pathname, config);
  if (legacyRedirectPath) {
    return <Navigate to={legacyRedirectPath} replace />;
  }

  if (!mount?.enabled) {
    return <ExperienceRuntimeDisabled mountId={mountId} />;
  }

  if (!mount.pathPrefix) {
    return <ExperienceRuntimeDisabled mountId={mountId} />;
  }

  return (
    <MountAuthGate mount={mount}>
      <PlatformMountProvider mount={mount}>
        <CultureProvider cultureId={cultureId} timezoneOverride={mount.timezoneOverride}>
          <InlineTranslationProvider>
            <HwyGeoResponsibilityInlineListDialogHost>
              <ExperienceRoutes mount={mount} />
            </HwyGeoResponsibilityInlineListDialogHost>
          </InlineTranslationProvider>
        </CultureProvider>
      </PlatformMountProvider>
    </MountAuthGate>
  );
};
