import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessPortalAuth } from '../guards/roleAccess';
import type { PlatformMount } from '../../shared/api/contracts/platform/types';
import { getShellByKey } from './platformConfigHelpers';
import { usePlatformConfig } from './PlatformConfigProvider';
import { resolvePortalFromPathname } from './PortalUrlResolver';

export type MountAuthGateProps = {
  mount: PlatformMount;
  children: React.ReactNode;
};

export const MountAuthGate: React.FC<MountAuthGateProps> = ({ mount, children }) => {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const location = useLocation();
  const { config } = usePlatformConfig();
  const requireAuth = mount.authProfile?.requireAuth !== false;
  const resolved = resolvePortalFromPathname(location.pathname, config);
  const shell = getShellByKey(config, resolved.shellKey);
  const publicPortal = Boolean(shell && canAccessPortalAuth(shell.auth, null));

  if (!requireAuth || publicPortal) {
    return <>{children}</>;
  }

  // Match PortalShell: session user is set before client-context fallback finishes.
  if (isLoading && !currentUser) {
    return <AppRouteLoading />;
  }

  if (!isAuthenticated) {
    const returnPath = `${location.pathname}${location.search}`;
    const loginPath = `/login?return=${encodeURIComponent(returnPath)}`;
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
};
