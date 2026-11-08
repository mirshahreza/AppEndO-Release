import type { DesignerRoutePropagation, PlatformRouteBindingAuth } from '../../../shared/api/contracts/platform/types';
import {
  deleteMountFile,
  deleteRouteBindingsForMount,
  deleteShellRulesForMount,
  listMountFiles,
  readMountFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writeMountFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  buildAuditFields,
  enrichPlatformMountAudit,
  type PlatformRegistryActor,
} from '../../../core/platform-registry/platformRegistryAudit';

export async function listPlatformMountRows() {
  const mounts = listMountFiles().sort((left, right) => left.pathPrefix.localeCompare(right.pathPrefix));
  return mounts.map((mount) => enrichPlatformMountAudit(mount));
}

export async function findPlatformMountById(id: string) {
  const mount = readMountFile(id);
  return mount ? enrichPlatformMountAudit(mount) : undefined;
}

export async function insertPlatformMount(
  input: {
    id: string;
    pathPrefix: string;
    name: string;
    enabled: boolean;
    defaultRoute: string;
    themeScope?: string | null;
    designerRoutePropagation: string;
    authJson: string;
    experienceConfigJson?: string | null;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  const parseJson = <T>(value: string | null | undefined): T | null => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  withPlatformRegistryLock(() => {
    if (readMountFile(input.id)) {
      throw new Error(`Mount "${input.id}" already exists.`);
    }
    const duplicatePrefix = listMountFiles().find((item) => item.pathPrefix === input.pathPrefix);
    if (duplicatePrefix) {
      throw new Error(`Mount path prefix "${input.pathPrefix}" already exists.`);
    }

    writeMountFile({
      id: input.id,
      pathPrefix: input.pathPrefix,
      name: input.name,
      enabled: input.enabled,
      defaultRoute: input.defaultRoute,
      themeScope: input.themeScope ?? null,
      designerRoutePropagation: input.designerRoutePropagation as DesignerRoutePropagation,
      authProfile: parseJson(input.authJson) ?? {},
      experienceConfig: parseJson(input.experienceConfigJson),
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: input.source ?? null,
      ...buildAuditFields(actor),
    });
    touchPlatformRegistryIndex();
  });
}

export async function updatePlatformMount(
  id: string,
  input: {
    pathPrefix: string;
    name: string;
    enabled: boolean;
    defaultRoute: string;
    themeScope?: string | null;
    designerRoutePropagation: string;
    authJson: string;
    experienceConfigJson?: string | null;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  const parseJson = <T>(value: string | null | undefined): T | null => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  withPlatformRegistryLock(() => {
    const current = readMountFile(id);
    if (!current) {
      throw new Error(`Mount "${id}" not found.`);
    }
    const duplicatePrefix = listMountFiles().find(
      (item) => item.id !== id && item.pathPrefix === input.pathPrefix,
    );
    if (duplicatePrefix) {
      throw new Error(`Mount path prefix "${input.pathPrefix}" already exists.`);
    }

    writeMountFile({
      ...current,
      pathPrefix: input.pathPrefix,
      name: input.name,
      enabled: input.enabled,
      defaultRoute: input.defaultRoute,
      themeScope: input.themeScope ?? null,
      designerRoutePropagation: input.designerRoutePropagation as DesignerRoutePropagation,
      authProfile: parseJson(input.authJson) ?? {},
      experienceConfig: parseJson(input.experienceConfigJson),
      source: input.source ?? current.source ?? null,
      ...buildAuditFields(actor, current),
    });
    touchPlatformRegistryIndex();
  });
}

export async function deletePlatformMount(id: string) {
  withPlatformRegistryLock(() => {
    deleteShellRulesForMount(id);
    deleteRouteBindingsForMount(id);
    deleteMountFile(id);
    touchPlatformRegistryIndex();
  });
}
