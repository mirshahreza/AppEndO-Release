import { useMemo } from 'react';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import {
  buildMountAbsolutePath,
  normalizeRoutePatternForNavPath,
  withNavLandingPath,
} from '../../../app/platform/platformConfigHelpers';
import {
  buildRemoteHubEditRelativePath,
  type RemoteHubPageKey,
} from '../../../shared/routing/remoteHubDeepLink';

export function useRemoteHubConnectionHomePath(
  pageKey: RemoteHubPageKey,
  connectionKey: string | undefined,
): string | null {
  const { mountId, pathPrefix } = usePlatformMount();
  useAuth();

  return useMemo(() => {
    if (!connectionKey?.trim()) {
      return null;
    }
    const relative = buildRemoteHubEditRelativePath(pageKey, connectionKey.trim(), mountId);
    const navRelative = withNavLandingPath(normalizeRoutePatternForNavPath(relative));
    return buildMountAbsolutePath(pathPrefix, navRelative);
  }, [connectionKey, mountId, pageKey, pathPrefix]);
}
