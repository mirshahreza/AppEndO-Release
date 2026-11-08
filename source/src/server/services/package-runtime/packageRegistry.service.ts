import type { AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import {
  buildConflictOwnerIndex,
  collectConflicts,
  conflictMessages,
  groupConflictsByOwner,
  removeConflictsFromRegistry,
} from '../../domain/package-domain/conflictDetection';
import {
  buildRegistryFromManifest,
  getEffectivePolicy,
} from '../../domain/package-domain/registryBuilder';
import {
  listInstalledObjectRegistriesForConflictScan,
  readObjectRegistry,
  removeObjectRegistry,
  writeObjectRegistry,
} from '../../domain/package-domain/objectRegistryRepository';
import { parseManifestFile, resolveVersionForInstall } from '../../domain/package-domain/manifestRepository';
import { getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import { nowIso } from '../../domain/package-domain/utils';
import type {
  ConflictItem,
  ConflictType,
  InstallPackageOptions,
  InstallSelection,
  PluginObjectRegistry,
} from '../../domain/package-domain/types';
import type { PackageEventGateway, PackageIndexGateway } from './gateways';
import { createPackageEventGateway, createPackageIndexGateway } from './gateways';

export type ConflictEvaluation = {
  denied: ConflictItem[];
  overridden: ConflictItem[];
  policy: Record<ConflictType, 'allow' | 'deny'>;
};

export interface PackageRegistryService {
  resolveVersionForInstall(packageId: string, requestedVersion?: string): InstallSelection | null;
  loadManifest(manifestPath: string): AnyPackageManifest | null;
  packageExistsInIndex(packageId: string): boolean;
  buildCandidateRegistry(
    packageId: string,
    manifest: AnyPackageManifest,
    activeVersion: string,
    targetDataSource: string,
  ): PluginObjectRegistry;
  collectConflictsFromStorage(packageId: string, candidate: PluginObjectRegistry): ConflictItem[];
  evaluateConflicts(
    conflicts: ConflictItem[],
    manifest: AnyPackageManifest,
    overridePolicy?: InstallPackageOptions['overridePolicy'],
  ): ConflictEvaluation;
  applyConflictOverrides(conflicts: ConflictItem[], actor: string, operationId: string): void;
  commitInstallRegistry(candidate: PluginObjectRegistry): void;
  removePluginRegistry(packageId: string): void;
  removePluginRegistryByScope(packageId: string, retain: {
    apis?: boolean;
    uiComponents?: boolean;
    uiRoutes?: boolean;
    dbObjects?: boolean;
    mcpServers?: boolean;
    edgeModels?: boolean;
    edgeApis?: boolean;
  }): void;
}

export type PackageRegistryServiceDeps = {
  events: PackageEventGateway;
  index: PackageIndexGateway;
};

export class DefaultPackageRegistryService implements PackageRegistryService {
  constructor(private readonly deps: PackageRegistryServiceDeps) {}

  resolveVersionForInstall(packageId: string, requestedVersion?: string): InstallSelection | null {
    return resolveVersionForInstall(packageId, requestedVersion);
  }

  loadManifest(manifestPath: string): AnyPackageManifest | null {
    return parseManifestFile(manifestPath);
  }

  packageExistsInIndex(packageId: string): boolean {
    return this.deps.index.read().packages.some((entry) => entry.packageId === packageId);
  }

  buildCandidateRegistry(
    packageId: string,
    manifest: AnyPackageManifest,
    activeVersion: string,
    targetDataSource: string,
  ): PluginObjectRegistry {
    return buildRegistryFromManifest(packageId, manifest, activeVersion, targetDataSource);
  }

  collectConflictsFromStorage(packageId: string, candidate: PluginObjectRegistry): ConflictItem[] {
    const installedMap = getInstalledVersionsMap();
    const registries = listInstalledObjectRegistriesForConflictScan(packageId, new Set(installedMap.keys()));
    const existingByType = buildConflictOwnerIndex(registries);
    return collectConflicts(packageId, candidate, existingByType);
  }

  evaluateConflicts(
    conflicts: ConflictItem[],
    manifest: AnyPackageManifest,
    overridePolicy?: InstallPackageOptions['overridePolicy'],
  ): ConflictEvaluation {
    const policy = getEffectivePolicy(manifest, overridePolicy);
    return {
      denied: conflicts.filter((item) => policy[item.objectType] !== 'allow'),
      overridden: conflicts.filter((item) => policy[item.objectType] === 'allow'),
      policy,
    };
  }

  applyConflictOverrides(conflicts: ConflictItem[], actor: string, operationId: string): void {
    const grouped = groupConflictsByOwner(conflicts);

    for (const [ownerPackageId, items] of grouped.entries()) {
      const registry = readObjectRegistry(ownerPackageId);
      if (!registry) continue;

      const nextRegistry = removeConflictsFromRegistry(registry, items, nowIso());
      writeObjectRegistry(nextRegistry);

      this.deps.events.append({
        type: 'package.lifecycle.override.applied',
        packageId: ownerPackageId,
        actor,
        correlationId: operationId,
        payload: {
          replacedCount: items.length,
        },
      });
    }
  }

  commitInstallRegistry(candidate: PluginObjectRegistry): void {
    writeObjectRegistry(candidate);
    this.deps.index.touch();
  }

  removePluginRegistry(packageId: string): void {
    removeObjectRegistry(packageId);
  }

  removePluginRegistryByScope(
    packageId: string,
    retain: {
      apis?: boolean;
      uiComponents?: boolean;
      uiRoutes?: boolean;
      dbObjects?: boolean;
      mcpServers?: boolean;
      edgeModels?: boolean;
      edgeApis?: boolean;
    },
  ): void {
    const registry = readObjectRegistry(packageId);
    if (!registry) return;

    const nextRegistry: PluginObjectRegistry = {
      ...registry,
      records: {
        apis: retain.apis ? registry.records.apis : [],
        uiComponents: retain.uiComponents ? registry.records.uiComponents : [],
        uiRoutes: retain.uiRoutes ? registry.records.uiRoutes : [],
        dbObjects: retain.dbObjects ? registry.records.dbObjects : [],
        mcpServers: retain.mcpServers ? registry.records.mcpServers : [],
        edgeModels: retain.edgeModels ? registry.records.edgeModels : [],
        edgeApis: retain.edgeApis ? registry.records.edgeApis : [],
      },
      updatedAt: nowIso(),
    };

    const hasRecords = nextRegistry.records.apis.length > 0
      || nextRegistry.records.uiComponents.length > 0
      || nextRegistry.records.uiRoutes.length > 0
      || nextRegistry.records.dbObjects.length > 0
      || nextRegistry.records.mcpServers.length > 0
      || nextRegistry.records.edgeModels.length > 0
      || nextRegistry.records.edgeApis.length > 0;

    if (!hasRecords) {
      removeObjectRegistry(packageId);
      return;
    }

    writeObjectRegistry(nextRegistry);
  }
}

export const createPackageRegistryService = (
  deps: Partial<PackageRegistryServiceDeps> = {},
): PackageRegistryService =>
  new DefaultPackageRegistryService({
    events: deps.events ?? createPackageEventGateway(),
    index: deps.index ?? createPackageIndexGateway(),
  });

export { conflictMessages };
