import type { PlatformRouteBindingAuth, PlatformRouteBindingNav } from '../../../shared/api/contracts/platform/types';
import {
  deleteRouteBindingFile,
  listRouteBindingFiles,
  nextRouteBindingId,
  readRouteBindingFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writeRouteBindingFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  buildAuditFields,
  enrichPlatformRouteBindingAudit,
  type PlatformRegistryActor,
} from '../../../core/platform-registry/platformRegistryAudit';

function sortRouteBindings(bindings: ReturnType<typeof listRouteBindingFiles>) {
  return [...bindings].sort((left, right) => {
    const mountCompare = left.mountId.localeCompare(right.mountId);
    if (mountCompare !== 0) return mountCompare;
    const routeCompare = left.routePattern.localeCompare(right.routePattern);
    if (routeCompare !== 0) return routeCompare;
    return left.id - right.id;
  });
}

const parseJson = <T>(value: string | null | undefined): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export async function listPlatformRouteBindingRows() {
  const bindings = sortRouteBindings(listRouteBindingFiles());
  return bindings.map((binding) => enrichPlatformRouteBindingAudit(binding));
}

export async function findPlatformRouteBindingById(id: number) {
  const binding = readRouteBindingFile(id);
  return binding ? enrichPlatformRouteBindingAudit(binding) : undefined;
}

export async function insertPlatformRouteBinding(
  input: {
    mountId: string;
    routePattern: string;
    pageKey: string;
    enabled: boolean;
    authJson?: string | null;
    navJson?: string | null;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    const duplicate = listRouteBindingFiles().find(
      (item) => item.mountId === input.mountId && item.routePattern === input.routePattern,
    );
    if (duplicate) {
      throw new Error(
        `Route binding for mount "${input.mountId}" and pattern "${input.routePattern}" already exists.`,
      );
    }

    const id = nextRouteBindingId();
    writeRouteBindingFile({
      id,
      mountId: input.mountId,
      routePattern: input.routePattern,
      pageKey: input.pageKey,
      enabled: input.enabled,
      auth: parseJson<PlatformRouteBindingAuth>(input.authJson),
      nav: parseJson<PlatformRouteBindingNav>(input.navJson),
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: input.source ?? null,
      ...buildAuditFields(actor),
    });
  });
}

export async function updatePlatformRouteBinding(
  id: number,
  input: {
    routePattern: string;
    pageKey: string;
    enabled: boolean;
    authJson?: string | null;
    navJson?: string | null;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    const current = readRouteBindingFile(id);
    if (!current) {
      throw new Error(`Route binding "${id}" not found.`);
    }

    const duplicate = listRouteBindingFiles().find(
      (item) => item.id !== id
        && item.mountId === current.mountId
        && item.routePattern === input.routePattern,
    );
    if (duplicate) {
      throw new Error(
        `Route binding for mount "${current.mountId}" and pattern "${input.routePattern}" already exists.`,
      );
    }

    const nextAuth = parseJson<PlatformRouteBindingAuth>(input.authJson);
    const nextNav = parseJson<PlatformRouteBindingNav>(input.navJson);
    const nextSource = input.source ?? current.source ?? null;
    if (
      current.routePattern === input.routePattern
      && current.pageKey === input.pageKey
      && current.enabled === input.enabled
      && JSON.stringify(current.auth ?? null) === JSON.stringify(nextAuth)
      && JSON.stringify(current.nav ?? null) === JSON.stringify(nextNav)
      && (current.source ?? null) === nextSource
    ) {
      return;
    }

    writeRouteBindingFile({
      ...current,
      routePattern: input.routePattern,
      pageKey: input.pageKey,
      enabled: input.enabled,
      auth: parseJson<PlatformRouteBindingAuth>(input.authJson),
      nav: parseJson<PlatformRouteBindingNav>(input.navJson),
      source: input.source ?? current.source ?? null,
      ...buildAuditFields(actor, current),
    });
    touchPlatformRegistryIndex();
  });
}

export async function deletePlatformRouteBinding(id: number) {
  withPlatformRegistryLock(() => {
    deleteRouteBindingFile(id);
    touchPlatformRegistryIndex();
  });
}

export async function findLatestPlatformRouteBindingId(
  mountId: string,
  routePattern: string,
) {
  const match = sortRouteBindings(listRouteBindingFiles())
    .filter((item) => item.mountId === mountId && item.routePattern === routePattern)
    .at(-1);
  return match ? { id: match.id } : undefined;
}
