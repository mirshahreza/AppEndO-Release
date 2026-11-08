import type { AppShellHeaderBreadcrumbSegment } from '../appShell/AppShellHeader';
import type { AdminShellHeaderContext } from './buildAdminShellNav';

export type ShellHeaderOverride = {
  label?: string;
  description?: string;
  icon?: string;
  groupLabel?: string | null;
  titleTrail?: string[];
  breadcrumbTrail?: AppShellHeaderBreadcrumbSegment[];
};

export type ResolvedShellHeaderModule = {
  label?: string;
  description?: string;
  icon?: string;
  groupLabel?: string | null;
  titleTrail?: string[];
  breadcrumbTrail?: AppShellHeaderBreadcrumbSegment[];
};

export function mergeShellHeaderModule(
  headerContext: AdminShellHeaderContext,
  override: ShellHeaderOverride | null | undefined,
): ResolvedShellHeaderModule {
  const base: ResolvedShellHeaderModule = {
    ...headerContext.item,
    groupLabel: headerContext.groupHeading,
    breadcrumbTrail: headerContext.breadcrumbTrail,
  };

  if (!override) {
    return base;
  }

  return {
    ...base,
    label: override.label ?? base.label,
    description: override.description ?? base.description,
    icon: override.icon ?? base.icon,
    groupLabel: override.groupLabel !== undefined ? override.groupLabel : base.groupLabel,
    titleTrail: override.titleTrail ?? base.titleTrail,
    breadcrumbTrail: override.breadcrumbTrail ?? base.breadcrumbTrail,
  };
}
