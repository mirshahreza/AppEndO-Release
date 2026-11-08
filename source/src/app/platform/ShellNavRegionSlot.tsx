import React from 'react';
import {
  PLATFORM_NAV_FLAT_LINKS,
  PLATFORM_NAV_TOP_BAR,
  PLATFORM_NAV_TREE_TWO_LEVEL,
} from '../../shared/api/contracts/platform/platformNavigationComponents';
import {
  SHELL_NAV_REGION_FOOTER,
  SHELL_NAV_REGION_SIDE,
  SHELL_NAV_REGION_TOP,
  type ShellNavRegionSlotId,
} from '../../shared/lib/shellNavRegions';
import {
  resolveShellNavNavigationRef,
  type ShellNavSlotConfigMap,
} from '../../shared/lib/shellNavSlotProps';
import { PlatformNavigationHost } from '../../layouts/adminShell/nav/PlatformNavigationHost';

export type ShellNavRegionSlotProps = {
  slotId: ShellNavRegionSlotId;
  /** Navigation JSON id (platform-registry/navigation/{id}.json). Falls back to shell navigationRef. */
  navigationRef?: string | null;
  slotConfig?: ShellNavSlotConfigMap;
};

const LEGACY_SLOT_COMPONENT_KEYS: Record<ShellNavRegionSlotId, string> = {
  [SHELL_NAV_REGION_SIDE]: PLATFORM_NAV_TREE_TWO_LEVEL,
  [SHELL_NAV_REGION_TOP]: PLATFORM_NAV_TOP_BAR,
  [SHELL_NAV_REGION_FOOTER]: PLATFORM_NAV_FLAT_LINKS,
};

export const ShellNavRegionSlot: React.FC<ShellNavRegionSlotProps> = ({
  slotId,
  navigationRef: navigationRefProp,
  slotConfig,
}) => {
  const navigationRef = React.useMemo(() => {
    const directRef = navigationRefProp?.trim();
    if (directRef) {
      return directRef;
    }

    if (slotConfig) {
      return resolveShellNavNavigationRef(slotId, slotConfig, null);
    }

    return null;
  }, [navigationRefProp, slotConfig, slotId]);

  return (
    <PlatformNavigationHost
      navigationRef={navigationRef}
      componentKey={LEGACY_SLOT_COMPONENT_KEYS[slotId]}
      className="min-h-0 flex-1"
    />
  );
};
