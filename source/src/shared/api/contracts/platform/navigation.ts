import type { PlatformRouteBinding, PlatformRouteBindingAuth, PlatformRouteBindingNav } from './types';
import { LATIN_SLUG_RE, validateLatinSlug } from '../../../lib/latinSlug';

/** Shipped navigation manifests — not deletable via operator UI. */
export const BUILT_IN_NAVIGATION_IDS = ['studio'] as const;

export type BuiltInNavigationId = (typeof BUILT_IN_NAVIGATION_IDS)[number];

export function isBuiltInNavigationId(id: string): boolean {
  return (BUILT_IN_NAVIGATION_IDS as readonly string[]).includes(id.trim());
}

/** Where a navigation item appears in the live Studio/App shell. Omitted = `side`. */
export const NAVIGATION_ITEM_REGIONS = ['side', 'sidebar-footer', 'header'] as const;

export type NavigationItemRegion = (typeof NAVIGATION_ITEM_REGIONS)[number];

const NAVIGATION_ITEM_REGION_SET = new Set<string>(NAVIGATION_ITEM_REGIONS);

export function isNavigationItemRegion(value: string): value is NavigationItemRegion {
  return NAVIGATION_ITEM_REGION_SET.has(value);
}

export type NavigationManifestItem = {
  type?: 'separator';
  /** Empty / omitted — follow the active URL culture at runtime. */
  cultureId?: string | null;
  /** Empty / omitted — follow the active portal at runtime. */
  portalSegment?: string | null;
  /**
   * Shell chrome location. Omitted / `side` = main sidebar tree.
   * `sidebar-footer` = icon row at the bottom of the sidebar.
   * `header` = icon buttons in the header utilities cluster (left of the profile).
   */
  region?: NavigationItemRegion;
  pageKey?: string;
  routePattern?: string;
  label?: string;
  /** Shown under the icon when the sidebar is collapsed; empty uses the last 6 graphemes of `label`. */
  collapsedLabel?: string;
  icon?: string;
  description?: string;
  labelColor?: string;
  iconColor?: string;
  order?: number;
  separatorBefore?: boolean;
  /** Optional styling for the rule inserted before this item when `separatorBefore` is true. */
  separatorOptions?: {
    thicknessPx?: number;
    edgeStyle?: 'inset' | 'outset';
    inset?: boolean;
    color?: string;
  };
  auth?: PlatformRouteBindingAuth | null;
  children?: NavigationManifestItem[];
};

export type NavigationManifestGroup = {
  heading?: string | null;
  icon?: string;
  /** Shown under the group icon when the sidebar is collapsed; empty uses the last 6 graphemes of the heading. */
  collapsedLabel?: string;
  order?: number;
  items: NavigationManifestItem[];
};

export type NavigationManifest = {
  id: string;
  version?: string;
  /** Owner portal segment — navigations belong to a portal. */
  portalSegment?: string;
  groups: NavigationManifestGroup[];
};

/** Shipped Studio sidebar group order. Package groups sort after these by `order`. */
export const STUDIO_CORE_NAV_GROUP_ORDER = ['Development', 'Extensions', 'Records', 'Remote Hubs'] as const;

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

function manifestItemFromBinding(binding: PlatformRouteBinding): NavigationManifestItem | null {
  if (!binding.nav?.label) {
    return null;
  }

  return {
    pageKey: binding.pageKey,
    routePattern: binding.routePattern,
    label: binding.nav.label,
    icon: binding.nav.icon,
    description: binding.nav.description,
    iconColor: binding.nav.color,
    order: binding.nav.order,
    separatorBefore: binding.nav.separatorBefore,
    auth: binding.auth ?? null,
  };
}

export function buildNavigationManifestFromBindings(input: {
  bindings: PlatformRouteBinding[];
  id: string;
}): NavigationManifest {
  const bindings = input.bindings.filter((binding) => binding.nav);
  const groupedItems = new Map<string | null, NavigationManifestItem[]>();

  for (const binding of bindings) {
    const item = manifestItemFromBinding(binding);
    if (!item) {
      continue;
    }

    const groupKey = binding.nav?.group ?? null;
    const existing = groupedItems.get(groupKey) ?? [];
    existing.push(item);
    groupedItems.set(groupKey, existing);
  }

  const sortedGroupKeys = [...groupedItems.keys()].sort(compareGroups);

  return {
    id: input.id,
    version: '1',
    groups: sortedGroupKeys.map((heading, index) => {
      const items = [...(groupedItems.get(heading) ?? [])].sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return (left.label ?? '').localeCompare(right.label ?? '');
      });

      return {
        heading,
        order: index,
        items,
      };
    }),
  };
}

export function getNavigationManifestById(
  navigations: NavigationManifest[],
  navigationId: string,
): NavigationManifest | undefined {
  const normalized = navigationId.trim();
  if (!normalized) {
    return undefined;
  }

  return navigations.find((manifest) => manifest.id === normalized);
}

export type NavigationManifestSummary = NavigationManifest & {
  builtIn: boolean;
  groupCount: number;
  itemCount: number;
};

/** Navigation manifest ids owned by a portal (primary ref + portalSegment matches). */
export function collectPortalNavigationIds(
  portalSegment: string,
  navigationRef: string,
  navigations: NavigationManifest[],
): string[] {
  const segment = portalSegment.trim();
  const primaryRef = navigationRef.trim() || segment;
  const ids = new Set<string>();

  if (primaryRef) {
    ids.add(primaryRef);
  }

  for (const manifest of navigations) {
    const owner = manifest.portalSegment?.trim();
    if (owner === segment || (!owner && manifest.id === primaryRef)) {
      ids.add(manifest.id);
    }
  }

  return [...ids].sort((left, right) => left.localeCompare(right));
}

export function navigationBelongsToPortal(
  manifest: Pick<NavigationManifest, 'id' | 'portalSegment'>,
  portalSegment: string,
  navigationRef?: string | null,
): boolean {
  const segment = portalSegment.trim();
  const owner = manifest.portalSegment?.trim();
  if (owner) {
    return owner === segment;
  }

  const primaryRef = navigationRef?.trim() || segment;
  return manifest.id === primaryRef;
}

export function countNavigationManifestItems(manifest: NavigationManifest): number {
  let count = 0;

  const walk = (items: NavigationManifestItem[]) => {
    for (const item of items) {
      if (item.type !== 'separator') {
        count += 1;
      }
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };

  for (const group of manifest.groups) {
    walk(group.items);
  }

  return count;
}

export function toNavigationManifestSummary(manifest: NavigationManifest): NavigationManifestSummary {
  return {
    ...manifest,
    builtIn: isBuiltInNavigationId(manifest.id),
    groupCount: manifest.groups.length,
    itemCount: countNavigationManifestItems(manifest),
  };
}

export function compareNavigationManifestSummaries(
  left: Pick<NavigationManifestSummary, 'builtIn' | 'id'>,
  right: Pick<NavigationManifestSummary, 'builtIn' | 'id'>,
): number {
  if (left.builtIn !== right.builtIn) {
    return left.builtIn ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

/** Composite client-grid sort key: built-in manifests first, then id ascending. */
export function navigationManifestIdSortKey(
  row: Pick<NavigationManifestSummary, 'builtIn' | 'id'>,
): string {
  return `${row.builtIn ? '0' : '1'}\u0000${row.id}`;
}

export type NavigationManifestValidationResult =
  | { valid: true; manifest: NavigationManifest }
  | { valid: false; errors: string[] };

function normalizeManifestItem(
  item: unknown,
  pathPrefix: string,
  errors: string[],
): NavigationManifestItem | null {
  if (!item || typeof item !== 'object') {
    errors.push(`${pathPrefix} must be an object.`);
    return null;
  }

  const record = item as Record<string, unknown>;
  if (record.type === 'separator') {
    return { type: 'separator' };
  }

  const children = Array.isArray(record.children)
    ? record.children
      .map((child, index) => normalizeManifestItem(child, `${pathPrefix}.children[${index}]`, errors))
      .filter((child): child is NavigationManifestItem => child != null)
    : undefined;

  const cultureId = record.cultureId === undefined
    ? undefined
    : record.cultureId === null
      ? null
      : typeof record.cultureId === 'string'
        ? record.cultureId.trim() || null
        : undefined;

  if (record.cultureId != null && cultureId === undefined && typeof record.cultureId !== 'string') {
    errors.push(`${pathPrefix}.cultureId must be a string or null.`);
  }

  const portalSegment = record.portalSegment === undefined
    ? undefined
    : record.portalSegment === null
      ? null
      : typeof record.portalSegment === 'string'
        ? record.portalSegment.trim() || null
        : undefined;

  if (record.portalSegment != null && portalSegment === undefined && typeof record.portalSegment !== 'string') {
    errors.push(`${pathPrefix}.portalSegment must be a string or null.`);
  }

  let region: NavigationItemRegion | undefined;
  if (record.region != null) {
    if (typeof record.region !== 'string' || !isNavigationItemRegion(record.region)) {
      errors.push(
        `${pathPrefix}.region must be one of: ${NAVIGATION_ITEM_REGIONS.join(', ')}.`,
      );
    } else {
      region = record.region;
    }
  }

  return {
    cultureId,
    portalSegment,
    region,
    pageKey: typeof record.pageKey === 'string' ? record.pageKey.trim() || undefined : undefined,
    routePattern: typeof record.routePattern === 'string' ? record.routePattern.trim() : undefined,
    label: typeof record.label === 'string' ? record.label.trim() || undefined : undefined,
    collapsedLabel: typeof record.collapsedLabel === 'string'
      ? record.collapsedLabel.trim() || undefined
      : undefined,
    icon: typeof record.icon === 'string' ? record.icon.trim() || undefined : undefined,
    description: typeof record.description === 'string' ? record.description.trim() || undefined : undefined,
    labelColor: typeof record.labelColor === 'string' ? record.labelColor.trim() || undefined : undefined,
    iconColor: typeof record.iconColor === 'string' ? record.iconColor.trim() || undefined : undefined,
    order: typeof record.order === 'number' ? record.order : undefined,
    separatorBefore: record.separatorBefore === true ? true : undefined,
    auth: record.auth === null || typeof record.auth === 'object'
      ? record.auth as NavigationManifestItem['auth']
      : undefined,
    children: children && children.length > 0 ? children : undefined,
  };
}

export function validateNavigationManifest(input: unknown): NavigationManifestValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Navigation manifest must be an object.'] };
  }

  const record = input as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const slugError = validateLatinSlug(id, { fieldLabel: 'Navigation id' });
  if (slugError) {
    errors.push(slugError);
  } else if (!LATIN_SLUG_RE.test(id)) {
    errors.push('Navigation id must use lowercase letters, numbers, dash, dot, and underscore only.');
  }

  if (record.renderer != null) {
    errors.push('renderer is no longer supported on navigation manifests. Place a platform navigation component in the shell layout instead.');
  }

  if (!Array.isArray(record.groups)) {
    errors.push('groups must be an array.');
    return { valid: false, errors };
  }

  const groups: NavigationManifestGroup[] = record.groups.map((group, groupIndex) => {
    const pathPrefix = `groups[${groupIndex}]`;
    if (!group || typeof group !== 'object') {
      errors.push(`${pathPrefix} must be an object.`);
      return { heading: null, items: [] };
    }

    const groupRecord = group as Record<string, unknown>;
    const heading = groupRecord.heading === null || groupRecord.heading === undefined
      ? null
      : typeof groupRecord.heading === 'string'
        ? groupRecord.heading.trim() || null
        : null;

    if (groupRecord.heading != null && heading === null && typeof groupRecord.heading !== 'string') {
      errors.push(`${pathPrefix}.heading must be a string or null.`);
    }

    const items = Array.isArray(groupRecord.items)
      ? groupRecord.items
        .map((item, itemIndex) => normalizeManifestItem(item, `${pathPrefix}.items[${itemIndex}]`, errors))
        .filter((item): item is NavigationManifestItem => item != null)
      : [];

    if (!Array.isArray(groupRecord.items)) {
      errors.push(`${pathPrefix}.items must be an array.`);
    }

    const icon = typeof groupRecord.icon === 'string' ? groupRecord.icon.trim() || undefined : undefined;
    if (groupRecord.icon != null && icon === undefined && typeof groupRecord.icon !== 'string') {
      errors.push(`${pathPrefix}.icon must be a string when provided.`);
    }

    const collapsedLabel = typeof groupRecord.collapsedLabel === 'string'
      ? groupRecord.collapsedLabel.trim() || undefined
      : undefined;
    if (
      groupRecord.collapsedLabel != null
      && collapsedLabel === undefined
      && typeof groupRecord.collapsedLabel !== 'string'
    ) {
      errors.push(`${pathPrefix}.collapsedLabel must be a string when provided.`);
    }

    return {
      heading,
      icon,
      collapsedLabel,
      order: typeof groupRecord.order === 'number' ? groupRecord.order : groupIndex,
      items,
    };
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const portalSegment = record.portalSegment === undefined
    ? undefined
    : typeof record.portalSegment === 'string'
      ? record.portalSegment.trim() || undefined
      : undefined;

  if (record.portalSegment != null && portalSegment === undefined && typeof record.portalSegment !== 'string') {
    errors.push('portalSegment must be a string when provided.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    manifest: {
      id,
      version: typeof record.version === 'string' ? record.version.trim() || '1' : '1',
      portalSegment,
      groups,
    },
  };
}

type NavigationItemOverride = Pick<NavigationManifestItem, 'cultureId' | 'portalSegment' | 'region'>;

function collectNavigationItemOverrides(
  items: NavigationManifestItem[],
  overrides: Map<string, NavigationItemOverride>,
): void {
  for (const item of items) {
    if (item.type === 'separator') {
      continue;
    }

    const pageKey = item.pageKey?.trim();
    if (
      pageKey
      && (item.cultureId != null || item.portalSegment != null || item.region != null)
    ) {
      overrides.set(pageKey, {
        cultureId: item.cultureId ?? null,
        portalSegment: item.portalSegment ?? null,
        region: item.region,
      });
    }

    if (item.children?.length) {
      collectNavigationItemOverrides(item.children, overrides);
    }
  }
}

function applyNavigationItemOverrides(
  item: NavigationManifestItem,
  overrides: Map<string, NavigationItemOverride>,
): NavigationManifestItem {
  if (item.type === 'separator') {
    return item;
  }

  const pageKey = item.pageKey?.trim();
  const override = pageKey ? overrides.get(pageKey) : undefined;
  const children = item.children?.map((child) => applyNavigationItemOverrides(child, overrides));

  return {
    ...item,
    cultureId: override?.cultureId ?? item.cultureId,
    portalSegment: override?.portalSegment ?? item.portalSegment,
    region: override?.region ?? item.region,
    children: children && children.length > 0 ? children : undefined,
  };
}

/** Preserve operator culture/portal/region overrides when navigation is regenerated from route bindings. */
export function mergeNavigationTargetOverrides(
  previous: NavigationManifest | null | undefined,
  next: NavigationManifest,
): NavigationManifest {
  if (!previous || previous.id !== next.id) {
    return next;
  }

  const overrides = new Map<string, NavigationItemOverride>();
  for (const group of previous.groups) {
    collectNavigationItemOverrides(group.items, overrides);
  }

  const withOverrides = overrides.size === 0
    ? next
    : {
      ...next,
      groups: next.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => applyNavigationItemOverrides(item, overrides)),
      })),
    };

  // Keep authored items/groups that Portals compile does not emit (a package-only
  // heading such as Remote Hubs, or a whole CMS group).
  const mergedGroups = withOverrides.groups.map((group) => {
    const heading = group.heading ?? null;
    const previousGroup = previous.groups.find((candidate) => (candidate.heading ?? null) === heading);
    if (!previousGroup) {
      return group;
    }

    const nextKeys = new Set(
      group.items
        .map((item) => item.pageKey?.trim())
        .filter((pageKey): pageKey is string => Boolean(pageKey)),
    );
    const leftovers = previousGroup.items.filter((item) => {
      const pageKey = item.pageKey?.trim();
      return Boolean(pageKey) && !nextKeys.has(pageKey);
    });
    if (leftovers.length === 0) {
      return group;
    }

    return { ...group, items: [...group.items, ...leftovers] };
  });

  const nextHeadings = new Set(mergedGroups.map((group) => group.heading ?? null));
  const preservedGroups = previous.groups.filter((group) => {
    const heading = group.heading ?? null;
    if (heading === null) {
      // Leading sidebar chrome (Home, Theme Designer, …) lives in an unheaded group.
      return !nextHeadings.has(null);
    }
    return !nextHeadings.has(heading);
  });
  if (preservedGroups.length === 0) {
    return { ...withOverrides, groups: mergedGroups };
  }

  return {
    ...withOverrides,
    groups: [...mergedGroups, ...preservedGroups].sort(
      (left, right) => (left.order ?? 999) - (right.order ?? 999),
    ),
  };
}
