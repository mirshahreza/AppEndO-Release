import {
  STUDIO_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  SITE_PORTAL_SEGMENT,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  BUILT_IN_SITE_SHELL_ENTRY,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
  STUDIO_MOUNT_ID,
  toPortalRoutePattern,
} from '../../../shared/api/contracts/platform/mountConstants';
import {
  EXPERIENCE_MANIFEST_SOURCE,
  portalPageBindingPattern,
  portalSupportsNavigation,
  portalUsesRedirectEntry,
  defaultHomePortal,
  defaultStudioPortal,
  defaultComponentAlonePortal,
  defaultSitePortal,
  experiencePageIdentityKey,
  isBuiltInHomePortal,
  isBuiltInStudioPortal,
  isBuiltInComponentAlonePortal,
  isBuiltInSitePortal,
  resolvePortalLayoutKey,
  resolvePortalRegistryKey,
  type ExperienceManifest,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import {
  buildNavigationManifestFromBindings,
  collectPortalNavigationIds,
  mergeNavigationTargetOverrides,
  type NavigationManifest,
} from '../../../shared/api/contracts/platform/navigation';
import type {
  PlatformRouteBinding,
  PlatformRouteBindingAuth,
  PlatformShell,
} from '../../../shared/api/contracts/platform/types';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  PUBLIC_FUNCTION_ACCESS_CONTROL,
} from '../../../shared/api/contracts/server-functions/accessControl';
import {
  resolveLayoutKeyFromShellEntry,
  resolveShellEntryForLayoutKey,
} from '../../../shared/lib/designerShellEntry';
import {
  parseDesignerComponentPath,
  resolveDesignerComponentLoaderRef,
} from '../../../shared/lib/designerComponentPath';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  readNavigationFile,
  writeNavigationFile,
  listNavigationFiles,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  deletePlatformRouteBinding,
  findLatestPlatformRouteBindingId,
  insertPlatformPageModule,
  insertPlatformRouteBinding,
  insertPlatformShell,
  listPlatformPageModuleRows,
  listPlatformRouteBindingRows,
  listPlatformShellRows,
  updatePlatformPageModule,
  updatePlatformRouteBinding,
  updatePlatformShell,
} from '../../domain/platform';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';
import { propagateStudioRouteBinding } from './experienceRoutePropagation.service';
import {
  buildPackageDisplayNameMap,
  buildPackagePortalSegmentOwnerMap,
} from '../../../core/packages/PackageFileStore';

const jsonOrNull = (value: unknown) => (value == null ? null : JSON.stringify(value));

type InferredPageModuleLoader = {
  loaderKind: 'core' | 'designer' | 'package';
  loaderRef: string;
};

/** Infer page-module loader from an experience-manifest page.loaderRef. */
function inferPageModuleLoaderFromRef(loaderRef: string): InferredPageModuleLoader {
  const trimmed = loaderRef.trim();
  if (!trimmed) {
    return { loaderKind: 'core', loaderRef: trimmed };
  }

  if (trimmed.startsWith('package:')) {
    return { loaderKind: 'package', loaderRef: trimmed };
  }

  if (trimmed.startsWith('designer:')) {
    const rest = trimmed.slice('designer:'.length).trim();
    const designerPath = resolveDesignerComponentLoaderRef(rest) || rest;
    return { loaderKind: 'designer', loaderRef: designerPath };
  }

  if (parseDesignerComponentPath(trimmed) || resolveDesignerComponentLoaderRef(trimmed)) {
    return {
      loaderKind: 'designer',
      loaderRef: resolveDesignerComponentLoaderRef(trimmed) || trimmed,
    };
  }

  return { loaderKind: 'core', loaderRef: trimmed };
}

function attachPortalPackageOwnership(
  portal: ExperienceManifestPortal,
  shell: PlatformShell | undefined,
  portalSegmentOwners: ReadonlyMap<string, string>,
  displayNames: ReadonlyMap<string, string>,
): ExperienceManifestPortal {
  const ownerPackageId = shell?.ownerPackageId?.trim()
    || portalSegmentOwners.get(portal.segment.trim())
    || undefined;

  if (!ownerPackageId) {
    return portal;
  }

  return {
    ...portal,
    ownerPackageId,
    packageDisplayName: displayNames.get(ownerPackageId) ?? ownerPackageId,
  };
}

function bindingIsManagedByManifestPortals(
  binding: PlatformRouteBinding,
  manifest: ExperienceManifest,
): boolean {
  const bindingKey = `${binding.routePattern}::${binding.pageKey}`;

  for (const portal of manifest.portals) {
    for (const page of portal.pages) {
      if (`${portalPageBindingPattern(portal.segment, page.path)}::${page.pageKey}` === bindingKey) {
        return true;
      }
    }

    const segment = portal.segment.trim();
    if (segment === STUDIO_PORTAL_SEGMENT && binding.mountId === STUDIO_MOUNT_ID) {
      return true;
    }

    if (segment !== STUDIO_PORTAL_SEGMENT && segment !== ROOT_PORTAL_SEGMENT) {
      if (binding.routePattern === segment || binding.routePattern.startsWith(`${segment}/`)) {
        return true;
      }
    }
  }

  return false;
}

export type CompileExperienceManifestResult = {
  navigationIds: string[];
  shellKeys: string[];
  routeBindingIds: number[];
  pageModulesCreated: number;
  pageModulesUpdated: number;
  bindingsRemoved: number;
};

export type DecompileExperienceManifestInput = {
  manifestId?: string;
  cultureId: string;
};

function portalNavigationsFromRegistry(
  segment: string,
  navigationRef: string,
): string[] {
  return collectPortalNavigationIds(segment, navigationRef, listNavigationFiles());
}

function applyPortalNavigationFields(
  portal: ExperienceManifestPortal,
  navigationRef: string,
): ExperienceManifestPortal {
  return {
    ...portal,
    navigationRef,
    navigations: portalNavigationsFromRegistry(portal.segment, navigationRef),
  };
}

function resolveDecompiledPortalAuth(
  shellAuth: PlatformRouteBindingAuth | null | undefined,
  missingFallback: PlatformRouteBindingAuth,
): PlatformRouteBindingAuth | null {
  return shellAuth === undefined ? { ...missingFallback } : shellAuth;
}

function applyPortalShellFields(
  portal: ExperienceManifestPortal,
  shell: PlatformShell,
): ExperienceManifestPortal {
  return {
    ...portal,
    entryMode: shell.entryMode ?? portal.entryMode ?? 'shell',
    redirectToSegment: shell.entryMode === 'redirect'
      ? shell.redirectToSegment ?? portal.redirectToSegment ?? null
      : null,
    redirectToCulture: shell.entryMode === 'redirect'
      ? shell.redirectToCulture ?? portal.redirectToCulture ?? null
      : null,
    notFoundPageRef: shell.entryMode === 'redirect'
      ? null
      : (shell.notFoundPageRef?.trim() || portal.notFoundPageRef?.trim() || null),
    brand: shell.entryMode === 'redirect'
      ? null
      : (shell.brand !== undefined ? shell.brand : portal.brand) ?? null,
  };
}

function bindingBelongsToPortal(
  binding: PlatformRouteBinding,
  portal: ExperienceManifestPortal,
  otherSegments: string[],
): boolean {
  if (binding.mountId !== STUDIO_MOUNT_ID) {
    return false;
  }

  const pattern = binding.routePattern.trim();

  if (portal.segment === ROOT_PORTAL_SEGMENT) {
    return !pattern;
  }

  if (portal.segment === STUDIO_PORTAL_SEGMENT) {
    if (!pattern) {
      return true;
    }
    if (pattern === STUDIO_PORTAL_SEGMENT || pattern.startsWith(`${STUDIO_PORTAL_SEGMENT}/`)) {
      return true;
    }
    return !otherSegments.some(
      (segment) => pattern === segment || pattern.startsWith(`${segment}/`),
    );
  }

  return pattern === portal.segment || pattern.startsWith(`${portal.segment}/`);
}

function bindingRoutePatternToPortalPagePath(
  portal: ExperienceManifestPortal,
  routePattern: string,
): string {
  const segment = portal.segment.trim();
  const pattern = routePattern.trim();

  if (segment === STUDIO_PORTAL_SEGMENT) {
    return toPortalRoutePattern(pattern);
  }

  if (segment === ROOT_PORTAL_SEGMENT) {
    return pattern;
  }

  if (!pattern) {
    return segment;
  }

  if (pattern === segment) {
    return segment;
  }

  const segmentPrefix = `${segment}/`;
  if (pattern.startsWith(segmentPrefix)) {
    return pattern.slice(segmentPrefix.length);
  }

  return toPortalRoutePattern(pattern);
}

function bindingsToPortalPages(
  bindings: PlatformRouteBinding[],
  portal: ExperienceManifestPortal,
  otherSegments: string[],
): ExperienceManifestPortal['pages'] {
  const seenIdentities = new Set<string>();
  const pages: ExperienceManifestPortal['pages'] = [];

  for (const binding of bindings) {
    if (!binding.enabled || !bindingBelongsToPortal(binding, portal, otherSegments)) {
      continue;
    }

    const path = bindingRoutePatternToPortalPagePath(portal, binding.routePattern);
    const identity = experiencePageIdentityKey(portal.segment, path, binding.pageKey);
    if (seenIdentities.has(identity)) {
      continue;
    }
    seenIdentities.add(identity);

    pages.push({
      path,
      pageKey: binding.pageKey,
      auth: binding.auth ?? null,
      nav: binding.nav ?? null,
    });
  }

  return pages;
}

function buildPersistedSitePortal(
  siteShell: PlatformShell,
  bindings: PlatformRouteBinding[],
): ExperienceManifestPortal {
  const siteNavigationRef = siteShell.navigationRef?.trim() || SITE_PORTAL_SEGMENT;
  const sitePortal = applyPortalNavigationFields(
    applyPortalShellFields(defaultSitePortal(siteShell.shellKey), siteShell),
    siteNavigationRef,
  );
  sitePortal.auth = resolveDecompiledPortalAuth(siteShell.auth, PUBLIC_FUNCTION_ACCESS_CONTROL);
  sitePortal.name = siteShell.name || sitePortal.name;
  sitePortal.pages = bindingsToPortalPages(bindings, sitePortal, [SITE_PORTAL_SEGMENT]);
  return sitePortal;
}

function buildNavigationFromPortal(portal: ExperienceManifestPortal): NavigationManifest {
  const pseudoBindings: PlatformRouteBinding[] = portal.pages.map((page, index) => ({
    id: -(index + 1),
    mountId: STUDIO_MOUNT_ID,
    routePattern: portalPageBindingPattern(portal.segment, page.path),
    pageKey: page.pageKey,
    enabled: true,
    auth: page.auth ?? null,
    nav: page.nav ?? null,
    source: EXPERIENCE_MANIFEST_SOURCE,
  }));

  const navigation = buildNavigationManifestFromBindings({
    bindings: pseudoBindings,
    id: portal.navigationRef ?? portal.segment,
  });

  return navigation;
}

export function buildExperienceManifestFromMountContext(input: {
  manifestId: string;
  cultureId: string;
  shell: PlatformShell;
  bindings: PlatformRouteBinding[];
}): ExperienceManifest {
  const studioPortal = defaultStudioPortal(input.shell.shellKey);
  studioPortal.navigationRef = input.shell.navigationRef ?? input.manifestId;
  studioPortal.pages = bindingsToPortalPages(input.bindings, studioPortal, []);

  return {
    id: input.manifestId,
    cultureId: input.cultureId,
    portals: [defaultHomePortal(), studioPortal],
  };
}

export async function decompileExperienceManifest(
  input: DecompileExperienceManifestInput,
): Promise<ExperienceManifest | null> {
  const manifestId = input.manifestId?.trim() || 'admin';
  const shells = await listPlatformShellRows();
  const portalSegmentOwners = buildPackagePortalSegmentOwnerMap();
  const displayNames = buildPackageDisplayNameMap();
  const homeShell = shells.find((row) => row.shellKey === HOME_SHELL_KEY);
  const studioShell = shells.find((row) => row.shellKey === STUDIO_PORTAL_SEGMENT);

  if (!studioShell) {
    return null;
  }

  const bindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => binding.mountId === STUDIO_MOUNT_ID && binding.source !== 'studio-sync',
  );

  const homeLayoutKey = resolveLayoutKeyFromShellEntry(
    homeShell?.entry ?? '',
    HOME_SHELL_KEY,
  );
  const homePortalBase = applyPortalShellFields(
    defaultHomePortal(homeLayoutKey),
    homeShell ?? {
      shellKey: HOME_SHELL_KEY,
      name: 'Home',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: STUDIO_PORTAL_SEGMENT,
      redirectToCulture: 'us',
      navigationRef: null,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    },
  );
  let homePortal = {
    ...homePortalBase,
    name: homeShell?.name ?? homePortalBase.name,
  };
  homePortal.auth = resolveDecompiledPortalAuth(
    homeShell?.auth,
    AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  );
  if (portalSupportsNavigation(homePortal)) {
    homePortal = applyPortalNavigationFields(
      homePortal,
      homeShell?.navigationRef?.trim() || ROOT_PORTAL_SEGMENT,
    );
  }

  const navigationRef = studioShell.navigationRef?.trim() || STUDIO_PORTAL_SEGMENT;

  const studioPortal = applyPortalNavigationFields(
    applyPortalShellFields(
      defaultStudioPortal(studioShell.shellKey),
      studioShell,
    ),
    navigationRef,
  );
  studioPortal.auth = resolveDecompiledPortalAuth(
    studioShell.auth,
    AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  );
  studioPortal.name = studioShell.name;
  studioPortal.pages = bindingsToPortalPages(bindings, studioPortal, []);

  const componentAloneShell = shells.find((row) => row.shellKey === COMPONENT_ALONE_PORTAL_SEGMENT);
  const componentAloneNavigationRef = componentAloneShell?.navigationRef?.trim()
    || COMPONENT_ALONE_PORTAL_SEGMENT;
  const componentAlonePortal = applyPortalNavigationFields(
    applyPortalShellFields(
      defaultComponentAlonePortal(componentAloneShell?.shellKey ?? COMPONENT_ALONE_PORTAL_SEGMENT),
      componentAloneShell ?? {
      shellKey: COMPONENT_ALONE_PORTAL_SEGMENT,
      name: 'Component Alone',
      entry: BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
      surface: 'studio',
      enabled: true,
      entryMode: 'shell',
      redirectToSegment: null,
      redirectToCulture: null,
      navigationRef: COMPONENT_ALONE_PORTAL_SEGMENT,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    },
    ),
    componentAloneNavigationRef,
  );
  componentAlonePortal.auth = resolveDecompiledPortalAuth(
    componentAloneShell?.auth,
    AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  );
  componentAlonePortal.name = componentAloneShell?.name ?? componentAlonePortal.name;
  componentAlonePortal.pages = bindingsToPortalPages(
    bindings,
    componentAlonePortal,
    [COMPONENT_ALONE_PORTAL_SEGMENT],
  );

  const siteShell = shells.find((row) => row.shellKey === SITE_PORTAL_SEGMENT);
  // Site is operator-deletable. Do not synthesize a row when the shell file is gone —
  // that made delete succeed, then the list still showed Site, then delete 404'd.
  const sitePortal = siteShell
    ? buildPersistedSitePortal(siteShell, bindings)
    : null;

  const segmentShells = shells.filter(
    (row) => row.shellKey !== HOME_SHELL_KEY
      && row.shellKey !== studioShell.shellKey
      && row.shellKey !== COMPONENT_ALONE_PORTAL_SEGMENT
      && row.shellKey !== SITE_PORTAL_SEGMENT
      && row.source === EXPERIENCE_MANIFEST_SOURCE,
  );

  const additionalPortals = segmentShells.map((row) => {
    const segment = row.shellKey;
    const layoutKey = resolveLayoutKeyFromShellEntry(row.entry, segment);
    const rowNavigationRef = row.navigationRef?.trim() || segment;
    const portal: ExperienceManifestPortal = applyPortalNavigationFields(
      applyPortalShellFields({
        segment,
        name: row.name,
        shellKey: layoutKey,
        enabled: row.enabled,
        pages: [],
      }, row),
      rowNavigationRef,
    );
    portal.auth = resolveDecompiledPortalAuth(row.auth, AUTHENTICATED_FUNCTION_ACCESS_CONTROL);
    portal.pages = bindingsToPortalPages(bindings, {
      segment,
      name: row.name,
      shellKey: layoutKey,
      enabled: row.enabled,
      pages: [],
    }, [segment]);
    return portal;
  });

  return {
    id: manifestId,
    cultureId: input.cultureId,
    portals: [
      attachPortalPackageOwnership(homePortal, homeShell, portalSegmentOwners, displayNames),
      attachPortalPackageOwnership(studioPortal, studioShell, portalSegmentOwners, displayNames),
      attachPortalPackageOwnership(
        componentAlonePortal,
        componentAloneShell,
        portalSegmentOwners,
        displayNames,
      ),
      ...(sitePortal
        ? [attachPortalPackageOwnership(sitePortal, siteShell, portalSegmentOwners, displayNames)]
        : []),
      ...additionalPortals.map((portal) => {
        const segment = portal.segment.trim();
        const shell = segmentShells.find((row) => row.shellKey === segment);
        return attachPortalPackageOwnership(portal, shell, portalSegmentOwners, displayNames);
      }),
    ],
  };
}

async function compilePortal(
  portal: ExperienceManifestPortal,
  manifestId: string,
  actor: PlatformRegistryActor,
  pageModules: Awaited<ReturnType<typeof listPlatformPageModuleRows>>,
  existingBindings: PlatformRouteBinding[],
  desiredIdentities: Set<string>,
  counters: {
    pageModulesCreated: number;
    pageModulesUpdated: number;
    routeBindingIds: number[];
  },
): Promise<{ navigationId: string; shellKey: string }> {
  void manifestId;
  void desiredIdentities;
  const registryKey = resolvePortalRegistryKey(portal.segment);
  const shells = await listPlatformShellRows();
  let shell = shells.find((row) => row.shellKey === registryKey);
  if (!shell && isBuiltInStudioPortal(portal)) {
    shell = shells.find((row) => row.shellKey === STUDIO_PORTAL_SEGMENT);
  }
  if (!shell && isBuiltInComponentAlonePortal(portal)) {
    shell = shells.find((row) => row.shellKey === COMPONENT_ALONE_PORTAL_SEGMENT);
  }
  if (!shell && isBuiltInComponentAlonePortal(portal)) {
    await insertPlatformShell(
      {
        shellKey: COMPONENT_ALONE_PORTAL_SEGMENT,
        name: portal.name.trim() || 'Component Alone',
        entry: BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
        surface: 'studio',
        enabled: portal.enabled,
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
        auth: portal.auth !== undefined ? portal.auth : AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
        brand: portal.brand ?? null,
        navigationRef: COMPONENT_ALONE_PORTAL_SEGMENT,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
    shell = (await listPlatformShellRows()).find((row) => row.shellKey === COMPONENT_ALONE_PORTAL_SEGMENT);
  }
  if (!shell && isBuiltInSitePortal(portal)) {
    await insertPlatformShell(
      {
        shellKey: SITE_PORTAL_SEGMENT,
        name: portal.name.trim() || 'Site',
        entry: BUILT_IN_SITE_SHELL_ENTRY,
        surface: 'site',
        enabled: portal.enabled,
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
        auth: portal.auth !== undefined ? portal.auth : PUBLIC_FUNCTION_ACCESS_CONTROL,
        brand: portal.brand ?? null,
        navigationRef: SITE_PORTAL_SEGMENT,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
    shell = (await listPlatformShellRows()).find((row) => row.shellKey === SITE_PORTAL_SEGMENT);
  }
  if (
    !shell
    && !isBuiltInStudioPortal(portal)
    && !isBuiltInHomePortal(portal)
    && !isBuiltInComponentAlonePortal(portal)
    && !isBuiltInSitePortal(portal)
  ) {
    await insertPlatformShell(
      {
        shellKey: registryKey,
        name: portal.name.trim() || registryKey,
        entry: resolveShellEntryForLayoutKey(resolvePortalLayoutKey(portal.segment, portal.shellKey)),
        surface: 'studio',
        enabled: portal.enabled,
        entryMode: portal.entryMode ?? 'shell',
        redirectToSegment: portal.entryMode === 'redirect'
          ? portal.redirectToSegment ?? null
          : null,
        redirectToCulture: portal.entryMode === 'redirect'
          ? portal.redirectToCulture ?? null
          : null,
        auth: portal.auth !== undefined ? portal.auth : null,
        brand: portal.brand ?? null,
        navigationRef: portal.navigationRef?.trim() || portal.segment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
    shell = (await listPlatformShellRows()).find((row) => row.shellKey === registryKey);
  }

  if (!shell) {
    throw new Error(`Shell "${registryKey}" not found.`);
  }

  const isRedirect = portal.entryMode === 'redirect' || portalUsesRedirectEntry(portal);
  const navigationId = isRedirect
    ? portal.segment
    : (portal.navigationRef?.trim() || portal.segment);

  if (!isRedirect) {
    const navigation = mergeNavigationTargetOverrides(
      readNavigationFile(navigationId),
      {
        ...buildNavigationFromPortal(portal),
        portalSegment: portal.segment,
      },
    );

    writeNavigationFile(navigation);
  }

  const designerShellKey = resolvePortalLayoutKey(portal.segment, portal.shellKey);
  const nextEntry = portal.entryMode === 'redirect' || portalUsesRedirectEntry(portal)
    ? ''
    : isBuiltInStudioPortal(portal) && (!portal.shellKey || portal.shellKey === STUDIO_PORTAL_SEGMENT)
      ? BUILT_IN_STUDIO_SHELL_ENTRY
      : isBuiltInComponentAlonePortal(portal) && (!portal.shellKey || portal.shellKey === COMPONENT_ALONE_PORTAL_SEGMENT)
        ? BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY
        : isBuiltInSitePortal(portal)
          ? BUILT_IN_SITE_SHELL_ENTRY
          : isBuiltInHomePortal(portal) && (!designerShellKey || designerShellKey === HOME_SHELL_KEY)
            ? BUILT_IN_SITE_SHELL_ENTRY
            : resolveShellEntryForLayoutKey(designerShellKey);

  const preserveBuiltInShellIdentity =
    isBuiltInStudioPortal(portal)
    || isBuiltInHomePortal(portal)
    || isBuiltInComponentAlonePortal(portal)
    || isBuiltInSitePortal(portal);

  await updatePlatformShell(
    shell.shellKey,
    {
      name: preserveBuiltInShellIdentity ? shell.name : (portal.name.trim() || shell.name),
      entry: nextEntry,
      surface: shell.surface,
      enabled: portal.enabled,
      entryMode: portal.entryMode ?? 'shell',
      redirectToSegment: portal.entryMode === 'redirect'
        ? portal.redirectToSegment ?? null
        : null,
      redirectToCulture: portal.entryMode === 'redirect'
        ? portal.redirectToCulture ?? null
        : null,
      brand: portal.brand !== undefined
        ? (isRedirect ? null : portal.brand)
        : undefined,
      auth: portal.auth,
      navigationRef: isRedirect ? null : navigationId,
      source: EXPERIENCE_MANIFEST_SOURCE,
    },
    actor,
  );

  if (!portal.enabled) {
    return { navigationId, shellKey: shell.shellKey };
  }

  for (const page of portal.pages) {
    const routePattern = portalPageBindingPattern(portal.segment, page.path);
    const pageModule = pageModules.find((module) => module.pageKey === page.pageKey);

    if (page.loaderRef?.trim()) {
      const inferred = inferPageModuleLoaderFromRef(page.loaderRef);
      if (!pageModule) {
        await insertPlatformPageModule(
          {
            pageKey: page.pageKey,
            title: page.pageKey,
            loaderKind: inferred.loaderKind,
            loaderRef: inferred.loaderRef,
            enabled: true,
            source: EXPERIENCE_MANIFEST_SOURCE,
          },
          actor,
        );
        counters.pageModulesCreated += 1;
      } else if (
        pageModule.loaderRef !== inferred.loaderRef
        || (
          pageModule.loaderKind !== inferred.loaderKind
          && (pageModule.source === EXPERIENCE_MANIFEST_SOURCE || pageModule.loaderKind === 'designer')
        )
      ) {
        const nextLoaderKind = pageModule.source === EXPERIENCE_MANIFEST_SOURCE
          || pageModule.loaderKind === 'designer'
          || inferred.loaderKind === 'designer'
          ? inferred.loaderKind
          : pageModule.loaderKind;
        await updatePlatformPageModule(
          page.pageKey,
          {
            title: pageModule.title,
            loaderKind: nextLoaderKind,
            loaderRef: inferred.loaderRef,
            defaultRolesJson: pageModule.defaultRoles
              ? JSON.stringify(pageModule.defaultRoles)
              : null,
            enabled: pageModule.enabled,
            source: EXPERIENCE_MANIFEST_SOURCE,
          },
          actor,
        );
        counters.pageModulesUpdated += 1;
      }
    }

    const payload = {
      routePattern,
      pageKey: page.pageKey,
      enabled: true,
      authJson: jsonOrNull(page.auth),
      navJson: jsonOrNull(page.nav),
      source: EXPERIENCE_MANIFEST_SOURCE,
    };

    const latest = await findLatestPlatformRouteBindingId(STUDIO_MOUNT_ID, routePattern);
    const existing = latest?.id
      ? existingBindings.find((binding) => binding.id === latest.id)
      : existingBindings.find(
        (binding) => binding.pageKey === page.pageKey && binding.routePattern === routePattern,
      );

    if (existing) {
      await updatePlatformRouteBinding(existing.id, payload, actor);
      counters.routeBindingIds.push(existing.id);
    } else {
      await insertPlatformRouteBinding(
        {
          mountId: STUDIO_MOUNT_ID,
          ...payload,
        },
        actor,
      );
      const created = await findLatestPlatformRouteBindingId(STUDIO_MOUNT_ID, routePattern);
      if (created?.id) {
        counters.routeBindingIds.push(created.id);
      }
    }
  }

  return { navigationId, shellKey: shell.shellKey };
}

export async function compileExperienceManifest(
  manifest: ExperienceManifest,
  actor: PlatformRegistryActor,
): Promise<CompileExperienceManifestResult> {
  const pageModules = await listPlatformPageModuleRows();
  const existingBindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => binding.mountId === STUDIO_MOUNT_ID,
  );

  const desiredIdentities = new Set(
    manifest.portals.flatMap((portal) => portal.pages.map(
      (page) => experiencePageIdentityKey(portal.segment, page.path, page.pageKey),
    )),
  );

  const counters = {
    pageModulesCreated: 0,
    pageModulesUpdated: 0,
    routeBindingIds: [] as number[],
  };

  const navigationIds: string[] = [];
  const shellKeys: string[] = [];

  for (const portal of manifest.portals) {
    const result = await compilePortal(
      portal,
      manifest.id,
      actor,
      pageModules,
      existingBindings,
      desiredIdentities,
      counters,
    );
    navigationIds.push(result.navigationId);
    shellKeys.push(result.shellKey);
  }

  const desiredBindingKeys = new Set(
    manifest.portals.flatMap((portal) => portal.pages.map(
      (page) => `${portalPageBindingPattern(portal.segment, page.path)}::${page.pageKey}`,
    )),
  );

  let bindingsRemoved = 0;
  for (const binding of existingBindings) {
    if (binding.source !== EXPERIENCE_MANIFEST_SOURCE) {
      continue;
    }

    const bindingKey = `${binding.routePattern}::${binding.pageKey}`;
    if (desiredBindingKeys.has(bindingKey)) {
      continue;
    }

    if (!bindingIsManagedByManifestPortals(binding, manifest)) {
      continue;
    }

    await deletePlatformRouteBinding(binding.id);
    bindingsRemoved += 1;
  }

  const refreshedBindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => counters.routeBindingIds.includes(binding.id),
  );
  for (const binding of refreshedBindings) {
    await propagateStudioRouteBinding(binding, actor);
  }

  invalidatePlatformRuntimeConfig();

  return {
    navigationIds,
    shellKeys,
    routeBindingIds: counters.routeBindingIds,
    pageModulesCreated: counters.pageModulesCreated,
    pageModulesUpdated: counters.pageModulesUpdated,
    bindingsRemoved,
  };
}
