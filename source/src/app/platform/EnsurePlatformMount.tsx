import React from 'react';
import { useLocation } from 'react-router-dom';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import type { PlatformMount } from '../../shared/api/contracts/platform/types';
import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import { usePlatformConfig } from './PlatformConfigProvider';
import { getEnabledMounts, getMountById } from './platformConfigHelpers';
import { PlatformMountProvider, useOptionalPlatformMount } from './PlatformMountContext';

const resolveFallbackMount = (
  pathname: string,
  config: ReturnType<typeof usePlatformConfig>['config'],
): PlatformMount | undefined => {
  const { cultureId } = resolveCultureFromPathname(pathname);
  return getMountById(config, cultureId)
    ?? getMountById(config, STUDIO_MOUNT_ID)
    ?? getEnabledMounts(config)[0];
};

/**
 * Layout chrome must keep rendering even when PlatformMountProvider is missing
 * (preview routes, Fast Refresh context splits). Re-provides the mount from
 * the current URL / studio registry so child hooks can keep using the strict API.
 */
export const EnsurePlatformMount: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const existing = useOptionalPlatformMount();
  const { config } = usePlatformConfig();
  const { pathname } = useLocation();

  if (existing) {
    return children;
  }

  const fallback = resolveFallbackMount(pathname, config);
  if (!fallback?.enabled) {
    return children;
  }

  return <PlatformMountProvider mount={fallback}>{children}</PlatformMountProvider>;
};
