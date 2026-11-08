import {
  STUDIO_PORTAL_SEGMENT,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  BUILT_IN_SITE_SHELL_ENTRY,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
  SITE_PORTAL_SEGMENT,
  SITE_PORTAL_PAGE_KEYS,
} from '../../../shared/api/contracts/platform/mountConstants';
import {
  EXPERIENCE_MANIFEST_SOURCE,
  portalUsesRedirectEntry,
  isBuiltInPortal,
  isBuiltInHomePortal,
  isBuiltInStudioPortal,
  isBuiltInComponentAlonePortal,
  isBuiltInSitePortal,
  isValidExperiencePageKey,
  resolvePortalLayoutKey,
  resolvePortalRegistryKey,
  validatePortalSegmentSlug,
  validateExperienceManifest,
  type ExperienceManifestPage,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import {
  isBuiltInNavigationId,
  navigationBelongsToPortal,
} from '../../../shared/api/contracts/platform/navigation';
import {
  resolveLayoutKeyFromShellEntry,
  resolveShellEntryForLayoutKey,
} from '../../../shared/lib/designerShellEntry';
import {
  resolveDesignerComponentLoaderRef,
  resolveExperienceManifestPageKey,
} from '../../../shared/lib/designerComponentPath';
import type { PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  deleteNavigationFile,
  readNavigationFile,
  writeNavigationFile,
  listNavigationFiles,
  listRouteBindingFiles,
  deleteRouteBindingFile,
  deletePageModuleFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  deletePlatformShell,
  findPlatformShellByKey,
  insertPlatformShell,
  listPlatformShellRows,
  updatePlatformShell,
} from '../../domain/platform';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';
import { copyPortalBrandLogo, writePortalBrandLogo } from './portalBrandAssets.service';
import { normalizePortalBrand } from '../../../shared/api/contracts/platform/portalBrand';
import { getDefaultExperienceManifestService } from './experienceManifest.service';

function shellSurfaceForPortal(application: ExperienceManifestPortal): string {
  if (isBuiltInHomePortal(application)) {
    return 'home';
  }

  if (isBuiltInSitePortal(application)) {
    return 'site';
  }

  return 'studio';
}

function shellEntryForPortal(application: ExperienceManifestPortal): string {
  if (portalUsesRedirectEntry(application)) {
    return '';
  }

  if (isBuiltInStudioPortal(application)) {
    return BUILT_IN_STUDIO_SHELL_ENTRY;
  }

  if (isBuiltInComponentAlonePortal(application)) {
    return BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY;
  }

  if (isBuiltInSitePortal(application)) {
    return BUILT_IN_SITE_SHELL_ENTRY;
  }

  const layoutKey = resolvePortalLayoutKey(application.segment, application.shellKey);
  if (isBuiltInHomePortal(application) && (!layoutKey || layoutKey === HOME_SHELL_KEY)) {
    return BUILT_IN_SITE_SHELL_ENTRY;
  }

  return resolveShellEntryForLayoutKey(layoutKey);
}

async function ensureNavigationFile(
  navigationRef: string,
  portalSegment: string,
): Promise<void> {
  const existing = readNavigationFile(navigationRef);
  if (existing) {
    if (!existing.portalSegment?.trim()) {
      writeNavigationFile({
        ...existing,
        portalSegment,
      });
    }
    return;
  }

  writeNavigationFile({
    id: navigationRef,
    version: '1',
    portalSegment,
    groups: [],
  });
}

function defaultBuiltInPortalStubs(): ExperienceManifestPortal[] {
  return [
    {
      segment: ROOT_PORTAL_SEGMENT,
      name: 'Home',
      shellKey: HOME_SHELL_KEY,
      entryMode: 'redirect',
      redirectToSegment: STUDIO_PORTAL_SEGMENT,
      redirectToCulture: 'us',
      enabled: true,
      pages: [],
    },
    {
      segment: STUDIO_PORTAL_SEGMENT,
      name: 'Studio',
      shellKey: STUDIO_PORTAL_SEGMENT,
      entryMode: 'shell',
      navigationRef: STUDIO_PORTAL_SEGMENT,
      enabled: true,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [],
    },
    {
      segment: COMPONENT_ALONE_PORTAL_SEGMENT,
      name: 'Component Alone',
      shellKey: COMPONENT_ALONE_PORTAL_SEGMENT,
      entryMode: 'shell',
      enabled: true,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [],
    },
  ];
}

function buildPortalValidationContext(
  portal: ExperienceManifestPortal,
  mode: 'create' | 'update',
): { portals: ExperienceManifestPortal[]; targetIndex: number } {
  const builtInStubs = defaultBuiltInPortalStubs();
  const trimmedSegment = portal.segment.trim();

  if (mode === 'update' && isBuiltInPortal(portal)) {
    const targetIndex = builtInStubs.findIndex((stub) => stub.segment === trimmedSegment);
    if (targetIndex < 0) {
      return { portals: [...builtInStubs, portal], targetIndex: builtInStubs.length };
    }

    return {
      portals: builtInStubs.map((stub, index) => (
        index === targetIndex ? portal : stub
      )),
      targetIndex,
    };
  }

  return {
    portals: [...builtInStubs, portal],
    targetIndex: builtInStubs.length,
  };
}

function validatePortalPayload(
  portal: ExperienceManifestPortal,
  mode: 'create' | 'update',
): { ok: true; portal: ExperienceManifestPortal } | { ok: false; errors: string[] } {
  const trimmedSegment = portal.segment.trim();
  const { portals, targetIndex } = buildPortalValidationContext(portal, mode);
  const validation = validateExperienceManifest({
    id: 'admin',
    cultureId: 'us',
    portals,
  });

  if (!validation.valid) {
    const prefix = `portals[${targetIndex}].`;
    const errors = validation.errors
      .filter((error) => error.startsWith(prefix))
      .map((error) => error.slice(prefix.length));
    return { ok: false, errors: errors.length > 0 ? errors : validation.errors };
  }

  const saved = validation.manifest.portals.find(
    (item) => item.segment === trimmedSegment,
  );
  if (!saved) {
    return { ok: false, errors: ['Portal validation failed.'] };
  }

  if (mode === 'create' && isBuiltInPortal(portal)) {
    return { ok: false, errors: ['Built-in portals cannot be created.'] };
  }

  return { ok: true, portal: saved };
}

async function findPortalPlatformShell(
  segment: string,
): Promise<Awaited<ReturnType<typeof findPlatformShellByKey>>> {
  if (isBuiltInHomePortal({ segment })) {
    return findPlatformShellByKey(HOME_SHELL_KEY);
  }

  if (isBuiltInStudioPortal({ segment })) {
    return findPlatformShellByKey(STUDIO_PORTAL_SEGMENT);
  }

  if (isBuiltInComponentAlonePortal({ segment })) {
    return findPlatformShellByKey(COMPONENT_ALONE_PORTAL_SEGMENT);
  }

  const trimmedSegment = segment.trim();
  const byRegistryKey = await findPlatformShellByKey(resolvePortalRegistryKey(trimmedSegment));
  if (byRegistryKey) {
    return byRegistryKey;
  }

  const shells = await listPlatformShellRows();
  return shells.find((shell) =>
    shell.source === EXPERIENCE_MANIFEST_SOURCE
    && shell.navigationRef?.trim() === trimmedSegment,
  );
}

function portalShellNotFoundPageRef(
  application: ExperienceManifestPortal,
  isRedirect: boolean,
): string | null {
  if (isRedirect) {
    return null;
  }
  const trimmed = application.notFoundPageRef?.trim();
  return trimmed ? trimmed : null;
}

function portalShellBrand(
  application: ExperienceManifestPortal,
  isRedirect: boolean,
) {
  if (isRedirect) {
    return null;
  }
  return application.brand !== undefined ? application.brand : null;
}

function portalShellAuth(
  application: ExperienceManifestPortal,
  isRedirect: boolean,
  existingAuth?: PlatformRouteBindingAuth | null,
): PlatformRouteBindingAuth | null {
  if (isRedirect) {
    return null;
  }
  return application.auth !== undefined ? application.auth : (existingAuth ?? null);
}

async function persistPortalShell(
  application: ExperienceManifestPortal,
  actor: PlatformRegistryActor,
): Promise<void> {
  const isRedirect = portalUsesRedirectEntry(application);
  const notFoundPageRef = portalShellNotFoundPageRef(application, isRedirect);

  if (isBuiltInHomePortal(application)) {
    const existing = await findPlatformShellByKey(HOME_SHELL_KEY);
    if (!existing) {
      throw new Error('Built-in Home portal shell is not configured.');
    }

    await updatePlatformShell(
      existing.shellKey,
      {
        name: application.name.trim() || existing.name,
        entry: isRedirect ? '' : shellEntryForPortal(application),
        surface: existing.surface || shellSurfaceForPortal(application),
        enabled: application.enabled,
        entryMode: isRedirect ? 'redirect' : 'shell',
        redirectToSegment: isRedirect ? application.redirectToSegment ?? null : null,
        redirectToCulture: isRedirect ? application.redirectToCulture ?? null : null,
        notFoundPageRef,
        brand: portalShellBrand(application, isRedirect),
        auth: portalShellAuth(application, isRedirect, existing.auth),
        navigationRef: isRedirect
          ? null
          : application.navigationRef?.trim() || existing.navigationRef || ROOT_PORTAL_SEGMENT,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );

    if (!isRedirect) {
      const navigationRef = application.navigationRef?.trim() || ROOT_PORTAL_SEGMENT;
      await ensureNavigationFile(navigationRef, ROOT_PORTAL_SEGMENT);
    }

    return;
  }

  if (isBuiltInStudioPortal(application)) {
    const existing = await findPlatformShellByKey(STUDIO_PORTAL_SEGMENT);
    if (!existing) {
      throw new Error('Built-in Studio portal shell is not configured.');
    }

    await updatePlatformShell(
      existing.shellKey,
      {
        name: application.name.trim() || existing.name,
        entry: isRedirect ? '' : BUILT_IN_STUDIO_SHELL_ENTRY,
        surface: existing.surface || shellSurfaceForPortal(application),
        enabled: application.enabled,
        entryMode: isRedirect ? 'redirect' : 'shell',
        redirectToSegment: isRedirect ? application.redirectToSegment ?? null : null,
        redirectToCulture: isRedirect ? application.redirectToCulture ?? null : null,
        notFoundPageRef,
        brand: portalShellBrand(application, isRedirect),
        auth: portalShellAuth(application, isRedirect, existing.auth),
        navigationRef: isRedirect
          ? null
          : application.navigationRef?.trim() || existing.navigationRef || application.segment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );

    if (!isRedirect) {
      const navigationRef = application.navigationRef?.trim() || application.segment;
      await ensureNavigationFile(navigationRef, application.segment);
    }

    return;
  }

  if (isBuiltInComponentAlonePortal(application)) {
    let existing = await findPlatformShellByKey(COMPONENT_ALONE_PORTAL_SEGMENT);
    if (!existing) {
      await insertPlatformShell(
        {
          shellKey: COMPONENT_ALONE_PORTAL_SEGMENT,
          name: application.name.trim() || 'Component Alone',
          entry: BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
          surface: 'studio',
          enabled: application.enabled,
          entryMode: 'shell',
          redirectToSegment: null,
          redirectToCulture: null,
          notFoundPageRef,
          brand: portalShellBrand(application, false),
          auth: portalShellAuth(application, false, {
            accessMode: 'authenticated',
            allowRoles: [],
            allowUsers: [],
            denyRoles: [],
            denyUsers: [],
          }),
          navigationRef: COMPONENT_ALONE_PORTAL_SEGMENT,
          source: EXPERIENCE_MANIFEST_SOURCE,
        },
        actor,
      );
      existing = await findPlatformShellByKey(COMPONENT_ALONE_PORTAL_SEGMENT);
    }

    if (!existing) {
      throw new Error('Built-in Component Alone portal shell is not configured.');
    }

    await updatePlatformShell(
      existing.shellKey,
      {
        name: application.name.trim() || existing.name,
        entry: isRedirect ? '' : BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
        surface: existing.surface || shellSurfaceForPortal(application),
        enabled: application.enabled,
        entryMode: isRedirect ? 'redirect' : 'shell',
        redirectToSegment: isRedirect ? application.redirectToSegment ?? null : null,
        redirectToCulture: isRedirect ? application.redirectToCulture ?? null : null,
        notFoundPageRef,
        brand: portalShellBrand(application, isRedirect),
        auth: portalShellAuth(application, isRedirect, existing.auth),
        navigationRef: isRedirect
          ? null
          : application.navigationRef?.trim() || existing.navigationRef || application.segment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );

    if (!isRedirect) {
      const navigationRef = application.navigationRef?.trim() || application.segment;
      await ensureNavigationFile(navigationRef, application.segment);
    }

    return;
  }

  const registryKey = resolvePortalRegistryKey(application.segment);
  const existing = await findPlatformShellByKey(registryKey);

  if (!existing) {
    await insertPlatformShell(
      {
        shellKey: registryKey,
        name: application.name.trim() || registryKey,
        entry: shellEntryForPortal(application),
        surface: shellSurfaceForPortal(application),
        enabled: application.enabled,
        entryMode: isRedirect ? 'redirect' : 'shell',
        redirectToSegment: isRedirect ? application.redirectToSegment ?? null : null,
        redirectToCulture: isRedirect ? application.redirectToCulture ?? null : null,
        notFoundPageRef,
        brand: portalShellBrand(application, isRedirect),
        auth: portalShellAuth(application, isRedirect),
        navigationRef: isRedirect ? null : application.navigationRef?.trim() || application.segment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
  } else {
    await updatePlatformShell(
      registryKey,
      {
        name: application.name.trim() || existing.name,
        entry: isRedirect ? '' : shellEntryForPortal(application),
        surface: existing.surface || shellSurfaceForPortal(application),
        enabled: application.enabled,
        entryMode: isRedirect ? 'redirect' : 'shell',
        redirectToSegment: isRedirect ? application.redirectToSegment ?? null : null,
        redirectToCulture: isRedirect ? application.redirectToCulture ?? null : null,
        notFoundPageRef,
        brand: portalShellBrand(application, isRedirect),
        auth: portalShellAuth(application, isRedirect, existing.auth),
        navigationRef: isRedirect
          ? null
          : application.navigationRef?.trim() || existing.navigationRef || application.segment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
  }

  if (!isRedirect) {
    const navigationRef = application.navigationRef?.trim() || application.segment;
    await ensureNavigationFile(navigationRef, application.segment);
  }
}

function deletePortalOwnedRouteBindings(segment: string): void {
  const trimmed = segment.trim();
  if (!trimmed) {
    return;
  }

  for (const binding of listRouteBindingFiles()) {
    const pattern = binding.routePattern.trim();
    if (pattern === trimmed || pattern.startsWith(`${trimmed}/`)) {
      deleteRouteBindingFile(binding.id);
    }
  }
}

function deleteSitePortalPageModules(segment: string): void {
  if (segment.trim() !== SITE_PORTAL_SEGMENT) {
    return;
  }

  for (const pageKey of SITE_PORTAL_PAGE_KEYS) {
    deletePageModuleFile(pageKey);
  }
}

function deletePortalOwnedArtifacts(segment: string, navigationRef?: string | null): void {
  const portalSegment = segment.trim();
  deletePortalOwnedRouteBindings(portalSegment);
  deleteSitePortalPageModules(portalSegment);

  const navRef = navigationRef?.trim() || portalSegment;
  for (const manifest of listNavigationFiles()) {
    if (isBuiltInNavigationId(manifest.id)) {
      continue;
    }
    if (navigationBelongsToPortal(manifest, portalSegment, navRef)) {
      deleteNavigationFile(manifest.id);
    }
  }
}

export async function uploadPortalLogo(
  segment: string,
  fileName: string,
  content: Buffer,
): Promise<{ url: string }> {
  const trimmed = segment.trim();
  const existing = await findPortalPlatformShell(trimmed);
  if (!existing) {
    throw new Error(`Portal "${trimmed}" not found.`);
  }

  const written = writePortalBrandLogo(trimmed, fileName, content);
  if (!written.ok) {
    throw new Error(written.error);
  }

  return { url: written.url };
}

export async function createPortal(
  application: ExperienceManifestPortal,
  actor: PlatformRegistryActor,
): Promise<ExperienceManifestPortal> {
  const validation = validatePortalPayload(application, 'create');
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const registryKey = resolvePortalRegistryKey(validation.portal.segment);
  const shells = await listPlatformShellRows();
  if (shells.some((shell) => shell.shellKey === registryKey)) {
    throw new Error(`Portal "${validation.portal.segment}" already exists.`);
  }

  await persistPortalShell(validation.portal, actor);
  await invalidatePlatformRuntimeConfig();
  return validation.portal;
}

export async function updatePortal(
  segment: string,
  application: ExperienceManifestPortal,
  actor: PlatformRegistryActor,
): Promise<ExperienceManifestPortal> {
  if (segment.trim() !== application.segment.trim()) {
    throw new Error('Portal segment cannot be changed.');
  }

  const existing = await findPortalPlatformShell(segment);
  if (!existing) {
    throw new Error(`Portal "${segment}" not found.`);
  }

  const validation = validatePortalPayload(application, 'update');
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  await persistPortalShell(validation.portal, actor);
  await invalidatePlatformRuntimeConfig();
  return validation.portal;
}

export async function deletePortal(
  segment: string,
  actor: PlatformRegistryActor,
): Promise<void> {
  void actor;
  if (isBuiltInPortal({ segment: segment.trim() })) {
    throw new Error('Built-in portals cannot be deleted.');
  }

  const existing = await findPortalPlatformShell(segment);
  if (!existing) {
    const trimmedSegment = segment.trim();
    await deletePlatformShell(resolvePortalRegistryKey(trimmedSegment));
    deleteNavigationFile(trimmedSegment);
    deletePortalOwnedArtifacts(trimmedSegment);
    await invalidatePlatformRuntimeConfig();
    return;
  }

  const portalSegment = existing.shellKey;
  await deletePlatformShell(portalSegment);
  deletePortalOwnedArtifacts(portalSegment, existing.navigationRef);

  await invalidatePlatformRuntimeConfig();
}

export async function duplicatePortal(
  segment: string,
  actor: PlatformRegistryActor,
  target: { targetSegment: string; targetName: string },
): Promise<ExperienceManifestPortal> {
  const sourceSegment = segment.trim();
  const existing = await findPortalPlatformShell(sourceSegment);
  if (!existing) {
    throw new Error(`Portal "${sourceSegment}" not found.`);
  }

  if (isBuiltInHomePortal({ segment: sourceSegment })) {
    throw new Error('Root portal cannot be duplicated.');
  }

  const trimmedTarget = target.targetSegment.trim();
  const trimmedName = target.targetName.trim();
  const slugError = validatePortalSegmentSlug(trimmedTarget);
  if (slugError) {
    throw new Error(slugError);
  }
  if (!trimmedName) {
    throw new Error('Display name is required.');
  }

  const nextSegment = trimmedTarget;
  const registryKey = resolvePortalRegistryKey(nextSegment);
  const shells = await listPlatformShellRows();
  if (shells.some((shell) => shell.shellKey === registryKey)) {
    throw new Error(`Portal "${nextSegment}" already exists.`);
  }

  const sourceLayoutKey = resolveLayoutKeyFromShellEntry(
    existing.entry,
    resolvePortalLayoutKey(sourceSegment, existing.shellKey),
  );

  const sourceBrand = normalizePortalBrand(existing.brand);
  const copiedLogoUrl = sourceBrand?.logoUrl
    ? copyPortalBrandLogo(sourceBrand.logoUrl, nextSegment)
    : null;
  const duplicateBrand = sourceBrand
    ? { ...sourceBrand, logoUrl: copiedLogoUrl ?? sourceBrand.logoUrl ?? null }
    : null;

  const duplicate: ExperienceManifestPortal = {
    segment: nextSegment,
    name: trimmedName,
    shellKey: sourceLayoutKey,
    entryMode: existing.entryMode === 'redirect' ? 'redirect' : 'shell',
    redirectToSegment: existing.redirectToSegment ?? null,
    redirectToCulture: existing.redirectToCulture ?? null,
    notFoundPageRef: existing.notFoundPageRef?.trim() || null,
    brand: duplicateBrand,
    navigationRef: nextSegment,
    navigations: [nextSegment],
    enabled: true,
    auth: existing.auth ?? { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    pages: [],
  };

  const created = await createPortal(duplicate, actor);

  const sourceNavigationRef = existing.navigationRef?.trim()
    || (isBuiltInStudioPortal({ segment: sourceSegment })
      ? STUDIO_PORTAL_SEGMENT
      : sourceSegment);

  for (const manifest of listNavigationFiles()) {
    if (!navigationBelongsToPortal(manifest, sourceSegment, sourceNavigationRef)) {
      continue;
    }

    const targetId = manifest.id === sourceNavigationRef
      ? nextSegment
      : `${nextSegment}-${manifest.id}`;
    if (readNavigationFile(targetId)) {
      continue;
    }

    writeNavigationFile({
      ...manifest,
      id: targetId,
      portalSegment: nextSegment,
    });
  }

  if (isBuiltInStudioPortal({ segment: sourceSegment })) {
    await updatePlatformShell(
      registryKey,
      {
        name: trimmedName,
        entry: existing.entry,
        surface: existing.surface,
        enabled: true,
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
        auth: existing.auth ?? created.auth ?? null,
        navigationRef: nextSegment,
        source: EXPERIENCE_MANIFEST_SOURCE,
      },
      actor,
    );
  }

  await invalidatePlatformRuntimeConfig();
  return { ...created, name: trimmedName };
}

export async function appendDesignerPageToPortalMenu(
  portalSegment: string,
  input: { pageKey: string; path?: string; navLabel: string; loaderRef?: string },
  actor: PlatformRegistryActor,
): Promise<ExperienceManifestPortal> {
  const trimmedSegment = portalSegment.trim();
  const rawPageKey = input.pageKey.trim();
  const navLabel = input.navLabel.trim();
  if (!trimmedSegment) {
    throw new Error('Portal segment is required.');
  }
  if (!rawPageKey) {
    throw new Error('Page key is required.');
  }
  if (!navLabel) {
    throw new Error('Nav label is required.');
  }

  // Designer identity may arrive as folder/name; experience pageKey must be the name slug only.
  const pageKey = resolveExperienceManifestPageKey(rawPageKey);
  if (!isValidExperiencePageKey(pageKey)) {
    throw new Error(
      `Page key "${pageKey}" must match ^[a-z][a-z0-9-]{1,63}$.`,
    );
  }

  const designerLoaderRef = resolveDesignerComponentLoaderRef(rawPageKey)
    ?? resolveDesignerComponentLoaderRef(input.loaderRef?.trim() || '');
  const explicitLoaderRef = input.loaderRef?.trim() || '';
  const loaderRef = designerLoaderRef
    || (explicitLoaderRef && !explicitLoaderRef.startsWith('designer:')
      ? explicitLoaderRef
      : undefined);

  const defaultPath = designerLoaderRef || `${pageKey}/`;
  const path = input.path?.trim() || defaultPath;

  const manifestService = getDefaultExperienceManifestService();
  const { manifest } = await manifestService.getManifest();
  if (!manifest) {
    throw new Error('Experience manifest not found.');
  }

  const portalIndex = manifest.portals.findIndex((portal) => portal.segment === trimmedSegment);
  if (portalIndex < 0) {
    throw new Error(`Portal "${trimmedSegment}" not found.`);
  }

  const portal = manifest.portals[portalIndex];
  if (portal.pages.some((page) => page.pageKey === pageKey)) {
    throw new Error(`Page "${pageKey}" is already assigned to portal "${trimmedSegment}".`);
  }

  const nextPage: ExperienceManifestPage = {
    path,
    pageKey,
    ...(loaderRef ? { loaderRef } : {}),
    nav: { label: navLabel },
  };

  const nextManifest = {
    ...manifest,
    portals: manifest.portals.map((entry, index) => (
      index === portalIndex
        ? { ...entry, pages: [...entry.pages, nextPage] }
        : entry
    )),
  };

  const compiled = await manifestService.compileManifest(actor, nextManifest);
  if (!compiled.ok) {
    throw new Error(compiled.errors.join(' '));
  }

  const updated = compiled.manifest.portals.find((entry) => entry.segment === trimmedSegment);
  if (!updated) {
    throw new Error(`Portal "${trimmedSegment}" not found after compile.`);
  }

  return updated;
}
