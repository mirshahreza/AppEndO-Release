import React from 'react';
import { Navigate } from 'react-router-dom';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultCulturePackId, getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import {
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
  STUDIO_PORTAL_SEGMENT,
} from '../../shared/api/contracts/platform/mountConstants';
import { usePlatformConfig } from './PlatformConfigProvider';
import {
  buildPortalRootPath,
  getEnabledMounts,
  getMountById,
  getShellByKey,
  resolveHomeShellRedirectPath,
  shouldRedirectPortalEntry,
} from './platformConfigHelpers';

export function resolveRootZoneRedirect(
  isAuthenticated: boolean,
  defaultRoute: string | undefined,
  fallbackRoute = '/us/studio',
): string {
  const target = defaultRoute?.trim() || fallbackRoute;
  if (isAuthenticated) {
    return target;
  }

  const segments = target.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments.length === 1 && getEnabledCulturePackIds().includes(segments[0])) {
    return target;
  }

  return '/login';
}

export function resolveDefaultMountRoute(
  config: Parameters<typeof getMountById>[0],
): string {
  const homeRedirect = resolveHomeShellRedirectPath(config);
  if (homeRedirect) {
    return homeRedirect;
  }

  const homeShell = getShellByKey(config, HOME_SHELL_KEY);
  if (homeShell?.enabled && !shouldRedirectPortalEntry(homeShell, '/')) {
    return buildPortalRootPath(`/${getDefaultCulturePackId()}`, ROOT_PORTAL_SEGMENT);
  }

  const studioMount = getMountById(config, 'studio');
  if (studioMount?.enabled) {
    return buildPortalRootPath(`/${getDefaultCulturePackId()}`, STUDIO_PORTAL_SEGMENT);
  }

  const enabledMount = getEnabledMounts(config).find((mount) => mount.defaultRoute?.trim());
  return enabledMount?.defaultRoute?.trim() || '/us/studio';
}

export const RootZonePage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { config } = usePlatformConfig();

  if (isLoading) {
    return <AppRouteLoading />;
  }

  const target = resolveRootZoneRedirect(
    isAuthenticated,
    resolveDefaultMountRoute(config),
  );

  return <Navigate to={target} replace />;
};
