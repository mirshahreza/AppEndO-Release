import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { getQuerySurfaceBinding } from '../query-surface/querySurfaceBindingStore';

export type PackageQuerySurfaceExportZipEntry = {
  path: string;
  content: Buffer;
};

export type PackageQuerySurfaceExportResult = {
  capabilities: {
    query_surface_bindings: NonNullable<PackageManifest['capabilities']['query_surface_bindings']>;
  };
  zipEntries: PackageQuerySurfaceExportZipEntry[];
};

const jsonEntry = (entryPath: string, payload: unknown): PackageQuerySurfaceExportZipEntry => ({
  path: entryPath,
  content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
});

export function buildPackageQuerySurfaceExportEntries(input: {
  edgeModelIds: string[];
}): PackageQuerySurfaceExportResult {
  const edgeModelIds = [...new Set(input.edgeModelIds.map((id) => id.trim()).filter(Boolean))];
  const query_surface_bindings: NonNullable<PackageManifest['capabilities']['query_surface_bindings']> = [];
  const zipEntries: PackageQuerySurfaceExportZipEntry[] = [];

  for (const edgeModelId of edgeModelIds) {
    const binding = getQuerySurfaceBinding(edgeModelId);
    if (!binding) {
      continue;
    }
    const hasGrants = Object.keys(binding.columnWhereGrants).length > 0
      || Object.keys(binding.presetGrants).length > 0;
    if (!hasGrants) {
      continue;
    }
    const entry = `query-surfaces/bindings/${edgeModelId}.json`;
    query_surface_bindings.push({ edgeModelId, entry });
    zipEntries.push(jsonEntry(entry, binding));
  }

  return {
    capabilities: { query_surface_bindings },
    zipEntries,
  };
}
