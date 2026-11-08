import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isDashboardChromeStrippedView } from '../../shared/lib/dashboardCanvas';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessPortalAuth } from '../guards/roleAccess';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import { PortalContextProvider } from './PortalContext';
import { usePlatformConfig } from './PlatformConfigProvider';
import { useOptionalPlatformMount } from './PlatformMountContext';
import { getShellByKey, shouldRedirectPortalEntry, resolveShellEntryRedirectPath } from './platformConfigHelpers';
import { parseDesignerShellEntry } from '../../shared/lib/designerShellEntry';
import { resolveShellComponent } from './resolvers';
import { resolvePortalShellFromPathname } from './PortalUrlResolver';
import { HAWIETY_PORTAL_SEGMENT } from '../../core/packages/hawietyPackage';
import { DeveloperToolbar } from './DeveloperToolbar';
import { resolvePortalBrand } from '../../shared/api/contracts/platform/portalBrand';
import { cachePortalBrand } from '../../shared/lib/portalBrandCache';

export type { PortalContextValue } from './PortalContext';
export { usePortal, useOptionalPortal } from './PortalContext';

const PortalRuntimeMissingShell: React.FC<{ shellKey: string }> = ({ shellKey }) => (
  <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
    <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
      No shell is configured for portal <span className="font-semibold">{shellKey}</span>.
    </div>
  </div>
);

export const PortalShell: React.FC = () => {
  const { pathname, search } = useLocation();
  const { config, version, refetch: refetchPlatformConfig } = usePlatformConfig();
  const mount = useOptionalPlatformMount();
  const { currentUser, isLoading } = useAuth();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const resolved = resolvePortalShellFromPathname(pathname, config, mountId);
  const shell = getShellByKey(config, resolved.shellKey);
  const entryRedirectPath = shell && shouldRedirectPortalEntry(shell, resolved.pageRemainderPath)
    ? resolveShellEntryRedirectPath(shell)
    : null;

  const ShellLayout = shell?.enabled && !entryRedirectPath
    ? resolveShellComponent(shell.entry)
    : null;

  const contextShellKey = shell
    ? (parseDesignerShellEntry(shell.entry)?.shellKey ?? resolved.shellKey)
    : resolved.shellKey;

  const brand = useMemo(
    () => resolvePortalBrand(shell?.brand, shell?.name),
    [shell?.brand, shell?.name],
  );

  const value = useMemo(
    () => ({
      portalSegment: resolved.portalSegment,
      shellKey: contextShellKey,
      pageRemainderPath: resolved.pageRemainderPath,
    }),
    [contextShellKey, resolved.portalSegment, resolved.pageRemainderPath],
  );

  useEffect(() => {
    cachePortalBrand(resolved.portalSegment, brand);
    if (brand.title && typeof document !== 'undefined' && document.title === 'AppEndO') {
      document.title = brand.title;
    }
  }, [brand, resolved.portalSegment]);

  // After Hawiety install (CLI or another tab), boot cache can omit the portal shell until refetch.
  useEffect(() => {
    if (resolved.shellKey !== HAWIETY_PORTAL_SEGMENT) {
      return;
    }
    if (getShellByKey(config, HAWIETY_PORTAL_SEGMENT)) {
      return;
    }
    void refetchPlatformConfig();
    const intervalId = window.setInterval(() => {
      void refetchPlatformConfig();
    }, 2_500);
    return () => window.clearInterval(intervalId);
  }, [config, refetchPlatformConfig, resolved.shellKey]);

  const loading = (
    <AppRouteLoading logoSrc={brand.logoUrl} logoAlt={brand.title} />
  );

  if (entryRedirectPath) {
    return <Navigate to={entryRedirectPath} replace />;
  }

  if (!ShellLayout) {
    return <PortalRuntimeMissingShell shellKey={resolved.shellKey} />;
  }

  if (isLoading && !currentUser) {
    return loading;
  }

  if (!canAccessPortalAuth(shell.auth, currentUser)) {
    return <Navigate to={mount?.pathPrefix?.trim() || '/'} replace />;
  }

  const chromeStripped = isDashboardChromeStrippedView(pathname, search);

  return (
    <PortalContextProvider value={value}>
      <React.Suspense fallback={loading}>
        <ShellLayout key={`${version}:${shell.entry}`} />
      </React.Suspense>
      {chromeStripped ? null : <DeveloperToolbar />}
    </PortalContextProvider>
  );
};

export const PortalHost: React.FC = () => <PortalShell />;
