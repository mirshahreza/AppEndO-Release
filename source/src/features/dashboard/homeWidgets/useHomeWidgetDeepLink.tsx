import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCultureT } from '../../../core/culture/CultureContext';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { useAuth } from '../../../contexts/AuthContext';
import { resolveDashboardPagePath } from '../constants';
import type { HomeWidgetDeepLink } from '../../../shared/api/contracts/home-widgets';

export function useHomeWidgetDeepLinkPath(deepLink: HomeWidgetDeepLink): string | null {
  const { config } = usePlatformConfig();
  const { mountId, pathPrefix } = usePlatformMount();
  const { currentUser } = useAuth();

  return useMemo(() => {
    const base = resolveDashboardPagePath(config, mountId, pathPrefix, currentUser, deepLink.pageKey);
    if (!base) {
      return null;
    }
    const url = new URL(base, 'http://local');
    if (deepLink.query) {
      for (const [key, value] of Object.entries(deepLink.query)) {
        url.searchParams.set(key, value);
      }
    }
    return `${url.pathname}${url.search}${deepLink.hash ?? ''}`;
  }, [config, currentUser, deepLink.hash, deepLink.pageKey, deepLink.query, mountId, pathPrefix]);
}

type HomeWidgetOpenLinkProps = {
  deepLink: HomeWidgetDeepLink;
  className?: string;
  children?: React.ReactNode;
};

export const HomeWidgetOpenLink: React.FC<HomeWidgetOpenLinkProps> = ({ deepLink, className, children }) => {
  const t = useCultureT();
  const path = useHomeWidgetDeepLinkPath(deepLink);
  if (!path) {
    return null;
  }
  return (
    <Link to={path} className={className}>
      {children ?? t('homeWidget.openModule')}
    </Link>
  );
};
