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

/**
 * `groupLabel: null` without `titleTrail` is treated as a merge mistake — keep the nav group.
 * Explicit `null` with a non-empty `titleTrail` suppresses the nav prefix (multi-segment titles).
 */
export function resolveShellHeaderMergedGroupLabel(
  baseGroupLabel: string | null | undefined,
  override: ShellHeaderOverride,
): string | null | undefined {
  if (override.groupLabel === undefined) {
    return baseGroupLabel;
  }
  if (override.groupLabel === null) {
    const hasTitleTrail = Boolean(override.titleTrail && override.titleTrail.length > 0);
    return hasTitleTrail ? null : baseGroupLabel;
  }
  return override.groupLabel;
}

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
    groupLabel: resolveShellHeaderMergedGroupLabel(base.groupLabel, override),
    titleTrail: override.titleTrail ?? base.titleTrail,
    breadcrumbTrail: override.breadcrumbTrail ?? base.breadcrumbTrail,
  };
}
