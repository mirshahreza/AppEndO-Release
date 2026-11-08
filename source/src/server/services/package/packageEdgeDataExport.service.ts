import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { createEmptyEdgeModelStudioMeta } from '../../../shared/api/contracts/data-api';
import { getEdgeModelById } from '../data-api/edgeModelStore';
import { getEdgeApiDefinitionById } from '../data-api/edgeApiStore';
import { getEdgeModelStudioMeta } from '../data-api/edgeModelStudioMetaStore';
import { buildPackageRecordPolicyExportEntries } from './packageRecordPolicyExport.service';
import { buildPackageQuerySurfaceExportEntries } from './packageQuerySurfaceExport.service';
import { buildPackageQuerySurfaceExportEntries } from './packageQuerySurfaceExport.service';

export type PackageEdgeDataExportZipEntry = {
  path: string;
  content: Buffer;
};

export type PackageEdgeDataExportResult = {
  capabilities: {
    edge_models: PackageManifest['capabilities']['edge_models'];
    edge_apis: PackageManifest['capabilities']['edge_apis'];
    edge_model_studio_meta: PackageManifest['capabilities']['edge_model_studio_meta'];
    scope_dimensions?: PackageManifest['capabilities']['scope_dimensions'];
    record_policies?: PackageManifest['capabilities']['record_policies'];
    record_policy_bindings?: PackageManifest['capabilities']['record_policy_bindings'];
    query_surface_bindings?: PackageManifest['capabilities']['query_surface_bindings'];
  };
  zipEntries: PackageEdgeDataExportZipEntry[];
  warnings: string[];
};

function isEmptyStudioMeta(edgeModelId: string, meta: ReturnType<typeof getEdgeModelStudioMeta>): boolean {
  const empty = createEmptyEdgeModelStudioMeta(edgeModelId);
  return (
    meta.tags.length === empty.tags.length
    && meta.columnMeta.length === empty.columnMeta.length
    && meta.associationMeta.length === empty.associationMeta.length
    && Object.keys(meta.extensions).length === 0
  );
}

function jsonEntry(entryPath: string, payload: unknown): PackageEdgeDataExportZipEntry {
  return { path: entryPath, content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8') };
}

/**
 * Turns selected edge-model/edge-api ids into package manifest capability entries + the JSON
 * zip entries that back them (edge/models/<id>.json, edge/apis/<id>.json, edge/studio-meta/<id>.json).
 * Auto-includes an API's edgeModelId if the caller didn't separately select it (warns, doesn't error),
 * and skips embedding studio-meta that has no real customization (avoids bloating the package).
 */
export function buildPackageEdgeDataExportEntries(input: {
  edgeModelIds: string[];
  edgeApiIds: string[];
  includeStudioMeta?: boolean;
}): PackageEdgeDataExportResult | { ok: false; error: string; details: string[] } {
  const includeStudioMeta = input.includeStudioMeta ?? true;
  const warnings: string[] = [];
  const details: string[] = [];

  const edgeModelIds = new Set(input.edgeModelIds.map((id) => id.trim()).filter(Boolean));
  const edgeApiIds = [...new Set(input.edgeApiIds.map((id) => id.trim()).filter(Boolean))];

  const apiDefinitions = edgeApiIds.map((id) => ({ id, definition: getEdgeApiDefinitionById(id) }));
  for (const { id, definition } of apiDefinitions) {
    if (!definition) {
      details.push(`Edge API "${id}" was not found.`);
      continue;
    }
    if (!edgeModelIds.has(definition.edgeModelId)) {
      warnings.push(`Auto-included edge model "${definition.edgeModelId}" required by edge API "${id}".`);
      edgeModelIds.add(definition.edgeModelId);
    }
  }

  if (details.length > 0) {
    return { ok: false, error: 'One or more requested edge APIs were not found.', details };
  }

  const edgeModels: PackageManifest['capabilities']['edge_models'] = [];
  const edgeApis: PackageManifest['capabilities']['edge_apis'] = [];
  const edgeModelStudioMeta: PackageManifest['capabilities']['edge_model_studio_meta'] = [];
  const zipEntries: PackageEdgeDataExportZipEntry[] = [];

  for (const id of edgeModelIds) {
    const model = getEdgeModelById(id);
    if (!model) {
      details.push(`Edge model "${id}" was not found.`);
      continue;
    }
    const entry = `edge/models/${id}.json`;
    edgeModels.push({ id, entry });
    zipEntries.push(jsonEntry(entry, model));

    if (includeStudioMeta) {
      const meta = getEdgeModelStudioMeta(id);
      if (!isEmptyStudioMeta(id, meta)) {
        const metaEntry = `edge/studio-meta/${id}.json`;
        edgeModelStudioMeta.push({ edgeModelId: id, entry: metaEntry });
        zipEntries.push(jsonEntry(metaEntry, meta));
      }
    }
  }

  for (const { id, definition } of apiDefinitions) {
    if (!definition) continue;
    const entry = `edge/apis/${id}.json`;
    edgeApis.push({ id, edgeModelId: definition.edgeModelId, entry });
    zipEntries.push(jsonEntry(entry, definition));
  }

  if (details.length > 0) {
    return { ok: false, error: 'One or more requested edge models were not found.', details };
  }

  const recordPolicyExport = buildPackageRecordPolicyExportEntries({
    edgeModelIds: [...edgeModelIds],
  });
  const querySurfaceExport = buildPackageQuerySurfaceExportEntries({
    edgeModelIds: [...edgeModelIds],
  });

  return {
    capabilities: {
      edge_models: edgeModels,
      edge_apis: edgeApis,
      edge_model_studio_meta: edgeModelStudioMeta,
      scope_dimensions: recordPolicyExport.capabilities.scope_dimensions,
      record_policies: recordPolicyExport.capabilities.record_policies,
      record_policy_bindings: recordPolicyExport.capabilities.record_policy_bindings,
      query_surface_bindings: querySurfaceExport.capabilities.query_surface_bindings,
    },
    zipEntries: [...zipEntries, ...recordPolicyExport.zipEntries, ...querySurfaceExport.zipEntries],
    warnings,
  };
}
