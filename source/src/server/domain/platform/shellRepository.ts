import {
  deleteShellFile,
  listShellFiles,
  readShellFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writeShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  buildAuditFields,
  enrichPlatformShellAudit,
  type PlatformRegistryActor,
} from '../../../core/platform-registry/platformRegistryAudit';
import type { PortalEntryMode, PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import { normalizePortalBrand, type PortalBrand } from '../../../shared/api/contracts/platform/portalBrand';

export type PlatformShellWriteInput = {
  shellKey?: string;
  name: string;
  entry: string;
  surface: string;
  enabled: boolean;
  entryMode?: PortalEntryMode | null;
  redirectToSegment?: string | null;
  redirectToCulture?: string | null;
  notFoundPageRef?: string | null;
  brand?: PortalBrand | null;
  auth?: PlatformRouteBindingAuth | null;
  navigationRef?: string | null;
  source?: string | null;
};

function normalizeNotFoundPageRef(
  entryMode: PortalEntryMode | null | undefined,
  notFoundPageRef: string | null | undefined,
): string | null {
  if (entryMode === 'redirect') {
    return null;
  }
  const trimmed = notFoundPageRef?.trim();
  return trimmed ? trimmed : null;
}

function normalizeShellBrand(
  entryMode: PortalEntryMode | null | undefined,
  brand: PortalBrand | null | undefined,
): PortalBrand | null {
  if (entryMode === 'redirect') {
    return null;
  }
  return normalizePortalBrand(brand);
}

export async function listPlatformShellRows() {
  const shells = listShellFiles().sort((left, right) => left.shellKey.localeCompare(right.shellKey));
  return shells.map((shell) => enrichPlatformShellAudit(shell));
}

export async function findPlatformShellByKey(shellKey: string) {
  const shell = readShellFile(shellKey);
  return shell ? enrichPlatformShellAudit(shell) : undefined;
}

export async function insertPlatformShell(
  input: PlatformShellWriteInput & { shellKey: string },
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    if (readShellFile(input.shellKey)) {
      throw new Error(`Shell "${input.shellKey}" already exists.`);
    }

    const entryMode = input.entryMode ?? 'shell';
    writeShellFile({
      shellKey: input.shellKey,
      name: input.name,
      entry: input.entry,
      surface: input.surface,
      enabled: input.enabled,
      entryMode,
      redirectToSegment: entryMode === 'redirect' ? input.redirectToSegment ?? null : null,
      redirectToCulture: entryMode === 'redirect' ? input.redirectToCulture ?? null : null,
      notFoundPageRef: normalizeNotFoundPageRef(entryMode, input.notFoundPageRef),
      brand: normalizeShellBrand(entryMode, input.brand),
      auth: input.auth ?? null,
      navigationRef: input.navigationRef ?? null,
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: input.source ?? null,
      ...buildAuditFields(actor),
    });
    touchPlatformRegistryIndex();
  });
}

export async function updatePlatformShell(
  shellKey: string,
  input: PlatformShellWriteInput,
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    const current = readShellFile(shellKey);
    if (!current) {
      throw new Error(`Shell "${shellKey}" not found.`);
    }

    const entryMode = input.entryMode ?? current.entryMode ?? 'shell';
    writeShellFile({
      ...current,
      name: input.name,
      entry: input.entry,
      surface: input.surface,
      enabled: input.enabled,
      entryMode,
      redirectToSegment: entryMode === 'redirect'
        ? input.redirectToSegment ?? current.redirectToSegment ?? null
        : null,
      redirectToCulture: entryMode === 'redirect'
        ? input.redirectToCulture ?? current.redirectToCulture ?? null
        : null,
      notFoundPageRef: normalizeNotFoundPageRef(
        entryMode,
        input.notFoundPageRef !== undefined
          ? input.notFoundPageRef
          : current.notFoundPageRef,
      ),
      brand: input.brand !== undefined
        ? normalizeShellBrand(entryMode, input.brand)
        : (entryMode === 'redirect' ? null : (current.brand ?? null)),
      auth: input.auth !== undefined ? input.auth : (current.auth ?? null),
      navigationRef: input.navigationRef ?? current.navigationRef ?? null,
      source: input.source ?? current.source ?? null,
      ...buildAuditFields(actor, current),
    });
    touchPlatformRegistryIndex();
  });
}

export async function deletePlatformShell(shellKey: string) {
  withPlatformRegistryLock(() => {
    deleteShellFile(shellKey);
    touchPlatformRegistryIndex();
  });
}
