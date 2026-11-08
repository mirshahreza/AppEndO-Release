import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { getPlatformNavComponentMeta } from '../../../shared/api/contracts/platform/platformNavigationComponents';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import type { ShellNavRegionId } from '../../../shared/lib/navTreeFilter';
import {
  composeStudioSidebarNav,
  filterNavGroupsByItemRegion,
  filterNavGroupsForRegion,
} from '../../../shared/lib/navTreeFilter';
import type { AdminShellNavItem } from '../types';
import { useShellNavigate } from '../../../shared/ui/shell/useShellNavigate';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import {
  getMountById,
  resolveExperiencePortalNavigationRef,
  resolveRegistryShellForPortal,
} from '../../../app/platform/platformConfigHelpers';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { useDesignerPublishedShellSidebarCollapsed } from '../../../app/platform/DesignerPublishedShellChrome';
import { buildAdminShellNav } from '../buildAdminShellNav';
import { translateAdminShellNav } from '../translateAdminShellNav';

export function useShellNavigationHost(input: {
  navigationRef?: string | null;
  componentKey: string;
  regionOverride?: ShellNavRegionId;
}) {
  const { config } = usePlatformConfig();
  const mount = useOptionalPlatformMount();
  const portal = useOptionalPortal();
  const culture = useOptionalCulture();
  const isSidebarCollapsed = useDesignerPublishedShellSidebarCollapsed();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const navigateShell = useShellNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const effectiveMount = useMemo(
    () => mount ?? getMountById(config, STUDIO_MOUNT_ID),
    [config, mount],
  );

  const shell = useMemo(
    () => (portal ? resolveRegistryShellForPortal(config, portal) ?? null : null),
    [config, portal],
  );

  const resolvedNavigationRef = useMemo(
    () => resolveExperiencePortalNavigationRef(portal, shell, input.navigationRef),
    [input.navigationRef, portal, shell],
  );

  const region = input.regionOverride
    ?? getPlatformNavComponentMeta(input.componentKey)?.region
    ?? 'side';

  const navGroups = useMemo(() => {
    if (!effectiveMount) {
      return [];
    }

    return buildAdminShellNav({
      config,
      mountId: effectiveMount.id,
      mountPathPrefix: effectiveMount.pathPrefix,
      currentUser,
      navigationRef: resolvedNavigationRef,
      currentCultureId: culture?.cultureId,
      currentPortalSegment: portal?.portalSegment ?? STUDIO_PORTAL_SEGMENT,
    });
  }, [
    config,
    culture?.cultureId,
    currentUser,
    effectiveMount,
    portal?.portalSegment,
    resolvedNavigationRef,
  ]);

  const localizedGroups = useMemo(() => {
    if (!culture?.ready) {
      return navGroups;
    }
    return translateAdminShellNav(navGroups, culture.t);
  }, [culture?.ready, culture?.t, navGroups]);

  const composedSidebar = useMemo(
    () => composeStudioSidebarNav(localizedGroups),
    [localizedGroups],
  );

  const quickNavItems: AdminShellNavItem[] = composedSidebar.quickNavItems;

  const filteredGroups = useMemo(() => {
    if (region === 'side') {
      return filterNavGroupsForRegion('side', composedSidebar.treeGroups);
    }

    if (region === 'top') {
      if (quickNavItems.length > 0) {
        return [];
      }
      return filterNavGroupsForRegion('top', localizedGroups);
    }

    if (region === 'footer') {
      if (quickNavItems.length > 0) {
        return [];
      }
      return filterNavGroupsByItemRegion(localizedGroups, 'sidebar-footer');
    }

    return filterNavGroupsForRegion(region, localizedGroups);
  }, [composedSidebar.treeGroups, localizedGroups, quickNavItems.length, region]);

  const isRtl = culture?.direction === 'rtl';

  const onNavigate = navigateShell;

  const isExperienceMount = mount?.designerRoutePropagation === 'auto';

  return {
    mount: effectiveMount,
    region,
    navigationRef: resolvedNavigationRef,
    navGroups: localizedGroups,
    quickNavItems,
    filteredGroups,
    pathname,
    isSidebarCollapsed: region === 'side' ? isSidebarCollapsed : false,
    isRtl,
    expandedGroups,
    setExpandedGroups,
    onNavigate,
    isExperienceMount,
  };
}
