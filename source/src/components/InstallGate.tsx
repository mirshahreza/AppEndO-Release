import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppRouteLoading } from './AppRouteLoading';
import { isPublicAppPath } from '../app/platform/publicAppPaths';
import { readCachedPortalBrandForPathname } from '../shared/lib/portalBrandCache';
import { useInstallStatusQuery } from '../shared/api/queries/install';

const INSTALL_PATH = '/install';

export const InstallGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const isPublicPath = isPublicAppPath(pathname);
  const installQuery = useInstallStatusQuery(true);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (installQuery.isLoading && !installQuery.data) {
    const cachedBrand = readCachedPortalBrandForPathname(pathname);
    return (
      <AppRouteLoading
        logoSrc={cachedBrand?.logoUrl}
        logoAlt={cachedBrand?.title}
      />
    );
  }

  const install = installQuery.data?.install;
  if (install && !install.completed) {
    return <Navigate to={INSTALL_PATH} replace state={{ from: pathname }} />;
  }

  return <>{children}</>;
};
