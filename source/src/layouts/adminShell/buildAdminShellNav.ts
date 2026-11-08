import type { AuthUserLike } from '../../app/guards/roleAccess';
import { canAccessRouteBinding } from '../../app/guards/roleAccess';
import {
  buildBindingNavAbsolutePath,
  buildMountAbsolutePath,
  getBindingsForMount,
  getMountById,
  getPageModuleByKey,
  normalizeRoutePatternForNavPath,
  pathnameMatchesBindingNavPath,
  resolveRouteBindingForPortalRemainder,
  withNavLandingPath,
} from '../../app/platform/platformConfigHelpers';
import { resolvePortalFromPathname } from '../../app/platform/PortalUrlResolver';
import type { PlatformRouteBinding, PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { STUDIO_MOUNT_ID, STUDIO_PORTAL_SEGMENT, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNavigationManifestFromBindings,
  getNavigationManifestById,
  STUDIO_CORE_NAV_GROUP_ORDER,
  type NavigationManifest,
  type NavigationManifestItem,
} from '../../shared/api/contracts/platform/navigation';
import { buildNavigationItemAbsolutePath } from '../../shared/lib/navigationItemPath';
import { navDescriptionKey, navGroupKey, navLabelKey } from '../../core/culture/cultureShellKeys';
import { createAdminNavSeparatorItem } from './nav/navSeparatorOptions';
import { pathnameMatchesWorkflowDesignerNavPath } from '../../features/workflows/workflowRoute';
import { NESTED_EDITOR_EDIT_SEGMENT } from '../../shared/routing/nestedEditorDeepLink';
import { resolveNavGroupDisplayLabel, resolveNavGroupIcon } from './navGroupIcons';
import type { AdminShellNavGroup, AdminShellNavItem } from './types';

export type BuildAdminShellNavInput = {
  config: PlatformRuntimeConfig;
  mountId: string;
  mountPathPrefix: string;
  currentUser: AuthUserLike;
  navigationRef?: string | null;
  manifest?: NavigationManifest | null;
  /** Active culture from URL — used when item.cultureId is empty. */
  currentCultureId?: string;
  /** Active portal segment from URL — used when item.portalSegment is empty. */
  currentPortalSegment?: string;
};

function bindingAbsolutePath(mountPathPrefix: string, binding: PlatformRouteBinding): string {
  return buildBindingNavAbsolutePath(mountPathPrefix, binding);
}

function compareGroups(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return -1;
  }

  if (right === null) {
    return 1;
  }

  const leftIndex = STUDIO_CORE_NAV_GROUP_ORDER.indexOf(left as (typeof STUDIO_CORE_NAV_GROUP_ORDER)[number]);
  const rightIndex = STUDIO_CORE_NAV_GROUP_ORDER.indexOf(right as (typeof STUDIO_CORE_NAV_GROUP_ORDER)[number]);

  if (leftIndex !== -1 || rightIndex !== -1) {
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }
  }

  return left.localeCompare(right);
}

function buildNavItemFromBinding(
  binding: PlatformRouteBinding,
  absolutePath: string,
): AdminShellNavItem | null {
  if (!binding.nav?.label) {
    return null;
  }

  return {
    icon: binding.nav.icon,
    pageKey: binding.pageKey,
    label: binding.nav.label,
    description: binding.nav.description,
    path: absolutePath,
    iconColor: binding.nav.color,
    minViewport: binding.nav.minViewport,
    isCore: !binding.ownerPackageId,
    isPlugin: Boolean(binding.ownerPackageId),
  };
}

function applyRegistrySeparators(
  items: AdminShellNavItem[],
  bindings: PlatformRouteBinding[],
  mountPathPrefix: string,
): AdminShellNavItem[] {
  const result: AdminShellNavItem[] = [];

  for (const item of items) {
    const binding = bindings.find(
      (candidate) => candidate.nav?.label === item.label
        && bindingAbsolutePath(mountPathPrefix, candidate) === item.path,
    );

    if (binding?.nav?.separatorBefore && result.length > 0 && result[result.length - 1]?.type !== 'separator') {
      result.push(createAdminNavSeparatorItem());
    }

    result.push(item);
  }

  return result;
}

function buildRegistryNavGroups(input: BuildAdminShellNavInput): AdminShellNavGroup[] {
  const bindings = getBindingsForMount(input.config, input.mountId).filter((binding) => binding.nav);
  const groupedItems = new Map<string | null, AdminShellNavItem[]>();

  for (const binding of bindings) {
    const absolutePath = bindingAbsolutePath(input.mountPathPrefix, binding);
    if (!canAccessRouteBinding(binding, input.currentUser)) {
      continue;
    }

    const navItem = buildNavItemFromBinding(binding, absolutePath);
    if (!navItem) {
      continue;
    }

    const groupKey = binding.nav?.group ?? null;
    const existing = groupedItems.get(groupKey) ?? [];
    existing.push(navItem);
    groupedItems.set(groupKey, existing);
  }

  const sortedGroupKeys = [...groupedItems.keys()].sort(compareGroups);

  return sortedGroupKeys
    .map((heading) => {
      const items = [...(groupedItems.get(heading) ?? [])].sort((left, right) => {
        const leftBinding = bindings.find(
          (binding) => binding.nav?.label === left.label
            && bindingAbsolutePath(input.mountPathPrefix, binding) === left.path,
        );
        const rightBinding = bindings.find(
          (binding) => binding.nav?.label === right.label
            && bindingAbsolutePath(input.mountPathPrefix, binding) === right.path,
        );
        const leftOrder = leftBinding?.nav?.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = rightBinding?.nav?.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return (left.label ?? '').localeCompare(right.label ?? '');
      });

      return {
        heading,
        icon: resolveNavGroupIcon({ heading, items }),
        items: applyRegistrySeparators(items, bindings, input.mountPathPrefix),
      };
    })
    .filter((group) => group.items.some((item) => item.type !== 'separator' && Boolean(item.path)));
}

function bindingsMatchingManifestItem(
  bindings: PlatformRouteBinding[],
  item: NavigationManifestItem,
): PlatformRouteBinding[] {
  const matches: PlatformRouteBinding[] = [];

  for (const binding of bindings) {
    if (item.pageKey && binding.pageKey === item.pageKey) {
      matches.push(binding);
      continue;
    }

    if (item.routePattern !== undefined && binding.routePattern === item.routePattern) {
      matches.push(binding);
    }
  }

  return matches;
}

/** When multiple bindings share a pageKey, pick the one scoped to the active portal (e.g. hawiety/base-info vs base-info). */
export function pickBindingForPortal(
  candidates: PlatformRouteBinding[],
  portalSegment: string,
): PlatformRouteBinding | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const portal = portalSegment.trim() || STUDIO_PORTAL_SEGMENT;

  if (portal !== STUDIO_PORTAL_SEGMENT) {
    const scoped = candidates.find((binding) =>
      normalizeRoutePatternForNavPath(binding.routePattern).startsWith(`${portal}/`));
    return scoped ?? candidates[0];
  }

  const studioStyle = candidates.find((binding) => {
    const normalized = normalizeRoutePatternForNavPath(binding.routePattern);
    if (!normalized.includes('/')) {
      return true;
    }

    const firstSegment = normalized.split('/')[0];
    return firstSegment === STUDIO_PORTAL_SEGMENT;
  });

  return studioStyle ?? candidates[0];
}

function bindingForManifestItem(
  bindings: PlatformRouteBinding[],
  item: NavigationManifestItem,
  portalSegment?: string,
): PlatformRouteBinding | undefined {
  const portal = portalSegment?.trim() || STUDIO_PORTAL_SEGMENT;

  if (item.pageKey) {
    const byPageKey = bindingsMatchingManifestItem(bindings, item).filter(
      (binding) => binding.pageKey === item.pageKey,
    );
    const picked = pickBindingForPortal(byPageKey, portal);
    if (picked) {
      return picked;
    }
  }

  if (item.routePattern !== undefined) {
    const byRoutePattern = bindings.filter((binding) => binding.routePattern === item.routePattern);
    const picked = pickBindingForPortal(byRoutePattern, portal);
    if (picked) {
      return picked;
    }
  }

  return undefined;
}

function isCultureExperienceMount(input: BuildAdminShellNavInput): boolean {
  const mount = getMountById(input.config, input.mountId);
  return Boolean(
    mount?.enabled
    && mount.designerRoutePropagation === 'auto'
    && input.mountId !== STUDIO_MOUNT_ID,
  );
}

function routePatternsMatchForNav(
  bindingPattern: string,
  manifestPattern: string,
  portalSegment?: string,
): boolean {
  const normalizedBinding = normalizeRoutePatternForNavPath(bindingPattern);
  const normalizedManifest = normalizeRoutePatternForNavPath(manifestPattern);
  if (normalizedBinding === normalizedManifest) {
    return true;
  }

  const portal = portalSegment?.trim();
  if (portal && portal !== STUDIO_PORTAL_SEGMENT) {
    if (normalizedBinding === `${portal}/${normalizedManifest}`) {
      return true;
    }
  }

  return normalizedBinding === normalizeRoutePatternForNavPath(toPortalRoutePattern(manifestPattern));
}

function bindingMatchesManifestItem(
  binding: PlatformRouteBinding,
  item: NavigationManifestItem,
  portalSegment?: string,
): boolean {
  const manifestPageKey = item.pageKey?.trim();
  if (manifestPageKey && binding.pageKey !== manifestPageKey) {
    return false;
  }

  const manifestRoutePattern = item.routePattern?.trim();
  if (manifestRoutePattern && !routePatternsMatchForNav(binding.routePattern, manifestRoutePattern, portalSegment)) {
    return false;
  }

  return true;
}

function bindingNavPathMatchesActivePortal(
  binding: PlatformRouteBinding,
  portalSegment: string,
): boolean {
  const portal = portalSegment.trim() || STUDIO_PORTAL_SEGMENT;
  const normalizedBinding = normalizeRoutePatternForNavPath(binding.routePattern);

  if (portal !== STUDIO_PORTAL_SEGMENT) {
    return normalizedBinding.startsWith(`${portal}/`);
  }

  if (!normalizedBinding.includes('/')) {
    return true;
  }

  const firstSegment = normalizedBinding.split('/')[0];
  return firstSegment === STUDIO_PORTAL_SEGMENT;
}

function buildManifestNavAbsolutePath(
  input: BuildAdminShellNavInput,
  pattern: string,
): string {
  if (isCultureExperienceMount(input)) {
    return buildNavigationItemAbsolutePath({
      cultureId: input.currentCultureId?.trim() || 'us',
      portalSegment: input.currentPortalSegment?.trim() || STUDIO_PORTAL_SEGMENT,
      routePattern: pattern,
    });
  }

  return buildMountAbsolutePath(
    input.mountPathPrefix,
    withNavLandingPath(normalizeRoutePatternForNavPath(pattern)),
  );
}

function canAccessManifestItem(
  item: NavigationManifestItem,
  binding: PlatformRouteBinding | undefined,
  currentUser: AuthUserLike,
): boolean {
  if (item.auth) {
    return canAccessRouteBinding({ ...binding, auth: item.auth } as PlatformRouteBinding, currentUser);
  }

  if (binding) {
    return canAccessRouteBinding(binding, currentUser);
  }

  return true;
}

function resolveManifestItemAbsolutePath(
  input: BuildAdminShellNavInput,
  item: NavigationManifestItem,
  binding: PlatformRouteBinding | undefined,
): string | undefined {
  const routePattern = item.routePattern ?? binding?.routePattern;
  if (routePattern === undefined && !binding) {
    return undefined;
  }

  const pattern = routePattern ?? binding!.routePattern;
  const hasTargetOverride = Boolean(item.cultureId?.trim() || item.portalSegment?.trim());

  if (!hasTargetOverride) {
    const portal = input.currentPortalSegment?.trim() || STUDIO_PORTAL_SEGMENT;
    if (
      binding
      && bindingMatchesManifestItem(binding, item, portal)
      && bindingNavPathMatchesActivePortal(binding, portal)
    ) {
      if (isCultureExperienceMount(input)) {
        return buildManifestNavAbsolutePath(input, binding.routePattern);
      }

      return bindingAbsolutePath(input.mountPathPrefix, binding);
    }

    return buildManifestNavAbsolutePath(input, pattern);
  }

  const cultureId = item.cultureId?.trim()
    || input.currentCultureId?.trim()
    || 'us';
  const portalSegment = item.portalSegment?.trim()
    || input.currentPortalSegment?.trim()
    || STUDIO_PORTAL_SEGMENT;

  return buildNavigationItemAbsolutePath({
    cultureId,
    portalSegment,
    routePattern: pattern,
  });
}

function buildNavItemFromManifestItem(
  input: BuildAdminShellNavInput,
  item: NavigationManifestItem,
  bindings: PlatformRouteBinding[],
  currentUser: AuthUserLike,
): AdminShellNavItem | null {
  if (item.type === 'separator') {
    return createAdminNavSeparatorItem(item.separatorOptions);
  }

  const binding = bindingForManifestItem(bindings, item, input.currentPortalSegment);
  if (!canAccessManifestItem(item, binding, currentUser)) {
    return null;
  }

  if (!binding?.nav?.label && !item.label) {
    return null;
  }

  const absolutePath = resolveManifestItemAbsolutePath(input, item, binding);

  if (!absolutePath && !item.label) {
    return null;
  }

  return {
    icon: item.icon ?? binding?.nav?.icon,
    pageKey: item.pageKey ?? binding?.pageKey,
    label: item.label ?? binding?.nav?.label,
    collapsedLabel: item.collapsedLabel,
    description: item.description ?? binding?.nav?.description,
    path: absolutePath,
    labelColor: item.labelColor,
    iconColor: item.iconColor ?? binding?.nav?.color,
    minViewport: binding?.nav?.minViewport,
    isCore: binding ? !binding.ownerPackageId : true,
    isPlugin: Boolean(binding?.ownerPackageId),
    ...(item.region && item.region !== 'side' ? { region: item.region } : {}),
    children: item.children
      ?.map((child) => buildNavItemFromManifestItem(input, child, bindings, currentUser))
      .filter((child): child is AdminShellNavItem => child != null),
  };
}

function applyManifestSeparators(
  items: AdminShellNavItem[],
  manifestItems: NavigationManifestItem[],
  bindings: PlatformRouteBinding[],
  portalSegment?: string,
): AdminShellNavItem[] {
  const result: AdminShellNavItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const manifestItem = manifestItems[index];
    const binding = manifestItem?.pageKey
      ? bindingForManifestItem(bindings, manifestItem, portalSegment)
      : undefined;
    const separatorBefore = manifestItem?.separatorBefore || binding?.nav?.separatorBefore;

    if (separatorBefore && result.length > 0 && result[result.length - 1]?.type !== 'separator') {
      result.push(createAdminNavSeparatorItem(manifestItem?.separatorOptions));
    }

    result.push(item);
  }

  return result;
}

function buildManifestNavGroups(input: BuildAdminShellNavInput, manifest: NavigationManifest): AdminShellNavGroup[] {
  const bindings = getBindingsForMount(input.config, input.mountId);

  const orderedGroups = [...manifest.groups].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return (left.heading ?? '').localeCompare(right.heading ?? '');
  });

  return orderedGroups
    .map((group) => {
      const sortedItems = [...group.items].sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return (left.label ?? '').localeCompare(right.label ?? '');
      });

      const resolvedItems = sortedItems
        .map((item) => buildNavItemFromManifestItem(input, item, bindings, input.currentUser))
        .filter((item): item is AdminShellNavItem => item != null);

      return {
        heading: group.heading ?? null,
        icon: group.icon ?? resolveNavGroupIcon({ heading: group.heading ?? null, items: resolvedItems }),
        collapsedLabel: group.collapsedLabel,
        items: applyManifestSeparators(
          resolvedItems,
          sortedItems,
          bindings,
          input.currentPortalSegment,
        ),
      };
    })
    .filter((group) => group.items.some((item) => item.type !== 'separator' && Boolean(item.path)));
}

export function resolveNavigationManifestForShell(input: {
  config: PlatformRuntimeConfig;
  mountId: string;
  navigationRef?: string | null;
}): NavigationManifest | null {
  const navigationRef = input.navigationRef?.trim();
  if (!navigationRef) {
    return null;
  }

  const stored = getNavigationManifestById(input.config.navigations, navigationRef);
  if (stored) {
    return stored;
  }

  return buildNavigationManifestFromBindings({
    bindings: getBindingsForMount(input.config, input.mountId),
    id: navigationRef,
  });
}

export function buildAdminShellNav(input: BuildAdminShellNavInput): AdminShellNavGroup[] {
  const manifest = input.manifest
    ?? resolveNavigationManifestForShell({
      config: input.config,
      mountId: input.mountId,
      navigationRef: input.navigationRef,
    });

  if (manifest) {
    return buildManifestNavGroups(input, manifest);
  }

  return buildRegistryNavGroups(input);
}

function flattenNavItems(items: AdminShellNavItem[]): AdminShellNavItem[] {
  const flattened: AdminShellNavItem[] = [];
  for (const item of items) {
    flattened.push(item);
    if (item.children?.length) {
      flattened.push(...flattenNavItems(item.children));
    }
  }
  return flattened;
}

export function flattenAdminShellNavItems(groups: AdminShellNavGroup[]): AdminShellNavItem[] {
  return groups.flatMap((group) => flattenNavItems(group.items));
}

function findMatchingNavItems(groups: AdminShellNavGroup[], pathname: string): AdminShellNavItem[] {
  return flattenAdminShellNavItems(groups).filter(
    (item) => item.type !== 'separator' && item.path && (
      pathnameMatchesBindingNavPath(pathname, item.path)
      || (item.pageKey === 'workflows' && pathnameMatchesWorkflowDesignerNavPath(pathname, item.path))
    ),
  );
}

function findBestMatchingNavItem(groups: AdminShellNavGroup[], pathname: string): AdminShellNavItem | undefined {
  const matches = findMatchingNavItems(groups, pathname);
  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort((left, right) => (right.path?.length ?? 0) - (left.path?.length ?? 0))[0];
}

export function isAdminShellNavItemActive(
  groups: AdminShellNavGroup[],
  item: AdminShellNavItem,
  pathname: string,
): boolean {
  if (item.type === 'separator' || !item.path) {
    return false;
  }

  const bestMatch = findBestMatchingNavItem(groups, pathname);
  return bestMatch?.path === item.path;
}

export function findAdminShellNavItemByPath(
  groups: AdminShellNavGroup[],
  pathname: string,
): AdminShellNavItem | undefined {
  return findBestMatchingNavItem(groups, pathname);
}

export type AdminShellBreadcrumbSegment = {
  label: string;
  icon?: string;
  path?: string;
};

function findNavItemTrailInItems(
  items: AdminShellNavItem[],
  targetPath: string,
  ancestors: AdminShellBreadcrumbSegment[],
): AdminShellBreadcrumbSegment[] | null {
  for (const item of items) {
    if (item.type === 'separator' || !item.path) {
      continue;
    }

    const segment: AdminShellBreadcrumbSegment = {
      label: item.label?.trim() || item.pageKey || 'Page',
      icon: item.icon,
      path: item.path,
    };

    if (item.path === targetPath) {
      return [...ancestors, segment];
    }

    if (item.children && item.children.length > 0) {
      const childTrail = findNavItemTrailInItems(
        item.children,
        targetPath,
        [...ancestors, segment],
      );
      if (childTrail) {
        return childTrail;
      }
    }
  }

  return null;
}

export type AdminShellNavItemContext = {
  item: AdminShellNavItem;
  groupHeading: string | null;
};

function groupContainsNavItem(items: AdminShellNavItem[], target: AdminShellNavItem): boolean {
  for (const item of items) {
    if (item.type === 'separator') {
      continue;
    }

    if (item.path && item.path === target.path) {
      return true;
    }

    if (item.children?.length && groupContainsNavItem(item.children, target)) {
      return true;
    }
  }

  return false;
}

function findGroupHeadingForNavItem(
  groups: AdminShellNavGroup[],
  target: AdminShellNavItem,
): string | null {
  for (const group of groups) {
    if (groupContainsNavItem(group.items, target)) {
      return group.heading;
    }
  }

  return null;
}

/** CD-E06 — breadcrumb ancestry from the resolved admin shell nav tree. */
export function findAdminShellNavBreadcrumbTrail(
  groups: AdminShellNavGroup[],
  pathname: string,
): AdminShellBreadcrumbSegment[] {
  const bestMatch = findBestMatchingNavItem(groups, pathname);
  if (!bestMatch?.path) {
    return [];
  }

  for (const group of groups) {
    const itemTrail = findNavItemTrailInItems(group.items, bestMatch.path, []);
    if (!itemTrail) {
      continue;
    }

    const trail: AdminShellBreadcrumbSegment[] = [];
    if (group.heading?.trim()) {
      trail.push({ label: formatNavGroupHeadingForShell(group.heading.trim()) });
    }
    trail.push(...itemTrail);
    return trail;
  }

  return bestMatch.label
    ? [{ label: bestMatch.label, icon: bestMatch.icon, path: bestMatch.path }]
    : [];
}

export function findAdminShellNavItemContextByPath(
  groups: AdminShellNavGroup[],
  pathname: string,
): AdminShellNavItemContext | undefined {
  const item = findBestMatchingNavItem(groups, pathname);
  if (!item) {
    return undefined;
  }

  const rawGroupHeading = findGroupHeadingForNavItem(groups, item);

  return {
    item,
    groupHeading: rawGroupHeading ? formatNavGroupHeadingForShell(rawGroupHeading) : null,
  };
}

export function formatAdminShellHeaderTitle(
  pageLabel: string | undefined,
  groupHeading: string | null | undefined,
  fallbackLabel: string,
): string {
  const label = pageLabel || fallbackLabel;
  return groupHeading ? `${groupHeading} / ${label}` : label;
}

export type AdminShellHeaderContext = {
  item: AdminShellNavItem;
  groupHeading: string | null;
  breadcrumbTrail: AdminShellBreadcrumbSegment[];
};

/** Manifest nav leaf under a `/*` route binding (e.g. `hwy-geo-responsibility-candidate-interview`). */
function isNavLeafPageKeyForSplatBinding(
  bindingPageKey: string | undefined,
  navPageKey: string | undefined,
): boolean {
  if (!bindingPageKey?.trim() || !navPageKey?.trim() || navPageKey === bindingPageKey) {
    return false;
  }
  return navPageKey.startsWith(`${bindingPageKey}-`);
}

function translateNavPageLabel(
  pageKey: string,
  fallback: string,
  t?: (key: string) => string,
): string {
  if (!t) {
    return fallback;
  }

  const labelKey = navLabelKey(pageKey);
  const translated = t(labelKey);
  return translated !== labelKey ? translated : fallback;
}

function translateNavGroupHeading(
  groupHeading: string,
  t?: (key: string) => string,
): string {
  if (!t) {
    return groupHeading;
  }

  const groupKey = navGroupKey(groupHeading);
  const translated = t(groupKey);
  return translated !== groupKey ? translated : groupHeading;
}

function formatNavGroupHeadingForShell(
  groupHeading: string,
  t?: (key: string) => string,
): string {
  const displayLabel = resolveNavGroupDisplayLabel(groupHeading);
  if (displayLabel !== groupHeading) {
    return displayLabel;
  }

  return translateNavGroupHeading(groupHeading, t);
}

/** Resolve shell header title from route binding, then manifest nav, then fallback. */
export function resolveAdminShellHeaderContext(input: {
  groups: AdminShellNavGroup[];
  pathname: string;
  config?: PlatformRuntimeConfig;
  mountId?: string;
  t?: (key: string) => string;
  fallbackLabel?: string;
  fallbackDescription?: string;
}): AdminShellHeaderContext {
  const navContext = findAdminShellNavItemContextByPath(input.groups, input.pathname);
  const bindingContext = resolveAdminShellHeaderContextFromBinding(input);

  if (bindingContext) {
    const navLeafUnderSplatBinding = isNavLeafPageKeyForSplatBinding(
      bindingContext.item.pageKey,
      navContext?.item.pageKey,
    );
    if (navLeafUnderSplatBinding && navContext) {
      const leafPageKey = navContext.item.pageKey!;
      const leafLabel = translateNavPageLabel(
        leafPageKey,
        navContext.item.label,
        input.t,
      );
      const groupHeading = navContext.groupHeading ?? bindingContext.groupHeading ?? null;
      const item: AdminShellNavItem = {
        ...bindingContext.item,
        pageKey: leafPageKey,
        label: leafLabel,
        description: navContext.item.description ?? bindingContext.item.description,
        icon: navContext.item.icon ?? bindingContext.item.icon,
        iconColor: navContext.item.iconColor ?? bindingContext.item.iconColor,
      };
      const breadcrumbTrail: AdminShellBreadcrumbSegment[] = [];
      if (groupHeading) {
        breadcrumbTrail.push({ label: groupHeading });
      }
      breadcrumbTrail.push({ label: item.label, icon: item.icon, path: item.path });
      return { item, groupHeading, breadcrumbTrail };
    }

    // Edit/splat bindings often have `nav: null` (or a stripped list nav missing `group`).
    // Keep binding label/path, but fill group/icon from sibling nav binding or manifest nav
    // so the shell stays `{nav group} / {list label}` per deep-linking.md.
    if (bindingContext.groupHeading) {
      const navMetaMatchesPage = Boolean(
        navContext?.item.pageKey
        && navContext.item.pageKey === bindingContext.item.pageKey,
      );
      if (navMetaMatchesPage && navContext) {
        return {
          item: {
            ...bindingContext.item,
            label: navContext.item.label ?? bindingContext.item.label,
            description: navContext.item.description ?? bindingContext.item.description,
            icon: navContext.item.icon ?? bindingContext.item.icon,
            iconColor: navContext.item.iconColor ?? bindingContext.item.iconColor,
          },
          groupHeading: navContext.groupHeading ?? bindingContext.groupHeading,
          breadcrumbTrail: bindingContext.breadcrumbTrail,
        };
      }

      return bindingContext;
    }

    const siblingNav = resolveSiblingBindingNavMeta(input, bindingContext.item.pageKey);
    const pageKey = bindingContext.item.pageKey;
    const navMetaMatchesPage = Boolean(
      pageKey
      && navContext?.item.pageKey === pageKey,
    );
    const groupHeading = siblingNav?.groupHeading
      ?? navContext?.groupHeading
      ?? null;
    const shouldReplaceFallbackLabel = Boolean(
      pageKey
      && bindingContext.item.label === pageKey,
    );
    const label = shouldReplaceFallbackLabel
      ? translateNavPageLabel(
        pageKey,
        siblingNav?.label?.trim()
          || (navMetaMatchesPage ? navContext?.item.label?.trim() : undefined)
          || bindingContext.item.label,
        input.t,
      )
      : bindingContext.item.label;
    const item: AdminShellNavItem = {
      ...bindingContext.item,
      label,
      description: bindingContext.item.description
        ?? siblingNav?.description
        ?? (navMetaMatchesPage ? navContext?.item.description : undefined),
      icon: bindingContext.item.icon
        ?? siblingNav?.icon
        ?? (navMetaMatchesPage ? navContext?.item.icon : undefined),
      iconColor: bindingContext.item.iconColor
        ?? siblingNav?.iconColor
        ?? (navMetaMatchesPage ? navContext?.item.iconColor : undefined),
    };

    const breadcrumbTrail: AdminShellBreadcrumbSegment[] = [];
    if (groupHeading) {
      breadcrumbTrail.push({ label: groupHeading });
    }
    breadcrumbTrail.push({ label: item.label, icon: item.icon, path: item.path });

    return { item, groupHeading, breadcrumbTrail };
  }

  if (navContext) {
    return {
      ...navContext,
      breadcrumbTrail: findAdminShellNavBreadcrumbTrail(input.groups, input.pathname),
    };
  }

  const fallbackLabel = input.fallbackLabel ?? 'Portal Dashboard';
  return {
    item: {
      label: fallbackLabel,
      description: input.fallbackDescription,
      icon: 'Home',
      path: input.pathname,
    },
    groupHeading: null,
    breadcrumbTrail: [],
  };
}

type SiblingBindingNavMeta = {
  groupHeading: string | null;
  label?: string;
  icon?: string;
  iconColor?: string;
  description?: string;
};

function resolveSiblingBindingNavMeta(
  input: {
    config?: PlatformRuntimeConfig;
    mountId?: string;
    pathname?: string;
    t?: (key: string) => string;
  },
  pageKey: string | undefined,
): SiblingBindingNavMeta | null {
  if (!input.config || !input.mountId || !pageKey) {
    return null;
  }

  const siblings = getBindingsForMount(input.config, input.mountId).filter(
    (candidate) => candidate.pageKey === pageKey && Boolean(candidate.nav?.group?.trim()),
  );
  if (siblings.length === 0) {
    return null;
  }

  const portalSegment = input.pathname
    ? resolvePortalFromPathname(input.pathname, input.config).portalSegment
    : STUDIO_PORTAL_SEGMENT;
  const portalScoped = pickBindingForPortal(siblings, portalSegment);
  const orderedCandidates = portalScoped
    ? [portalScoped, ...siblings.filter((candidate) => candidate !== portalScoped)]
    : siblings;

  const preferred = orderedCandidates.find((candidate) => {
    const pattern = candidate.routePattern.trim();
    return pattern.length > 0
      && !pattern.includes('*')
      && !pattern.includes(`/${NESTED_EDITOR_EDIT_SEGMENT}`);
  }) ?? portalScoped ?? siblings[0];

  const nav = preferred?.nav;
  if (!nav?.group?.trim()) {
    return null;
  }

  return {
    groupHeading: formatNavGroupHeadingForShell(nav.group.trim(), input.t),
    label: nav.label,
    icon: nav.icon,
    iconColor: nav.color,
    description: nav.description,
  };
}

function resolveAdminShellHeaderContextFromBinding(
  input: {
    pathname: string;
    config?: PlatformRuntimeConfig;
    mountId?: string;
    t?: (key: string) => string;
    fallbackDescription?: string;
  },
): AdminShellHeaderContext | null {
  if (!input.config || !input.mountId) {
    return null;
  }

  const portal = resolvePortalFromPathname(input.pathname, input.config);
  const binding = resolveRouteBindingForPortalRemainder(
    input.config,
    input.mountId,
    portal.pageRemainderPath,
    portal.portalSegment,
  );
  if (!binding) {
    return null;
  }

  const pageModule = getPageModuleByKey(input.config, binding.pageKey);
  const pageKey = binding.pageKey;
  const rawLabel = pageModule?.title ?? binding.nav?.label ?? pageKey;
  const label = translateNavPageLabel(pageKey, rawLabel, input.t);

  let description = binding.nav?.description ?? input.fallbackDescription;
  if (pageKey && input.t) {
    const descriptionKey = navDescriptionKey(pageKey);
    const translatedDescription = input.t(descriptionKey);
    if (translatedDescription !== descriptionKey) {
      description = translatedDescription;
    }
  }

  const rawGroup = binding.nav?.group?.trim() ?? null;
  const groupHeading = rawGroup ? formatNavGroupHeadingForShell(rawGroup, input.t) : null;

  const item: AdminShellNavItem = {
    pageKey,
    label,
    description,
    icon: binding.nav?.icon
      ?? (pageKey === 'my-feedback' ? 'MessageSquare' : pageKey === 'feedback-inbox' ? 'MessagesSquare' : undefined),
    iconColor: binding.nav?.color,
    path: input.pathname,
  };

  const breadcrumbTrail: AdminShellBreadcrumbSegment[] = [];
  if (groupHeading) {
    breadcrumbTrail.push({ label: groupHeading });
  }
  breadcrumbTrail.push({ label, icon: item.icon, path: input.pathname });

  return { item, groupHeading, breadcrumbTrail };
}
