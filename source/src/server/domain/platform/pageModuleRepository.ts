import type { HomeWidgetDefinition } from '../../../shared/api/contracts/home-widgets';
import type { PlatformPageLoaderKind } from '../../../shared/api/contracts/platform/types';
import {
  deletePageModuleFile,
  listPageModuleFiles,
  readPageModuleFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writePageModuleFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  buildAuditFields,
  enrichPlatformPageModuleAudit,
  type PlatformRegistryActor,
} from '../../../core/platform-registry/platformRegistryAudit';

export async function listPlatformPageModuleRows() {
  const modules = listPageModuleFiles().sort((left, right) => left.pageKey.localeCompare(right.pageKey));
  return modules.map((pageModule) => enrichPlatformPageModuleAudit(pageModule));
}

export async function findPlatformPageModuleByKey(pageKey: string) {
  const pageModule = readPageModuleFile(pageKey);
  return pageModule ? enrichPlatformPageModuleAudit(pageModule) : undefined;
}

export async function insertPlatformPageModule(
  input: {
    pageKey: string;
    title: string;
    loaderKind: string;
    loaderRef: string;
    defaultRolesJson?: string | null;
    enabled: boolean;
    homeWidgets?: HomeWidgetDefinition[];
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  const parseRoles = () => {
    if (!input.defaultRolesJson) return null;
    try {
      return JSON.parse(input.defaultRolesJson) as string[];
    } catch {
      return null;
    }
  };

  withPlatformRegistryLock(() => {
    if (readPageModuleFile(input.pageKey)) {
      throw new Error(`Page module "${input.pageKey}" already exists.`);
    }

    writePageModuleFile({
      pageKey: input.pageKey,
      title: input.title,
      loaderKind: input.loaderKind as PlatformPageLoaderKind,
      loaderRef: input.loaderRef,
      defaultRoles: parseRoles(),
      enabled: input.enabled,
      homeWidgets: input.homeWidgets,
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: input.source ?? null,
      ...buildAuditFields(actor),
    });
    touchPlatformRegistryIndex();
  });
}

export async function updatePlatformPageModule(
  pageKey: string,
  input: {
    title: string;
    loaderKind: string;
    loaderRef: string;
    defaultRolesJson?: string | null;
    enabled: boolean;
    homeWidgets?: HomeWidgetDefinition[];
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  const parseRoles = () => {
    if (!input.defaultRolesJson) return null;
    try {
      return JSON.parse(input.defaultRolesJson) as string[];
    } catch {
      return null;
    }
  };

  withPlatformRegistryLock(() => {
    const current = readPageModuleFile(pageKey);
    if (!current) {
      throw new Error(`Page module "${pageKey}" not found.`);
    }

    writePageModuleFile({
      ...current,
      title: input.title,
      loaderKind: input.loaderKind as PlatformPageLoaderKind,
      loaderRef: input.loaderRef,
      defaultRoles: parseRoles(),
      enabled: input.enabled,
      homeWidgets: input.homeWidgets !== undefined ? input.homeWidgets : current.homeWidgets,
      source: input.source ?? current.source ?? null,
      ...buildAuditFields(actor, current),
    });
    touchPlatformRegistryIndex();
  });
}

export async function deletePlatformPageModule(pageKey: string) {
  withPlatformRegistryLock(() => {
    deletePageModuleFile(pageKey);
    touchPlatformRegistryIndex();
  });
}
