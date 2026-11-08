import type { PackageBuilderCatalogApiItem, PackageBuilderCatalogShellItem, PackageBuilderCatalogUiComponentItem } from './packageBuilderCatalog';
import {
  isBuiltInComponentAlonePortal,
  isBuiltInStudioPortal,
  portalSupportsNavigation,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY, BUILT_IN_STUDIO_SHELL_ENTRY } from '../../../shared/api/contracts/platform/mountConstants';
import {
  collectPortalNavigationIds,
  type NavigationManifestItem,
  type NavigationManifestSummary,
} from '../../../shared/api/contracts/platform/navigation';
import {
  formatPortalLayoutComponentPath,
  resolvePortalLayoutDesignerKey,
} from '../../platform-portals/lib/portalDesigner';
import {
  collectReusableComponentPathsFromCode,
  collectReusableComponentRefsFromDraftJson,
  collectReusableComponentRefsFromShell,
  collectShellRecipeNavigationIds,
  collectShellStarterLandingPageKeys,
  collectWorkspaceAssetUrlsFromComponents,
  collectWorkspaceAssetUrlsFromShell,
  extractApiPathsFromDesignerCode,
  extractDesignerAssetPaths,
  isPackablePackageAssetUrl,
  resolveComponentsByKeysOrIds,
} from './packageBuilderDependencyCollectors';

export type PortalPackageNavigationItem = {
  key: string;
  manifestId: string;
  groupHeading: string | null;
  label: string;
  icon?: string;
  pageKey?: string;
  routePattern?: string;
  depth: number;
};

export type PortalPackageLayoutDependency = {
  portalSegment: string;
  portalName: string;
  layoutLabel: string;
  componentKey?: string;
  catalogItem?: PackageBuilderCatalogUiComponentItem;
  shell?: PackageBuilderCatalogShellItem;
  builtIn: boolean;
};

export type PortalPackageFileDependency = {
  path: string;
  source: string;
};

export type PortalPackageDependencies = {
  navigations: NavigationManifestSummary[];
  navigationItems: PortalPackageNavigationItem[];
  layouts: PortalPackageLayoutDependency[];
  shells: PackageBuilderCatalogShellItem[];
  landings: PackageBuilderCatalogUiComponentItem[];
  files: PortalPackageFileDependency[];
};

export type ResolvePortalPackageDependenciesOptions = {
  /** Explicitly selected shells (in addition to portal-linked shells). */
  additionalShells?: readonly PackageBuilderCatalogShellItem[];
  /** Extra components whose code should contribute assets (e.g. derived pages). */
  assetScanComponents?: readonly PackageBuilderCatalogUiComponentItem[];
  /** Manually selected components that start the reusable/asset closure. */
  seedComponents?: readonly PackageBuilderCatalogUiComponentItem[];
};

export function resolveNavigationsForPortals(
  portals: readonly ExperienceManifestPortal[],
  catalogNavigations: readonly NavigationManifestSummary[],
): NavigationManifestSummary[] {
  const ids = new Set<string>();

  for (const portal of portals) {
    if (!portalSupportsNavigation(portal)) {
      continue;
    }

    const navigationRef = portal.navigationRef?.trim() || portal.segment;
    for (const id of collectPortalNavigationIds(portal.segment, navigationRef, catalogNavigations)) {
      ids.add(id);
    }
  }

  return catalogNavigations.filter((navigation) => ids.has(navigation.id));
}

export { extractApiPathsFromDesignerCode, extractDesignerAssetPaths } from './packageBuilderDependencyCollectors';

function flattenNavigationManifestItems(
  manifestId: string,
  groups: NavigationManifestSummary['groups'],
): PortalPackageNavigationItem[] {
  const items: PortalPackageNavigationItem[] = [];

  const visit = (
    manifestItems: NavigationManifestItem[],
    groupHeading: string | null,
    depth: number,
  ) => {
    manifestItems.forEach((item, index) => {
      if (item.type === 'separator') {
        return;
      }

      const label = item.label?.trim() || item.pageKey?.trim() || item.routePattern?.trim() || 'Untitled';
      items.push({
        key: `${manifestId}:${groupHeading ?? 'ungrouped'}:${depth}:${index}:${label}`,
        manifestId,
        groupHeading,
        label,
        icon: item.icon?.trim() || undefined,
        pageKey: item.pageKey?.trim() || undefined,
        routePattern: item.routePattern?.trim() || undefined,
        depth,
      });

      if (item.children?.length) {
        visit(item.children, groupHeading, depth + 1);
      }
    });
  };

  for (const group of groups) {
    const heading = group.heading?.trim() || null;
    visit(group.items, heading, 0);
  }

  return items;
}

function resolvePortalLayoutDependency(
  portal: ExperienceManifestPortal,
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[],
): PortalPackageLayoutDependency {
  if (isBuiltInStudioPortal(portal)) {
    return {
      portalSegment: portal.segment,
      portalName: portal.name,
      layoutLabel: BUILT_IN_STUDIO_SHELL_ENTRY,
      builtIn: true,
    };
  }

  if (isBuiltInComponentAlonePortal(portal)) {
    return {
      portalSegment: portal.segment,
      portalName: portal.name,
      layoutLabel: BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
      builtIn: true,
    };
  }

  const layoutKey = resolvePortalLayoutDesignerKey(portal);
  const componentKey = formatPortalLayoutComponentPath(layoutKey);
  const shell = shells.find((item) => item.shellKey === layoutKey);
  const catalogItem = shell
    ? undefined
    : uiComponents.find((item) => item.componentKey === componentKey);

  return {
    portalSegment: portal.segment,
    portalName: portal.name,
    layoutLabel: shell ? `Shell · ${shell.title}` : componentKey,
    componentKey,
    catalogItem,
    shell,
    builtIn: false,
  };
}

function pushFileDependency(
  files: PortalPackageFileDependency[],
  seenFiles: Set<string>,
  path: string,
  source: string,
): void {
  if (!isPackablePackageAssetUrl(path) || seenFiles.has(path)) {
    return;
  }
  seenFiles.add(path);
  files.push({ path, source });
}

export function resolvePortalPackageDependencies(
  portals: readonly ExperienceManifestPortal[],
  catalogNavigations: readonly NavigationManifestSummary[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[] = [],
  options: ResolvePortalPackageDependenciesOptions = {},
): PortalPackageDependencies {
  const layouts = portals
    .filter((portal) => portalSupportsNavigation(portal))
    .map((portal) => resolvePortalLayoutDependency(portal, uiComponents, shells));

  const shellByKey = new Map<string, PackageBuilderCatalogShellItem>();
  for (const layout of layouts) {
    if (layout.shell) {
      shellByKey.set(layout.shell.shellKey, layout.shell);
    }
  }
  for (const shell of options.additionalShells ?? []) {
    shellByKey.set(shell.shellKey, shell);
  }
  const resolvedShells = [...shellByKey.values()];

  const navigationIds = new Set<string>(
    resolveNavigationsForPortals(portals, catalogNavigations).map((item) => item.id),
  );
  for (const shell of resolvedShells) {
    for (const id of collectShellRecipeNavigationIds(shell)) {
      navigationIds.add(id);
    }
  }

  const navigations = catalogNavigations.filter((navigation) => navigationIds.has(navigation.id));
  const navigationItems = navigations.flatMap((navigation) => (
    flattenNavigationManifestItems(navigation.id, navigation.groups)
  ));

  const landingKeys = resolvedShells.flatMap(collectShellStarterLandingPageKeys);
  const landings = resolveComponentsByKeysOrIds(landingKeys, uiComponents);

  const files: PortalPackageFileDependency[] = [];
  const seenFiles = new Set<string>();

  for (const layout of layouts) {
    const code = layout.catalogItem?.exportBundle?.code;
    if (!code) continue;
    for (const assetPath of extractDesignerAssetPaths(code)) {
      pushFileDependency(files, seenFiles, assetPath, layout.componentKey ?? layout.layoutLabel);
    }
  }

  for (const shell of resolvedShells) {
    for (const assetPath of collectWorkspaceAssetUrlsFromShell(shell)) {
      pushFileDependency(files, seenFiles, assetPath, `shell:${shell.shellKey}`);
    }
  }

  for (const assetPath of collectWorkspaceAssetUrlsFromComponents([
    ...(options.assetScanComponents ?? []),
    ...(options.seedComponents ?? []),
  ])) {
    pushFileDependency(files, seenFiles, assetPath, 'derived-component');
  }

  for (const landing of landings) {
    const code = landing.exportBundle?.code;
    if (!code) continue;
    for (const assetPath of extractDesignerAssetPaths(code)) {
      pushFileDependency(files, seenFiles, assetPath, `landing:${landing.componentKey}`);
    }
  }

  return {
    navigations,
    navigationItems,
    layouts,
    shells: resolvedShells,
    landings,
    files,
  };
}

export function resolvePortalLayoutComponentsForPackage(
  portals: readonly ExperienceManifestPortal[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[] = [],
  options: ResolvePortalPackageDependenciesOptions = {},
): PackageBuilderCatalogUiComponentItem[] {
  const dependencies = resolvePortalPackageDependencies(portals, [], uiComponents, shells, options);
  const seen = new Set<string>();
  const items: PackageBuilderCatalogUiComponentItem[] = [];

  for (const layout of dependencies.layouts) {
    if (layout.builtIn || layout.shell || !layout.catalogItem) {
      continue;
    }

    if (seen.has(layout.catalogItem.componentKey)) {
      continue;
    }

    seen.add(layout.catalogItem.componentKey);
    items.push(layout.catalogItem);
  }

  return items;
}

function collectPortalPageKeys(
  portals: readonly ExperienceManifestPortal[],
  navigationItems: readonly PortalPackageNavigationItem[],
): string[] {
  const keys = new Set<string>();

  for (const item of navigationItems) {
    const pageKey = item.pageKey?.trim();
    if (pageKey) {
      keys.add(pageKey);
    }
  }

  for (const portal of portals) {
    for (const page of portal.pages ?? []) {
      const pageKey = page.pageKey?.trim();
      if (pageKey) {
        keys.add(pageKey);
      }
    }

    const notFound = portal.notFoundPageRef?.trim();
    if (notFound) {
      keys.add(notFound);
    }
  }

  return [...keys];
}

export function findUiComponentForPageKey(
  pageKey: string,
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
): PackageBuilderCatalogUiComponentItem | undefined {
  const key = pageKey.trim();
  if (!key) {
    return undefined;
  }

  const direct = uiComponents.find((item) => item.componentKey === key);
  if (direct) {
    return direct;
  }

  const byId = uiComponents.find((item) => item.id === key);
  if (byId) {
    return byId;
  }

  return uiComponents.find((item) => (
    item.componentKey.endsWith(`/${key}`)
    || item.componentKey.split('/').pop() === key
  ));
}

export function resolvePortalNavigationComponentsForPackage(
  portals: readonly ExperienceManifestPortal[],
  catalogNavigations: readonly NavigationManifestSummary[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[] = [],
  options: ResolvePortalPackageDependenciesOptions = {},
): PackageBuilderCatalogUiComponentItem[] {
  const dependencies = resolvePortalPackageDependencies(portals, catalogNavigations, uiComponents, shells, options);
  const pageKeys = collectPortalPageKeys(portals, dependencies.navigationItems);
  const seen = new Set<string>();
  const items: PackageBuilderCatalogUiComponentItem[] = [];

  for (const pageKey of pageKeys) {
    const component = findUiComponentForPageKey(pageKey, uiComponents);
    if (!component || seen.has(component.componentKey)) {
      continue;
    }

    seen.add(component.componentKey);
    items.push(component);
  }

  return items;
}

export function resolvePortalApisForPackage(
  components: readonly PackageBuilderCatalogUiComponentItem[],
  managedApis: readonly PackageBuilderCatalogApiItem[],
  shells: readonly PackageBuilderCatalogShellItem[] = [],
): PackageBuilderCatalogApiItem[] {
  const paths = new Set<string>();

  for (const component of components) {
    const code = component.exportBundle?.code;
    if (code) {
      for (const apiPath of extractApiPathsFromDesignerCode(code)) {
        paths.add(apiPath);
      }
    }
    const draftJson = component.exportBundle?.draftJson;
    if (draftJson) {
      for (const apiPath of extractApiPathsFromDesignerCode(draftJson)) {
        paths.add(apiPath);
      }
    }
  }

  for (const shell of shells) {
    for (const apiPath of extractApiPathsFromDesignerCode(shell.draftJson)) {
      paths.add(apiPath);
    }
  }

  return managedApis.filter((api) => paths.has(api.path));
}

function expandTransitiveReusableComponents(
  seeds: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
): PackageBuilderCatalogUiComponentItem[] {
  const seen = new Set<string>();
  const queue: PackageBuilderCatalogUiComponentItem[] = [];
  const result: PackageBuilderCatalogUiComponentItem[] = [];

  const enqueue = (item: PackageBuilderCatalogUiComponentItem | undefined) => {
    if (!item || seen.has(item.componentKey)) return;
    seen.add(item.componentKey);
    result.push(item);
    queue.push(item);
  };

  for (const seed of seeds) enqueue(seed);

  for (const ref of shells.flatMap(collectReusableComponentRefsFromShell)) {
    enqueue(findUiComponentForPageKey(ref, uiComponents));
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const code = current.exportBundle?.code;
    if (code) {
      for (const path of collectReusableComponentPathsFromCode(code)) {
        enqueue(findUiComponentForPageKey(path, uiComponents));
      }
    }
    const draftJson = current.exportBundle?.draftJson;
    if (draftJson) {
      for (const ref of collectReusableComponentRefsFromDraftJson(draftJson)) {
        enqueue(findUiComponentForPageKey(ref, uiComponents));
      }
      for (const path of collectReusableComponentPathsFromCode(draftJson)) {
        enqueue(findUiComponentForPageKey(path, uiComponents));
      }
    }
  }

  return result;
}

export function resolvePortalDerivedComponentsForPackage(
  portals: readonly ExperienceManifestPortal[],
  catalogNavigations: readonly NavigationManifestSummary[],
  uiComponents: readonly PackageBuilderCatalogUiComponentItem[],
  shells: readonly PackageBuilderCatalogShellItem[] = [],
  options: ResolvePortalPackageDependenciesOptions = {},
): PackageBuilderCatalogUiComponentItem[] {
  const dependencies = resolvePortalPackageDependencies(
    portals,
    catalogNavigations,
    uiComponents,
    shells,
    options,
  );
  const layoutComponents = resolvePortalLayoutComponentsForPackage(portals, uiComponents, shells, options);
  const navigationComponents = resolvePortalNavigationComponentsForPackage(
    portals,
    catalogNavigations,
    uiComponents,
    shells,
    options,
  );

  const seeds = [
    ...layoutComponents,
    ...navigationComponents,
    ...dependencies.landings,
    ...(options.seedComponents ?? []),
  ];

  return expandTransitiveReusableComponents(seeds, dependencies.shells, uiComponents);
}
