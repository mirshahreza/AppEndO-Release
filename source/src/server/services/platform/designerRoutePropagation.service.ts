import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import { normalizePortalPagePath } from '../../../shared/api/contracts/platform/experienceManifest';
import {
  COMPONENT_ALONE_PORTAL_SEGMENT,
  toPortalRoutePattern,
} from '../../../shared/api/contracts/platform/mountConstants';
import {
  buildDesignerComponentPath,
  canonicalizeDesignerItemSlug,
  parseDesignerComponentPath,
} from '../../../shared/lib/designerComponentPath';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  buildDesignerPageDefaultRolesJson,
  buildDesignerPageRouteAuth,
} from '../../../domain/component-designer/designerPageAccess';
import type { PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import {
  deletePlatformPageModule,
  deletePlatformRouteBinding,
  findLatestPlatformRouteBindingId,
  findPlatformPageModuleByKey,
  findPlatformRouteBindingById,
  insertPlatformPageModule,
  insertPlatformRouteBinding,
  listPlatformMountRows,
  listPlatformRouteBindingRows,
  updatePlatformPageModule,
  updatePlatformRouteBinding,
} from '../../domain/platform';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';

export const DESIGNER_ROUTE_SOURCE = 'auto' as const;

const SYSTEM_ACTOR: PlatformRegistryActor = { userId: null, username: null };

export type PropagateDesignerLayoutInput = {
  slug: string;
  title: string;
  folder?: string | null;
  /** @deprecated — use pageAccess */
  allowedRoles?: string[] | null;
  pageAccess?: FunctionAccessControl | null;
  actor?: PlatformRegistryActor;
};

const jsonOrNull = (value: unknown) => (value == null ? null : JSON.stringify(value));

const defaultNavForTitle = (title: string) => ({
  label: title,
  order: Date.now() % 100000,
});

function resolveComponentPath(input: PropagateDesignerLayoutInput): string {
  const slug = input.slug.trim();
  if (parseDesignerComponentPath(slug)) {
    return slug;
  }

  return buildDesignerComponentPath(input.folder ?? '', slug);
}

function resolvePageKey(componentPath: string, fallbackSlug: string): string {
  return parseDesignerComponentPath(componentPath)?.componentName ?? fallbackSlug;
}
function buildDesignerRouteAuthFromInput(
  input: PropagateDesignerLayoutInput,
): PlatformRouteBindingAuth | null {
  return buildDesignerPageRouteAuth({
    pageAccess: input.pageAccess ?? undefined,
    allowedRoles: input.allowedRoles ?? undefined,
  });
}

function buildDefaultRolesJsonFromInput(
  input: PropagateDesignerLayoutInput,
): string | null {
  return buildDesignerPageDefaultRolesJson({
    pageAccess: input.pageAccess ?? undefined,
    allowedRoles: input.allowedRoles ?? undefined,
  });
}

async function upsertDesignerRouteBinding(
  mountId: string,
  routePattern: string,
  pageKey: string,
  title: string,
  auth: PlatformRouteBindingAuth | null,
  actor: PlatformRegistryActor,
): Promise<void> {
  const latest = await findLatestPlatformRouteBindingId(mountId, routePattern);
  if (latest?.id) {
    const binding = await findPlatformRouteBindingById(latest.id);
    if (binding) {
      await updatePlatformRouteBinding(
        latest.id,
        {
          routePattern,
          pageKey,
          enabled: true,
          authJson: jsonOrNull(auth),
          navJson: jsonOrNull(binding.nav),
          source: DESIGNER_ROUTE_SOURCE,
        },
        actor,
      );
      return;
    }
  }

  await insertPlatformRouteBinding(
    {
      mountId,
      routePattern,
      pageKey,
      enabled: true,
      authJson: jsonOrNull(auth),
      source: DESIGNER_ROUTE_SOURCE,
      navJson: jsonOrNull(defaultNavForTitle(title)),
    },
    actor,
  );
}

export type PinDesignerPublishedLoaderInput = {
  componentPath: string;
  loaderRef: string;
  title: string;
  /** @deprecated — use pageAccess */
  allowedRoles?: string[] | null;
  pageAccess?: FunctionAccessControl | null;
  actor?: PlatformRegistryActor;
};

const pinInputToPropagation = (
  input: PinDesignerPublishedLoaderInput,
): PropagateDesignerLayoutInput => ({
  slug: input.componentPath,
  title: input.title,
  pageAccess: input.pageAccess ?? undefined,
  allowedRoles: input.allowedRoles ?? undefined,
});

export async function pinDesignerPublishedLoaderRef(
  input: PinDesignerPublishedLoaderInput,
): Promise<{ pageKey: string }> {
  const componentPath = input.componentPath.trim();
  const loaderRef = input.loaderRef.trim() || componentPath;
  const pageKey = resolvePageKey(componentPath, parseDesignerComponentPath(componentPath)?.componentName ?? componentPath);
  const actor = input.actor ?? SYSTEM_ACTOR;
  const defaultRolesJson = buildDefaultRolesJsonFromInput(pinInputToPropagation(input));
  const existingModule = await findPlatformPageModuleByKey(pageKey);

  if (!existingModule) {
    await insertPlatformPageModule(
      {
        pageKey,
        title: input.title.trim() || pageKey,
        loaderKind: 'designer',
        loaderRef,
        defaultRolesJson,
        enabled: true,
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  } else if (
    existingModule.source === DESIGNER_ROUTE_SOURCE
    || existingModule.loaderKind === 'designer'
  ) {
    await updatePlatformPageModule(
      pageKey,
      {
        title: input.title.trim() || existingModule.title,
        loaderKind: 'designer',
        loaderRef,
        defaultRolesJson,
        enabled: true,
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  }

  invalidatePlatformRuntimeConfig();
  return { pageKey };
}

export async function propagateDesignerLayoutRoutes(
  input: PropagateDesignerLayoutInput,
): Promise<{ pageKey: string; mountIds: string[] }> {
  const slug = input.slug.trim();
  const title = input.title.trim() || slug;
  if (!slug) {
    return { pageKey: slug, mountIds: [] };
  }

  const autoMounts = (await listPlatformMountRows()).filter(
    (mount) => mount.enabled && mount.designerRoutePropagation === 'auto',
  );

  const componentPath = resolveComponentPath(input);
  const pageKey = resolvePageKey(componentPath, slug);

  if (autoMounts.length === 0) {
    return { pageKey, mountIds: [] };
  }

  const actor = input.actor ?? SYSTEM_ACTOR;
  const routeAuth = buildDesignerRouteAuthFromInput(input);
  const defaultRolesJson = buildDefaultRolesJsonFromInput(input);
  const existingModule = await findPlatformPageModuleByKey(pageKey);

  if (!existingModule) {
    await insertPlatformPageModule(
      {
        pageKey,
        title,
        loaderKind: 'designer',
        loaderRef: componentPath,
        defaultRolesJson,
        enabled: true,
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  } else if (
    existingModule.source === DESIGNER_ROUTE_SOURCE
    || existingModule.loaderKind === 'designer'
  ) {
    await updatePlatformPageModule(
      pageKey,
      {
        title,
        loaderKind: 'designer',
        loaderRef: componentPath,
        defaultRolesJson,
        enabled: true,
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  }

  const studioRoutePattern = toPortalRoutePattern(componentPath);
  const componentAloneRoutePattern = normalizePortalPagePath(
    COMPONENT_ALONE_PORTAL_SEGMENT,
    componentPath,
  );
  const mountIds: string[] = [];

  for (const mount of autoMounts) {
    mountIds.push(mount.id);
    await upsertDesignerRouteBinding(mount.id, studioRoutePattern, pageKey, title, routeAuth, actor);
    await upsertDesignerRouteBinding(
      mount.id,
      componentAloneRoutePattern,
      pageKey,
      title,
      routeAuth,
      actor,
    );
  }

  invalidatePlatformRuntimeConfig();
  return { pageKey, mountIds };
}

export async function disableDesignerLayoutRoutes(
  slug: string,
  actor: PlatformRegistryActor = SYSTEM_ACTOR,
): Promise<void> {
  const normalizedSlug = canonicalizeDesignerItemSlug(slug) || slug.trim();
  if (!normalizedSlug) {
    return;
  }

  const autoBindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => binding.pageKey === normalizedSlug && binding.source === DESIGNER_ROUTE_SOURCE,
  );

  for (const binding of autoBindings) {
    if (!binding.enabled) {
      continue;
    }

    await updatePlatformRouteBinding(
      binding.id,
      {
        routePattern: binding.routePattern,
        pageKey: binding.pageKey,
        enabled: false,
        authJson: jsonOrNull(binding.auth),
        navJson: jsonOrNull(binding.nav),
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  }

  const pageModule = await findPlatformPageModuleByKey(normalizedSlug);
  if (
    pageModule
    && pageModule.source === DESIGNER_ROUTE_SOURCE
    && pageModule.enabled
  ) {
    await updatePlatformPageModule(
      normalizedSlug,
      {
        title: pageModule.title,
        loaderKind: pageModule.loaderKind,
        loaderRef: pageModule.loaderRef,
        enabled: false,
        source: DESIGNER_ROUTE_SOURCE,
      },
      actor,
    );
  }

  if (autoBindings.length > 0 || pageModule?.source === DESIGNER_ROUTE_SOURCE) {
    invalidatePlatformRuntimeConfig();
  }
}

export async function removeDesignerLayoutRoutes(
  slug: string,
): Promise<void> {
  const normalizedSlug = canonicalizeDesignerItemSlug(slug) || slug.trim();
  if (!normalizedSlug) {
    return;
  }

  const autoBindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => binding.pageKey === normalizedSlug && binding.source === DESIGNER_ROUTE_SOURCE,
  );

  for (const binding of autoBindings) {
    await deletePlatformRouteBinding(binding.id);
  }

  const pageModule = await findPlatformPageModuleByKey(normalizedSlug);
  if (pageModule && pageModule.source === DESIGNER_ROUTE_SOURCE) {
    await deletePlatformPageModule(normalizedSlug);
  }

  if (autoBindings.length > 0 || pageModule?.source === DESIGNER_ROUTE_SOURCE) {
    invalidatePlatformRuntimeConfig();
  }
}
