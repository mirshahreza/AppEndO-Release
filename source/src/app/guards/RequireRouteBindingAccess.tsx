import React from 'react';
import { Navigate } from 'react-router-dom';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import type { PlatformPageModule, PlatformRouteBinding } from '../../shared/api/contracts/platform/types';
import { normalizeFunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import { canAccessRouteBinding } from './roleAccess';

export const resolveRouteBindingGateAuth = (
  binding: PlatformRouteBinding,
  pageModule?: PlatformPageModule | null,
): PlatformRouteBinding['auth'] => {
  if (binding.auth != null) {
    return binding.auth;
  }

  const defaultRoles = pageModule?.defaultRoles;
  if (!defaultRoles || defaultRoles.length === 0) {
    return null;
  }

  return normalizeFunctionAccessControl({
    accessMode: 'specific',
    allowRoles: defaultRoles,
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  });
};

export type RequireRouteBindingAccessProps = {
  binding: PlatformRouteBinding;
  pageModule?: PlatformPageModule | null;
  redirectTo: string;
  children: React.ReactNode;
};

/** Enforces route binding auth via the same access-control model as portals and server functions. */
export const RequireRouteBindingAccess: React.FC<RequireRouteBindingAccessProps> = ({
  binding,
  pageModule,
  redirectTo,
  children,
}) => {
  const { currentUser, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <AppRouteLoading variant="embedded" />;
  }

  const effectiveBinding: PlatformRouteBinding = {
    ...binding,
    auth: resolveRouteBindingGateAuth(binding, pageModule),
  };

  if (canAccessRouteBinding(effectiveBinding, currentUser)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={redirectTo} replace />;
};
