import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { resolveInvalidCulturePrefixRedirect } from './LegacyAdminUrlResolver';

/**
 * Redirects mistyped culture prefixes in the URL (`/ui/`, `/ux/`, …) before routing.
 * React Router only registers enabled culture ids (`us`, `ir`, `iq`).
 */
export const CulturePathGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname, search, hash } = useLocation();
  const redirectPath = resolveInvalidCulturePrefixRedirect(pathname);

  if (redirectPath) {
    return <Navigate to={`${redirectPath}${search}${hash}`} replace />;
  }

  return <>{children}</>;
};
