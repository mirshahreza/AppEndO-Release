import React from 'react';
import { RouteNotFoundPage } from '../../pages/RouteNotFoundPage';
import { useAppBootQuery } from '../api/queries/boot';
import { HAWIETY_PACKAGE_ID } from '../../core/packages/hawietyPackage';

type HawietyPackagePublicGateProps = {
  children: React.ReactElement;
};

/** Renders children only when the Hawiety package is installed and enabled. */
export const HawietyPackagePublicGate: React.FC<HawietyPackagePublicGateProps> = ({ children }) => {
  const boot = useAppBootQuery();
  if (boot.isLoading) {
    return null;
  }
  const enabled = boot.data?.enabledPackages?.includes(HAWIETY_PACKAGE_ID) ?? false;
  if (!enabled) {
    return <RouteNotFoundPage variant="fullscreen" />;
  }
  return children;
};
