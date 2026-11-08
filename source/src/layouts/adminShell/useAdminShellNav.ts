import { useEffect, useMemo } from 'react';
import type { AuthUserLike } from '../../app/guards/roleAccess';
import { useOptionalPortal } from '../../app/platform/PortalContext';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { usePlatformConfig } from '../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../app/platform/PlatformMountContext';
import { resolveRegistryShellForPortal } from '../../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';
import { loadNavigationIconPack } from '../../shared/lib/navigationIcons/navigationIconPacks';
import { filterAdminShellNavByViewport } from '../../shared/lib/filterAdminShellNavByViewport';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import { buildAdminShellNav } from './buildAdminShellNav';
import { translateAdminShellNav } from './translateAdminShellNav';
import type { AdminShellNavGroup } from './types';

export function useAdminShellNav(currentUser: AuthUserLike): AdminShellNavGroup[] {
  const viewportTier = useViewportTier();
  const { config } = usePlatformConfig();
  const mount = useOptionalPlatformMount();
  const mountId = mount?.id ?? STUDIO_MOUNT_ID;
  const pathPrefix = mount?.pathPrefix ?? '';
  const culture = useOptionalCulture();
  const application = useOptionalPortal();
  const shell = application ? resolveRegistryShellForPortal(config, application) : undefined;

  useEffect(() => {
    void loadNavigationIconPack('lucide');
    void loadNavigationIconPack('tabler');
  }, []);

  return useMemo(() => {
    const nav = buildAdminShellNav({
      config,
      mountId,
      mountPathPrefix: pathPrefix,
      currentUser,
      navigationRef: shell?.navigationRef,
      currentCultureId: culture?.cultureId,
      currentPortalSegment: application?.portalSegment ?? STUDIO_PORTAL_SEGMENT,
    });

    const localized = culture?.ready ? translateAdminShellNav(nav, culture.t) : nav;
    return filterAdminShellNavByViewport(localized, viewportTier);
  }, [
    application?.portalSegment,
    config,
    culture?.cultureId,
    culture?.ready,
    culture?.t,
    currentUser,
    mountId,
    pathPrefix,
    shell?.navigationRef,
    viewportTier,
  ]);
}
