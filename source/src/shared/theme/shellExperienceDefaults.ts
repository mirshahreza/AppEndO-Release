import type {
  PortalShellAppearanceDefaults,
  UserShellExperience,
} from '../api/contracts/appearance/shellExperience.schema';
import { SHELL_EXPERIENCE_SCHEMA_VERSION } from '../api/contracts/appearance/shellExperience.schema';
import {
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
  clampAdminShellSidebarExpandedWidthPx,
  resolveAdminShellSidebarExpandedWidthPx,
} from '../ui/adminShellSidebarWidth';

export const DEFAULT_PORTAL_SHELL_APPEARANCE: PortalShellAppearanceDefaults = {
  version: SHELL_EXPERIENCE_SCHEMA_VERSION,
  sidebarDefaultCollapsed: false,
  sidebarCollapsePolicy: 'rail',
  allowUserSidebarPreference: true,
  sidebarExpandedWidthPx: ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
  layoutWidth: 'fluid',
  layoutWidthUserControl: true,
};

export const EMPTY_USER_SHELL_EXPERIENCE: UserShellExperience = {
  version: SHELL_EXPERIENCE_SCHEMA_VERSION,
  sidebarCollapsed: null,
  layoutWidth: null,
  navExpandedGroups: null,
};

export const mergePortalShellAppearanceDefaults = (
  partial?: Partial<PortalShellAppearanceDefaults> | null,
): PortalShellAppearanceDefaults => ({
  ...DEFAULT_PORTAL_SHELL_APPEARANCE,
  ...(partial ?? {}),
  version: SHELL_EXPERIENCE_SCHEMA_VERSION,
});

export type EffectiveShellExperience = {
  sidebarCollapsed: boolean;
  sidebarCollapsePolicy: PortalShellAppearanceDefaults['sidebarCollapsePolicy'];
  allowUserSidebarPreference: boolean;
  sidebarExpandedWidthPx: number;
  layoutWidth: NonNullable<PortalShellAppearanceDefaults['layoutWidth']>;
  layoutWidthUserControl: boolean;
  navExpandedGroups: string[];
};

export const resolveEffectiveShellExperience = (
  portal: PortalShellAppearanceDefaults,
  user: UserShellExperience | null | undefined,
): EffectiveShellExperience => {
  const mergedPortal = mergePortalShellAppearanceDefaults(portal);
  const sidebarCollapsed = user?.sidebarCollapsed ?? mergedPortal.sidebarDefaultCollapsed ?? false;
  const layoutWidth = user?.layoutWidth ?? mergedPortal.layoutWidth ?? 'fluid';
  const navExpandedGroups = user?.navExpandedGroups ?? [];

  return {
    sidebarCollapsed,
    sidebarCollapsePolicy: mergedPortal.sidebarCollapsePolicy ?? 'rail',
    allowUserSidebarPreference: mergedPortal.allowUserSidebarPreference ?? true,
    sidebarExpandedWidthPx: resolveAdminShellSidebarExpandedWidthPx(mergedPortal.sidebarExpandedWidthPx),
    layoutWidth,
    layoutWidthUserControl: mergedPortal.layoutWidthUserControl ?? true,
    navExpandedGroups,
  };
};

export { clampAdminShellSidebarExpandedWidthPx };
