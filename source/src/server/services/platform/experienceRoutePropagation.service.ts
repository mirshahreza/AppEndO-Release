import type { PlatformRouteBinding, PlatformShellRule } from '../../../shared/api/contracts/platform/types';
import {
  EXPERIENCE_ROUTE_SOURCE,
  STUDIO_MOUNT_ID,
  STUDIO_PORTAL_SEGMENT,
  toPortalRoutePattern,
} from '../../../shared/api/contracts/platform/mountConstants';
import { listBuiltinCulturePackAdapters } from '../../../core/culture/CultureRegistry';
import { logger } from '../../../core/logging/Logger';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  deletePlatformMount,
  deletePlatformRouteBinding,
  deletePlatformShellRule,
  findLatestPlatformRouteBindingId,
  findPlatformRouteBindingById,
  insertPlatformRouteBinding,
  listPlatformMountRows,
  listPlatformRouteBindingRows,
  listPlatformShellRuleRows,
  updatePlatformRouteBinding,
} from '../../domain/platform';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';

const SYSTEM_ACTOR: PlatformRegistryActor = { userId: null, username: null };

const jsonOrNull = (value: unknown) => (value == null ? null : JSON.stringify(value));

const builtinCulturePackIds = () => listBuiltinCulturePackAdapters().map((adapter) => adapter.extension.id);

function isLegacyCultureShellRule(rule: PlatformShellRule): boolean {
  return builtinCulturePackIds().includes(rule.mountId);
}

function isRedundantAdminShellRule(rule: PlatformShellRule): boolean {
  return rule.mountId === STUDIO_MOUNT_ID && rule.shellKey === 'admin';
}

export async function ensureCultureRegistryMountsRemoved(): Promise<string[]> {
  const cultureIds = new Set(builtinCulturePackIds());
  const mounts = await listPlatformMountRows();
  const removedMountIds: string[] = [];

  for (const mount of mounts) {
    if (!cultureIds.has(mount.id)) {
      continue;
    }

    await deletePlatformMount(mount.id);
    removedMountIds.push(mount.id);
  }

  if (removedMountIds.length > 0) {
    invalidatePlatformRuntimeConfig();
  }

  return removedMountIds;
}

export async function ensureExperienceShellRules(): Promise<number> {
  const rules = await listPlatformShellRuleRows();
  let removedCount = 0;

  for (const rule of rules) {
    if (!isLegacyCultureShellRule(rule) && !isRedundantAdminShellRule(rule)) {
      continue;
    }

    await deletePlatformShellRule(rule.id);
    removedCount += 1;
  }

  if (removedCount > 0) {
    invalidatePlatformRuntimeConfig();
  }

  return removedCount;
}

export async function ensureExperienceRegistryCleanup(
  actor: PlatformRegistryActor = SYSTEM_ACTOR,
): Promise<{ removedMountIds: string[]; removedShellRuleCount: number; routeSync: { mountIds: string[]; syncedCount: number } }> {
  const removedMountIds = await ensureCultureRegistryMountsRemoved();
  const removedShellRuleCount = await ensureExperienceShellRules();
  const routeSync = await ensureExperienceRouteBindings(actor);

  return { removedMountIds, removedShellRuleCount, routeSync };
}

let backgroundCleanupStarted = false;
let backgroundCleanupPromise: Promise<void> | null = null;

/** Idempotent non-blocking startup cleanup — safe to call after listen. */
export function ensureExperienceRegistryCleanupInBackground(
  actor: PlatformRegistryActor = SYSTEM_ACTOR,
): void {
  if (backgroundCleanupStarted) {
    return;
  }
  backgroundCleanupStarted = true;

  backgroundCleanupPromise = ensureExperienceRegistryCleanup(actor)
    .then(() => undefined)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Server', `Experience registry background cleanup failed: ${message}`);
    })
    .finally(() => {
      backgroundCleanupPromise = null;
    });
}

async function listAutoExperienceMounts() {
  return (await listPlatformMountRows()).filter(
    (mount) => mount.enabled && mount.designerRoutePropagation === 'auto',
  );
}

async function findExperienceMirrorBinding(
  mountId: string,
  studioBinding: PlatformRouteBinding,
): Promise<PlatformRouteBinding | undefined> {
  const experienceRoutePattern = toPortalRoutePattern(studioBinding.routePattern);
  const latest = await findLatestPlatformRouteBindingId(mountId, experienceRoutePattern);
  if (latest?.id) {
    return findPlatformRouteBindingById(latest.id);
  }

  const mountBindings = (await listPlatformRouteBindingRows() ?? []).filter(
    (binding) => binding.mountId === mountId && binding.pageKey === studioBinding.pageKey,
  );

  return mountBindings.find(
    (binding) => binding.routePattern === ''
      || binding.routePattern === STUDIO_PORTAL_SEGMENT
      || binding.routePattern === experienceRoutePattern,
  );
}

async function upsertExperienceBinding(
  mountId: string,
  studioBinding: PlatformRouteBinding,
  actor: PlatformRegistryActor,
): Promise<boolean> {
  const experienceRoutePattern = toPortalRoutePattern(studioBinding.routePattern);
  const existing = await findExperienceMirrorBinding(mountId, studioBinding);

  const payload = {
    routePattern: experienceRoutePattern,
    pageKey: studioBinding.pageKey,
    enabled: studioBinding.enabled,
    authJson: jsonOrNull(studioBinding.auth),
    navJson: jsonOrNull(studioBinding.nav),
    source: EXPERIENCE_ROUTE_SOURCE,
  };

  if (
    existing
    && (
      existing.source === EXPERIENCE_ROUTE_SOURCE
      || existing.pageKey === studioBinding.pageKey
    )
  ) {
    await updatePlatformRouteBinding(existing.id, payload, actor);
    return true;
  }

  if (!existing) {
    await insertPlatformRouteBinding(
      {
        mountId,
        ...payload,
      },
      actor,
    );
    return true;
  }

  return false;
}

export async function propagateStudioRouteBinding(
  studioBinding: PlatformRouteBinding,
  actor: PlatformRegistryActor = SYSTEM_ACTOR,
): Promise<string[]> {
  if (studioBinding.mountId !== STUDIO_MOUNT_ID) {
    return [];
  }

  const autoMounts = await listAutoExperienceMounts();
  if (autoMounts.length === 0) {
    return [];
  }

  const mountIds: string[] = [];
  for (const mount of autoMounts) {
    const synced = await upsertExperienceBinding(mount.id, studioBinding, actor);
    if (synced) {
      mountIds.push(mount.id);
    }
  }

  if (mountIds.length > 0) {
    invalidatePlatformRuntimeConfig();
  }

  return mountIds;
}

export async function removePropagatedStudioRouteBinding(
  studioBinding: PlatformRouteBinding,
): Promise<void> {
  if (studioBinding.mountId !== STUDIO_MOUNT_ID) {
    return;
  }

  const autoMounts = await listAutoExperienceMounts();
  if (autoMounts.length === 0) {
    return;
  }

  const bindings = await listPlatformRouteBindingRows();
  let changed = false;

  for (const mount of autoMounts) {
    const mirrored = bindings.find(
      (binding) => binding.mountId === mount.id
        && binding.routePattern === toPortalRoutePattern(studioBinding.routePattern)
        && binding.pageKey === studioBinding.pageKey
        && binding.source === EXPERIENCE_ROUTE_SOURCE,
    );

    if (mirrored) {
      await deletePlatformRouteBinding(mirrored.id);
      changed = true;
    }
  }

  if (changed) {
    invalidatePlatformRuntimeConfig();
  }
}

export async function ensureExperienceRouteBindings(
  actor: PlatformRegistryActor = SYSTEM_ACTOR,
): Promise<{ mountIds: string[]; syncedCount: number }> {
  const studioBindings = (await listPlatformRouteBindingRows()).filter(
    (binding) => binding.mountId === STUDIO_MOUNT_ID,
  );
  const autoMounts = await listAutoExperienceMounts();
  const allBindings = await listPlatformRouteBindingRows();

  if (autoMounts.length === 0 || studioBindings.length === 0) {
    return { mountIds: [], syncedCount: 0 };
  }

  let syncedCount = 0;
  const mountIds: string[] = [];

  for (const mount of autoMounts) {
    const legacyMirrors = allBindings.filter(
      (binding) => binding.mountId === mount.id
        && binding.source === EXPERIENCE_ROUTE_SOURCE
        && binding.routePattern !== STUDIO_PORTAL_SEGMENT
        && !binding.routePattern.startsWith(`${STUDIO_PORTAL_SEGMENT}/`),
    );

    for (const legacy of legacyMirrors) {
      await deletePlatformRouteBinding(legacy.id);
      syncedCount += 1;
    }

    const duplicateDashboards = allBindings.filter(
      (binding) => binding.mountId === mount.id
        && binding.pageKey === 'dashboard'
        && binding.routePattern !== STUDIO_PORTAL_SEGMENT,
    );

    for (const duplicate of duplicateDashboards) {
      await deletePlatformRouteBinding(duplicate.id);
      syncedCount += 1;
    }

    let mountSynced = false;
    for (const studioBinding of studioBindings) {
      const synced = await upsertExperienceBinding(mount.id, studioBinding, actor);
      if (synced) {
        syncedCount += 1;
        mountSynced = true;
      }
    }
    if (mountSynced) {
      mountIds.push(mount.id);
    }
  }

  if (syncedCount > 0) {
    invalidatePlatformRuntimeConfig();
  }

  return { mountIds, syncedCount };
}
