/**
 * Lets a package install hook add a nav-sidebar group + items to an existing navigation
 * manifest (e.g. Studio's `workspace/platform-registry/navigation/studio.json`) — the generic
 * `ui_routes` capability creates routable pages but has no nav metadata field at all, and
 * `extensionUiRoutesRows()` (packageDeploymentToPlatformRows.ts) only ever synthesizes a
 * hardcoded "Plugins" group, which curated manifests like Studio's never even read (Studio's
 * nav is manifest-driven, not registry/binding-driven — see buildAdminShellNav.ts).
 *
 * Every add is tracked in a per-package sidecar file so uninstall can reverse exactly what this
 * package added, without touching anything a different owner (core or another package) put in
 * the same manifest.
 */
import fs from 'fs';
import path from 'path';
import { packageDirs, atomicWriteText } from '../../../core/packages/PackageFileStore';
import { readNavigationFile } from '../../../core/platform-registry/PlatformRegistryFileStore';
import type { PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import type { NavigationManifestItem } from '../../../shared/api/contracts/platform/navigation';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { readPackageZipTextEntry } from '../package/packageWorkspaceAssetInstall.service';
import { updateNavigationManifest } from '../platform/navigationManifest.service';
import { isPackageStudioSidebarRoute, packageStudioSidebarChrome, packageStudioSidebarLabel } from '../../../shared/lib/packageStudioSidebar';

export type PackageNavigationPatchItemInput = {
  pageKey: string;
  label: string;
  icon?: string;
  iconColor?: string;
  description?: string;
  routePattern?: string;
  order?: number;
  separatorBefore?: boolean;
  auth?: PlatformRouteBindingAuth | null;
};

export type PackageNavigationPatchInput = {
  navigationId: string;
  heading: string;
  headingIcon?: string;
  headingOrder?: number;
  items: PackageNavigationPatchItemInput[];
};

type NavigationPatchRecord = {
  schema: 'package-navigation-patch';
  schemaVersion: '1.0.0';
  packageId: string;
  navigationId: string;
  heading: string;
  groupCreatedByUs: boolean;
  itemPageKeys: string[];
  patchedAt: string;
};

function patchPath(packageId: string): string {
  return path.join(packageDirs.installed, `${packageId}.navigation-patch.json`);
}

function readPatchRecord(packageId: string): NavigationPatchRecord | null {
  const p = patchPath(packageId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as NavigationPatchRecord;
  } catch {
    return null;
  }
}

function writePatchRecord(record: NavigationPatchRecord): void {
  atomicWriteText(patchPath(record.packageId), `${JSON.stringify(record, null, 2)}\n`);
}

function deletePatchRecord(packageId: string): void {
  const p = patchPath(packageId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export type NavigationHeadingClaim = 'create' | 'ours' | 'adopt' | 'conflict';

export function resolveNavigationHeadingClaim(input: {
  groupExists: boolean;
  ourSidecarMatches: boolean;
  foreignSidecarMatches: boolean;
}): NavigationHeadingClaim {
  if (input.foreignSidecarMatches) return 'conflict';
  if (input.ourSidecarMatches) return 'ours';
  if (!input.groupExists) return 'create';
  return 'adopt';
}

function listInstalledNavigationPatches(): NavigationPatchRecord[] {
  const dir = packageDirs.installed;
  if (!fs.existsSync(dir)) return [];
  const records: NavigationPatchRecord[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.navigation-patch.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as NavigationPatchRecord;
      if (parsed?.schema === 'package-navigation-patch' && parsed.packageId && parsed.heading) {
        records.push(parsed);
      }
    } catch {
      // skip unreadable sidecars
    }
  }
  return records;
}

function collectAllPageKeys(groups: { items: NavigationManifestItem[] }[]): Set<string> {
  const keys = new Set<string>();
  const walk = (items: NavigationManifestItem[]) => {
    for (const item of items) {
      if (item.pageKey) keys.add(item.pageKey);
      if (item.children?.length) walk(item.children);
    }
  };
  for (const group of groups) walk(group.items);
  return keys;
}

export function sortNavigationGroupsByOrder<T extends { order?: number }>(groups: T[]): T[] {
  return [...groups].sort((left, right) => (left.order ?? 999) - (right.order ?? 999));
}

/** Re-apply patch fields (order, label, route) onto items this package already owns. */
export function applyNavigationPatchFieldsToExistingItems(
  items: NavigationManifestItem[],
  patchItems: readonly PackageNavigationPatchItemInput[],
): NavigationManifestItem[] {
  const patchByPageKey = new Map(
    patchItems
      .map((item) => [item.pageKey.trim(), item] as const)
      .filter(([pageKey]) => Boolean(pageKey)),
  );
  return items.map((item) => {
    const pageKey = item.pageKey?.trim();
    const patch = pageKey ? patchByPageKey.get(pageKey) : undefined;
    if (!pageKey || !patch || !isPackageStudioSidebarRoute(pageKey)) return item;
    const chrome = packageStudioSidebarChrome(pageKey);
    return {
      ...item,
      label: packageStudioSidebarLabel(pageKey, patch.label.trim()),
      icon: patch.icon ?? chrome?.icon ?? item.icon,
      iconColor: patch.iconColor ?? item.iconColor,
      description: patch.description ?? item.description,
      routePattern: patch.routePattern?.trim() || chrome?.routePattern || item.routePattern,
      order: patch.order ?? item.order,
      separatorBefore: patch.separatorBefore ?? item.separatorBefore,
      ...(patch.auth ? { auth: patch.auth } : {}),
    };
  });
}

/** Pull pageKeys out of other headings so a package group can own them (Core → package lift-out). */
export function relocateNavigationItemsToHeading<T extends { heading?: string | null; items: NavigationManifestItem[] }>(
  groups: T[],
  heading: string,
  pageKeys: Set<string>,
): T[] {
  if (pageKeys.size === 0) return groups;
  return groups.map((group) => {
    if ((group.heading ?? null) === heading) return group;
    const items = group.items.filter((item) => {
      const pageKey = item.pageKey?.trim();
      return !pageKey || !pageKeys.has(pageKey);
    });
    return items.length === group.items.length ? group : { ...group, items };
  });
}

function parseNavigationPatchAuth(value: unknown): PlatformRouteBindingAuth | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as PlatformRouteBindingAuth;
}

/**
 * Adds (or merges into) a nav group. Idempotent for this package: re-running install after a
 * previous partial patch merges in any missing items instead of erroring. An unowned leftover
 * group with the same heading is merged (so same-node reinstall works). Pre-existing items
 * whose pageKeys are not in this patch stay untracked (core leftovers such as API Talk).
 * Refuses if a DIFFERENT package's sidecar already owns that heading.
 */
export async function applyPackageNavigationPatch(
  packageId: string,
  input: PackageNavigationPatchInput,
): Promise<{ groupCreated: boolean; itemsAdded: number }> {
  const navigationId = input.navigationId.trim();
  const heading = input.heading.trim();
  if (!navigationId) throw new Error('navigation.addGroupWithItems: navigationId is required.');
  if (!heading) throw new Error('navigation.addGroupWithItems: heading is required.');
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('navigation.addGroupWithItems: items must be a non-empty array.');
  }

  const manifest = readNavigationFile(navigationId);
  if (!manifest) {
    throw new Error(`navigation.addGroupWithItems: navigation "${navigationId}" was not found.`);
  }

  const existingPatch = readPatchRecord(packageId);
  const ourSidecarMatches = existingPatch?.navigationId === navigationId
    && existingPatch?.heading === heading;
  const existingGroupIndex = manifest.groups.findIndex((group) => (group.heading ?? null) === heading);
  const foreignSidecarMatches = listInstalledNavigationPatches().some((record) => (
    record.packageId !== packageId
    && record.navigationId === navigationId
    && record.heading === heading
  ));
  const claim = resolveNavigationHeadingClaim({
    groupExists: existingGroupIndex !== -1,
    ourSidecarMatches,
    foreignSidecarMatches,
  });
  if (claim === 'conflict') {
    throw new Error(
      `navigation.addGroupWithItems: a group with heading "${heading}" already exists in "${navigationId}" and is not owned by this package.`,
    );
  }

  const targetPageKeys = new Set(
    input.items.map((item) => item.pageKey.trim()).filter(Boolean),
  );
  const groupsAfterRelocate = relocateNavigationItemsToHeading(manifest.groups, heading, targetPageKeys);
  const existingGroupAfterRelocate = groupsAfterRelocate.find((group) => (group.heading ?? null) === heading);
  const ourPageKeys = collectAllPageKeys(existingGroupAfterRelocate ? [existingGroupAfterRelocate] : []);
  const groupCreated = claim === 'create';
  const adoptedUnowned = claim === 'adopt';
  const maxOrder = groupsAfterRelocate.reduce((max, group) => Math.max(max, group.order ?? 0), -1);

  const newItems: NavigationManifestItem[] = [];
  for (const item of input.items) {
    const pageKey = item.pageKey.trim();
    if (!pageKey || !item.label?.trim()) {
      throw new Error('navigation.addGroupWithItems: each item needs a pageKey and a label.');
    }
    if (!isPackageStudioSidebarRoute(pageKey)) continue;
    if (ourPageKeys.has(pageKey)) continue;
    const chrome = packageStudioSidebarChrome(pageKey);
    newItems.push({
      pageKey,
      label: packageStudioSidebarLabel(pageKey, item.label.trim()),
      icon: item.icon ?? chrome?.icon,
      iconColor: item.iconColor,
      description: item.description,
      routePattern: item.routePattern?.trim() || chrome?.routePattern,
      order: item.order,
      separatorBefore: item.separatorBefore,
      ...(item.auth ? { auth: item.auth } : {}),
    });
  }

  if (groupCreated && newItems.length === 0) {
    return { groupCreated: false, itemsAdded: 0 };
  }

  const writeGroupIndex = groupsAfterRelocate.findIndex((group) => (group.heading ?? null) === heading);
  const groups = sortNavigationGroupsByOrder(
    groupCreated
      ? [
        ...groupsAfterRelocate,
        { heading, icon: input.headingIcon, order: input.headingOrder ?? maxOrder + 1, items: newItems },
      ]
      : groupsAfterRelocate.map((group, index) => (
        index === writeGroupIndex
          ? {
            ...group,
            icon: input.headingIcon ?? group.icon,
            order: input.headingOrder ?? group.order,
            items: [...applyNavigationPatchFieldsToExistingItems(group.items, input.items), ...newItems],
          }
          : group
      )),
  );

  const result = await updateNavigationManifest(navigationId, { ...manifest, groups });
  if (result.ok === false) {
    throw new Error(`navigation.addGroupWithItems: ${result.error}`);
  }

  const existingGroupKeys = existingGroupIndex === -1
    ? []
    : (manifest.groups[existingGroupIndex]?.items ?? [])
      .map((item) => item.pageKey?.trim())
      .filter((pageKey): pageKey is string => Boolean(pageKey));
  const trackedPageKeys = [
    ...new Set([
      ...(existingPatch?.itemPageKeys ?? []),
      ...(adoptedUnowned
        ? existingGroupKeys.filter((key) => targetPageKeys.has(key))
        : []),
      ...newItems.map((item) => item.pageKey!),
    ]),
  ];
  writePatchRecord({
    schema: 'package-navigation-patch',
    schemaVersion: '1.0.0',
    packageId,
    navigationId,
    heading,
    groupCreatedByUs: existingPatch?.groupCreatedByUs ?? groupCreated,
    itemPageKeys: trackedPageKeys,
    patchedAt: new Date().toISOString(),
  });

  return { groupCreated, itemsAdded: newItems.length };
}

export function parseNavigationPatchPayload(raw: string): PackageNavigationPatchInput | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const navigationId = typeof record.navigationId === 'string' ? record.navigationId.trim() : '';
    const heading = typeof record.heading === 'string' ? record.heading.trim() : '';
    if (!navigationId || !heading || !Array.isArray(record.items)) return null;
    const items: PackageNavigationPatchItemInput[] = [];
    for (const item of record.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const pageKey = typeof row.pageKey === 'string' ? row.pageKey.trim() : '';
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      if (!pageKey || !label) continue;
      const auth = parseNavigationPatchAuth(row.auth);
      items.push({
        pageKey,
        label,
        ...(typeof row.icon === 'string' ? { icon: row.icon } : {}),
        ...(typeof row.iconColor === 'string' ? { iconColor: row.iconColor } : {}),
        ...(typeof row.description === 'string' ? { description: row.description } : {}),
        ...(typeof row.routePattern === 'string' ? { routePattern: row.routePattern.trim() } : {}),
        ...(typeof row.order === 'number' ? { order: row.order } : {}),
        ...(typeof row.separatorBefore === 'boolean' ? { separatorBefore: row.separatorBefore } : {}),
        ...(auth ? { auth } : {}),
      });
    }
    if (items.length === 0) return null;
    return {
      navigationId,
      heading,
      ...(typeof record.headingIcon === 'string' ? { headingIcon: record.headingIcon } : {}),
      ...(typeof record.headingOrder === 'number' ? { headingOrder: record.headingOrder } : {}),
      items,
    };
  } catch {
    return null;
  }
}

export async function applyPackageNavigationPatchesFromManifest(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<{ applied: number }> {
  let applied = 0;
  for (const capability of manifest.capabilities.navigation_patches ?? []) {
    const raw = readPackageZipTextEntry(packageId, version, capability.entry);
    if (!raw) {
      throw new Error(`Navigation patch entry "${capability.entry}" was missing from the package artifact.`);
    }
    const patch = parseNavigationPatchPayload(raw);
    if (!patch) {
      throw new Error(`Navigation patch entry "${capability.entry}" is not a valid nav group payload.`);
    }
    if (capability.navigationId && patch.navigationId !== capability.navigationId) {
      throw new Error(
        `Navigation patch "${capability.entry}" navigationId does not match the manifest capability.`,
      );
    }
    await applyPackageNavigationPatch(packageId, patch);
    applied += 1;
  }
  return { applied };
}

/** Reverse a nav patch against in-memory groups. Exported for tests. */
export function applyNavigationPatchUninstall<T extends { heading?: string | null; items: NavigationManifestItem[] }>(
  groups: T[],
  record: Pick<NavigationPatchRecord, 'heading' | 'itemPageKeys'>,
): T[] {
  const trackedKeys = new Set(record.itemPageKeys);
  return groups
    .map((group) => {
      if ((group.heading ?? null) !== record.heading) {
        return group;
      }
      return {
        ...group,
        items: group.items.filter((item) => !item.pageKey || !trackedKeys.has(item.pageKey)),
      };
    })
    .filter((group) => {
      if ((group.heading ?? null) !== record.heading) {
        return true;
      }
      return group.items.length > 0;
    });
}

/** Reverses exactly what this package added — a no-op if it never patched navigation. */
export async function uninstallPackageNavigationPatch(packageId: string): Promise<void> {
  const record = readPatchRecord(packageId);
  if (!record) return;

  const manifest = readNavigationFile(record.navigationId);
  if (!manifest) {
    deletePatchRecord(packageId);
    return;
  }

  const groups = applyNavigationPatchUninstall(manifest.groups, record);

  await updateNavigationManifest(record.navigationId, { ...manifest, groups });
  deletePatchRecord(packageId);
}
