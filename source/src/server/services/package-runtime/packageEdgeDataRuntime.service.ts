import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { listInstalledObjectRegistriesForConflictScan } from '../../domain/package-domain/objectRegistryRepository';
import { getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import type { PluginObjectRegistry } from '../../domain/package-domain/types';
import {
  edgeApiDefinitionSchema,
  edgeModelDefinitionSchema,
  upsertEdgeModelStudioMetaInputSchema,
  type EdgeApiDefinition,
  type EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import { saveEdgeModel, deleteEdgeModel, getEdgeModelById } from '../data-api/edgeModelStore';
import { getEdgeApiDefinitionById, saveEdgeApiDefinition } from '../data-api/edgeApiStore';
import { publishEdgeApiDefinition, deleteEdgeApiDefinitionById } from '../data-api/edgeApiPublisher';
import { upsertEdgeModelStudioMeta, deleteEdgeModelStudioMeta, hasEdgeModelStudioMeta } from '../data-api/edgeModelStudioMetaStore';

export type PackageEdgeDataCreatedIds = {
  models: string[];
  apis: string[];
  studioMeta: string[];
};

export type PackageEdgeDataInstallResult =
  | { ok: true; installed: PackageEdgeDataCreatedIds; created: PackageEdgeDataCreatedIds }
  | { ok: false; error: string; details: string[]; created: PackageEdgeDataCreatedIds };

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readJsonFromArtifact(artifactPath: string, entryPath: string): unknown {
  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(entryPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return undefined;
  return JSON.parse(entry.getData().toString('utf8'));
}

/** Read-only guard: is this edge model/API id already owned by a *different* installed package? */
function findConflictingOwner(
  packageId: string,
  conflictKey: string,
  pick: (registry: PluginObjectRegistry) => Array<{ conflictKey: string }>,
): string | null {
  const installedMap = getInstalledVersionsMap();
  const others = listInstalledObjectRegistriesForConflictScan(packageId, new Set(installedMap.keys()));
  for (const { ownerPackageId, registry } of others) {
    if (pick(registry).some((record) => record.conflictKey === conflictKey)) {
      return ownerPackageId;
    }
  }
  return null;
}

/**
 * Writes edge_models / edge_apis / edge_model_studio_meta capability entries into the shared
 * workspace/edge-* namespaces. Order matters: models -> apis (published, so the managed
 * DATA_API functions + route cache are live) -> studio-meta. Ids already on this node are
 * reused and omitted from `created` so install rollback does not delete them.
 */
export async function installPackageEdgeData(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<PackageEdgeDataInstallResult> {
  const { edge_models: edgeModels, edge_apis: edgeApis, edge_model_studio_meta: studioMetaEntries } = manifest.capabilities;
  const emptyCreated: PackageEdgeDataCreatedIds = { models: [], apis: [], studioMeta: [] };
  if (edgeModels.length === 0 && edgeApis.length === 0 && studioMetaEntries.length === 0) {
    return { ok: true, installed: emptyCreated, created: emptyCreated };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return {
      ok: false,
      error: `Artifact for package "${packageId}"@${version} was not found.`,
      details: [],
      created: emptyCreated,
    };
  }

  const details: string[] = [];
  const installedModels: string[] = [];
  const installedApis: string[] = [];
  const installedStudioMeta: string[] = [];
  const created: PackageEdgeDataCreatedIds = { models: [], apis: [], studioMeta: [] };

  for (const item of edgeModels) {
    const owner = findConflictingOwner(packageId, `edge_model::${item.id}`, (r) => r.records.edgeModels);
    if (owner) {
      details.push(`Edge model "${item.id}" is already owned by package "${owner}".`);
      continue;
    }
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Edge model entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    try {
      const parsed = edgeModelDefinitionSchema.parse(raw) as EdgeModelDefinition;
      const existed = Boolean(getEdgeModelById(parsed.id));
      saveEdgeModel(parsed);
      installedModels.push(parsed.id);
      if (!existed) created.models.push(parsed.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid edge model definition.';
      details.push(`Edge model "${item.id}" failed: ${message}`);
    }
  }

  for (const item of edgeApis) {
    const owner = findConflictingOwner(packageId, `edge_api::${item.id}`, (r) => r.records.edgeApis);
    if (owner) {
      details.push(`Edge API "${item.id}" is already owned by package "${owner}".`);
      continue;
    }
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Edge API entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    try {
      const parsed = edgeApiDefinitionSchema.parse(raw) as EdgeApiDefinition;
      const existingApi = getEdgeApiDefinitionById(parsed.id);
      saveEdgeApiDefinition(parsed);
      installedApis.push(parsed.id);
      if (existingApi?.publishedAt) {
        continue;
      }
      publishEdgeApiDefinition(parsed.id);
      created.apis.push(parsed.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid edge API definition.';
      details.push(`Edge API "${item.id}" failed: ${message}`);
    }
  }

  for (const item of studioMetaEntries) {
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Edge model studio-meta entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    try {
      const parsedRaw = raw as Record<string, unknown>;
      const input = upsertEdgeModelStudioMetaInputSchema.parse({
        tags: parsedRaw.tags,
        columnMeta: parsedRaw.columnMeta,
        associationMeta: parsedRaw.associationMeta,
        extensions: parsedRaw.extensions,
      });
      const existedMeta = hasEdgeModelStudioMeta(item.edgeModelId);
      upsertEdgeModelStudioMeta(item.edgeModelId, input);
      installedStudioMeta.push(item.edgeModelId);
      if (!existedMeta) created.studioMeta.push(item.edgeModelId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid edge model studio-meta.';
      details.push(`Edge model studio-meta "${item.edgeModelId}" failed: ${message}`);
    }
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'One or more edge data capabilities failed to install.',
      details,
      created,
    };
  }

  return {
    ok: true,
    installed: { models: installedModels, apis: installedApis, studioMeta: installedStudioMeta },
    created,
  };
}

/**
 * Reverse order — apis (unpublish + delete) -> studio-meta -> models. Uses the package's own
 * registry snapshot (source of truth for ownership), not the manifest, so it stays correct even
 * if the manifest changed between install and uninstall.
 */
export function uninstallCreatedPackageEdgeData(created: PackageEdgeDataCreatedIds): void {
  for (const apiId of created.apis) {
    try {
      deleteEdgeApiDefinitionById(apiId);
    } catch {
      // Already removed.
    }
  }
  for (const modelId of [...created.studioMeta, ...created.models]) {
    deleteEdgeModelStudioMeta(modelId);
    deleteEdgeModel(modelId);
  }
}

export function uninstallPackageEdgeData(registry: PluginObjectRegistry): void {
  uninstallCreatedPackageEdgeData({
    models: registry.records.edgeModels.map((record) => record.edgeModelId),
    apis: registry.records.edgeApis.map((record) => record.edgeApiId),
    studioMeta: registry.records.edgeModels.map((record) => record.edgeModelId),
  });
}
