import {
  Blocks,
  Braces,
  CalendarClock,
  Code2,
  DatabaseZap,
  FileText,
  GitBranch,
  LayoutDashboard,
  Puzzle,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import {
  navDescriptionKey,
  navLabelKey,
} from '../../core/culture/cultureShellKeys';
import type { AuthUserLike } from '../../app/guards/roleAccess';
import { canAccessRouteBinding, isAdminUser } from '../../app/guards/roleAccess';
import {
  STUDIO_MOUNT_ID,
  toPortalRoutePattern,
} from '../../shared/api/contracts/platform/mountConstants';
import {
  isOpsDashboardPageKey,
  OPS_DASHBOARD_ROUTES,
} from '../../shared/lib/opsDashboardCatalog';
import {
  buildMountAbsolutePath,
  getBindingsForMount,
  normalizeRoutePatternForNavPath,
  withNavLandingPath,
} from '../../app/platform/platformConfigHelpers';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import type { DashboardQuickAction } from './types';

export function interpolateCultureTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** Shortcuts that are not already represented as dashboard KPIs or health drill-ins. */
export const DASHBOARD_QUICK_ACTION_PAGE_KEYS = new Set([
  'cache',
  'git',
  'settings',
]);

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Braces,
  Code2,
  Blocks,
  Puzzle,
  Settings,
  CalendarClock,
  DatabaseZap,
  GitBranch,
  Users,
  FileText,
};

export function buildDashboardQuickActions(
  config: PlatformRuntimeConfig,
  mountId: string,
  mountPathPrefix: string,
  currentUser: AuthUserLike,
  t?: TranslationFn,
): DashboardQuickAction[] {
  const silentLookup = { missing: 'silent' as const };
  const translate = (key: string, fallback: string): string => {
    if (!t) {
      return fallback;
    }
    const translated = t(key, silentLookup);
    return translated !== key ? translated : fallback;
  };

  const actions: DashboardQuickAction[] = [];

  for (const binding of getBindingsForMount(config, mountId)) {
    if (!binding.nav?.label || !binding.enabled) {
      continue;
    }

    if (!canAccessRouteBinding(binding, currentUser)) {
      continue;
    }

    if (!binding.pageKey || !DASHBOARD_QUICK_ACTION_PAGE_KEYS.has(binding.pageKey)) {
      continue;
    }

    const navRelativePath = withNavLandingPath(normalizeRoutePatternForNavPath(binding.routePattern));
    const path = buildMountAbsolutePath(mountPathPrefix, navRelativePath);
    if (path === mountPathPrefix) {
      continue;
    }

    const iconName = binding.nav.icon ?? 'LayoutDashboard';
    const pageKey = binding.pageKey;
    actions.push({
      path,
      label: pageKey ? translate(navLabelKey(pageKey), binding.nav.label) : binding.nav.label,
      description: pageKey && binding.nav.description
        ? translate(navDescriptionKey(pageKey), binding.nav.description)
        : binding.nav.description,
      icon: ICON_MAP[iconName] ?? LayoutDashboard,
      colorClass: binding.nav.color ?? 'text-slate-500',
    });
  }

  return actions.sort((left, right) => left.label.localeCompare(right.label));
}

export function resolveDashboardPagePath(
  config: PlatformRuntimeConfig,
  mountId: string,
  mountPathPrefix: string,
  currentUser: AuthUserLike,
  pageKey: string,
): string | undefined {
  const binding = getBindingsForMount(config, mountId).find((item) => item.pageKey === pageKey);
  if (!binding?.nav?.label || !binding.enabled) {
    return undefined;
  }

  if (!canAccessRouteBinding(binding, currentUser)) {
    return undefined;
  }

  const navRelativePath = withNavLandingPath(normalizeRoutePatternForNavPath(binding.routePattern));
  const path = buildMountAbsolutePath(mountPathPrefix, navRelativePath);
  return path === mountPathPrefix ? undefined : path;
}

function buildStudioRelativePath(
  mountId: string,
  mountPathPrefix: string,
  routePattern: string,
): string | undefined {
  const navRelativePath = withNavLandingPath(normalizeRoutePatternForNavPath(routePattern));
  const path = buildMountAbsolutePath(mountPathPrefix, navRelativePath);
  return path === mountPathPrefix ? undefined : path;
}

function fallbackOpsDashboardStudioPath(
  mountId: string,
  mountPathPrefix: string,
  currentUser: AuthUserLike,
  pageKey: string,
): string | undefined {
  if (!isOpsDashboardPageKey(pageKey) || !isAdminUser(currentUser)) {
    return undefined;
  }

  const pattern = OPS_DASHBOARD_ROUTES[pageKey].pattern;
  const routePattern = mountId === STUDIO_MOUNT_ID ? pattern : toPortalRoutePattern(pattern);
  return buildStudioRelativePath(mountId, mountPathPrefix, routePattern);
}

/** Studio path for a pageKey even when the binding has `nav: null` (Insights). */
export function resolveStudioPagePath(
  config: PlatformRuntimeConfig,
  mountId: string,
  mountPathPrefix: string,
  currentUser: AuthUserLike,
  pageKey: string,
): string | undefined {
  const binding = getBindingsForMount(config, mountId).find((item) => item.pageKey === pageKey);
  if (binding) {
    if (!binding.enabled || !canAccessRouteBinding(binding, currentUser)) {
      return undefined;
    }

    return buildStudioRelativePath(mountId, mountPathPrefix, binding.routePattern);
  }

  if (config.bindings.some((item) => item.pageKey === pageKey)) {
    return undefined;
  }

  return fallbackOpsDashboardStudioPath(mountId, mountPathPrefix, currentUser, pageKey);
}
