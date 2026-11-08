import { getPackageDetail, listPackages } from '../../../core/packages/PackageArtifactService';
import {
  listPageModuleFiles,
  listRouteBindingFiles,
  readNavigationFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import type {
  IdeaPackageHome,
  IdeaPackageSection,
} from '../../../shared/api/contracts/idea-foundry/types';
import { IDEA_WHOLE_PACKAGE_SECTION_KEY } from '../../../shared/api/contracts/idea-foundry/types';
import type { PlatformRouteBinding } from '../../../shared/api/contracts/platform/types';
import {
  STUDIO_CORE_NAV_GROUP_ORDER,
  type NavigationManifest,
  type NavigationManifestItem,
} from '../../../shared/api/contracts/platform/navigation';
import { LIBRARIES_PAGE_KEY, PACKAGE_MANAGER_PAGE_KEY } from '../../../shared/api/contracts/platform/studioPageSeeds';

const CORE_NAV_GROUPS = new Set<string>(STUDIO_CORE_NAV_GROUP_ORDER);

const CORE_PAGE_KEYS = new Set([
  'dashboard',
  'idea-foundry',
  'server-functions',
  'data-studio',
  'sql-console',
  'client-components',
  'platform-portals',
  'platform-navigations',
  'workflows',
  'base-components',
  'appearance',
  'settings',
  'users',
  'roles',
  'file-manager',
  'platform-transfer',
  PACKAGE_MANAGER_PAGE_KEY,
  LIBRARIES_PAGE_KEY,
]);

const WHOLE_PACKAGE_SECTION: IdeaPackageSection = {
  key: IDEA_WHOLE_PACKAGE_SECTION_KEY,
  title: 'Whole package',
};

const normalize = (value: string): string => value.trim().toLowerCase();

const humanizeKey = (value: string): string => value
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase())
  .trim();

const isCorePageKey = (pageKey: string | undefined): boolean => {
  const key = pageKey?.trim() ?? '';
  return key.length > 0 && CORE_PAGE_KEYS.has(key);
};

const flattenNavItems = (items: NavigationManifestItem[]): NavigationManifestItem[] => {
  const out: NavigationManifestItem[] = [];
  for (const item of items) {
    if (item.type === 'separator') continue;
    out.push(item);
    if (item.children && item.children.length > 0) {
      out.push(...flattenNavItems(item.children));
    }
  }
  return out;
};

const groupMatchesPackage = (
  heading: string | null | undefined,
  packageId: string,
  displayName: string,
): boolean => {
  const group = heading?.trim() ?? '';
  if (!group || CORE_NAV_GROUPS.has(group)) return false;
  const normalizedGroup = normalize(group);
  return normalizedGroup === normalize(displayName)
    || normalizedGroup === normalize(packageId)
    || normalizedGroup.replace(/\s+/g, '-') === normalize(packageId);
};

const pageKeyBelongsToPackage = (pageKey: string, packageId: string): boolean => {
  const key = pageKey.trim().toLowerCase();
  const id = packageId.trim().toLowerCase();
  return key === id || key.startsWith(`${id}-`);
};

const addSection = (
  sections: Map<string, string>,
  key: string,
  title: string,
): void => {
  const trimmedKey = key.trim();
  const trimmedTitle = title.trim();
  if (!trimmedKey || isCorePageKey(trimmedKey)) return;
  if (sections.has(trimmedKey)) return;
  sections.set(trimmedKey, trimmedTitle || humanizeKey(trimmedKey));
};

const resolvePackageIcon = (
  pkg: { packageId: string; displayName: string },
  studioNav: NavigationManifest | null,
  bindings: PlatformRouteBinding[],
): string | null => {
  for (const group of studioNav?.groups ?? []) {
    if (!groupMatchesPackage(group.heading, pkg.packageId, pkg.displayName)) continue;
    const groupIcon = group.icon?.trim();
    if (groupIcon) return groupIcon;
    for (const item of flattenNavItems(group.items ?? [])) {
      const itemIcon = item.icon?.trim();
      if (itemIcon) return itemIcon;
    }
  }
  for (const binding of bindings) {
    if ((binding.ownerPackageId ?? '').trim() !== pkg.packageId) continue;
    const navIcon = binding.nav?.icon?.trim();
    if (navIcon) return navIcon;
  }
  return null;
};

const uniquePackages = (): Array<{ packageId: string; displayName: string }> => {
  const byId = new Map<string, { packageId: string; displayName: string; installed: boolean }>();
  for (const row of listPackages()) {
    const packageId = row.packageId.trim();
    if (!packageId) continue;
    const installed = row.installStatus === 'installed';
    const existing = byId.get(packageId);
    if (!existing || (installed && !existing.installed)) {
      byId.set(packageId, {
        packageId,
        displayName: row.displayName.trim() || packageId,
        installed,
      });
    }
  }
  return [...byId.values()]
    .map(({ packageId, displayName }) => ({ packageId, displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
};

export const listIdeaPackageHomes = (): IdeaPackageHome[] => {
  const packages = uniquePackages();
  const studioNav = readNavigationFile('studio');
  const pageModules = listPageModuleFiles();
  const bindings = listRouteBindingFiles();

  return packages.map((pkg) => {
    const sections = new Map<string, string>();
    sections.set(WHOLE_PACKAGE_SECTION.key, WHOLE_PACKAGE_SECTION.title);

    for (const group of studioNav?.groups ?? []) {
      if (CORE_NAV_GROUPS.has(group.heading?.trim() ?? '')) continue;
      const groupMatches = groupMatchesPackage(group.heading, pkg.packageId, pkg.displayName);
      for (const item of flattenNavItems(group.items ?? [])) {
        const pageKey = item.pageKey?.trim() ?? '';
        if (!pageKey || isCorePageKey(pageKey)) continue;
        if (groupMatches || pageKeyBelongsToPackage(pageKey, pkg.packageId)) {
          addSection(sections, pageKey, item.label?.trim() || humanizeKey(pageKey));
        }
      }
    }

    for (const binding of bindings) {
      const pageKey = binding.pageKey?.trim() ?? '';
      if (!pageKey || isCorePageKey(pageKey)) continue;
      const ownerMatch = (binding.ownerPackageId ?? '').trim() === pkg.packageId;
      const groupMatch = groupMatchesPackage(binding.nav?.group, pkg.packageId, pkg.displayName);
      const keyMatch = pageKeyBelongsToPackage(pageKey, pkg.packageId);
      if (ownerMatch || groupMatch || keyMatch) {
        addSection(sections, pageKey, binding.nav?.label?.trim() || humanizeKey(pageKey));
      }
    }

    for (const module of pageModules) {
      const pageKey = module.pageKey?.trim() ?? '';
      if (!pageKey || isCorePageKey(pageKey)) continue;
      const ownerMatch = (module.ownerPackageId ?? '').trim() === pkg.packageId;
      if (ownerMatch || pageKeyBelongsToPackage(pageKey, pkg.packageId)) {
        addSection(sections, pageKey, module.title?.trim() || humanizeKey(pageKey));
      }
    }

    try {
      const detail = getPackageDetail(pkg.packageId);
      const capabilities = detail?.bundleManifest?.capabilities;
      for (const route of capabilities?.ui_routes ?? []) {
        addSection(sections, route.pageKey, humanizeKey(route.pageKey));
      }
      for (const component of capabilities?.ui_components ?? []) {
        addSection(sections, component.componentKey, humanizeKey(component.componentKey));
      }
      for (const navigation of capabilities?.navigations ?? []) {
        addSection(sections, navigation.id, humanizeKey(navigation.id));
      }
      for (const portal of capabilities?.portals ?? []) {
        addSection(sections, portal.segment, humanizeKey(portal.segment));
      }
    } catch {
      // Catalog row still lists; skip manifest sections if the artifact cannot be read.
    }

    const listed: IdeaPackageSection[] = [...sections.entries()].map(([key, title]) => ({ key, title }));
    listed.sort((left, right) => {
      if (left.key === IDEA_WHOLE_PACKAGE_SECTION_KEY) return -1;
      if (right.key === IDEA_WHOLE_PACKAGE_SECTION_KEY) return 1;
      return left.title.localeCompare(right.title);
    });

    return {
      packageId: pkg.packageId,
      displayName: pkg.displayName,
      icon: resolvePackageIcon(pkg, studioNav, bindings),
      sections: listed,
    };
  });
};

export const findIdeaPackageHome = (
  packageId: string,
  homes: IdeaPackageHome[] = listIdeaPackageHomes(),
): IdeaPackageHome | null => {
  const id = packageId.trim().toLowerCase();
  return homes.find((home) => home.packageId.trim().toLowerCase() === id) ?? null;
};

export const findIdeaPackageSection = (
  home: IdeaPackageHome,
  sectionKey: string,
): IdeaPackageSection | null => {
  const key = sectionKey.trim().toLowerCase();
  return home.sections.find((section) => section.key.trim().toLowerCase() === key) ?? null;
};
