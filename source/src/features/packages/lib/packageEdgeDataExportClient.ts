import { apiPost } from '../../../shared/api/client';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';

export type PackageEdgeDataExportResult = {
  capabilities: Pick<
    PackageManifest['capabilities'],
    'edge_models' | 'edge_apis' | 'edge_model_studio_meta' | 'scope_dimensions' | 'record_policies' | 'record_policy_bindings'
  >;
  files: Array<{ path: string; content: string }>;
  warnings: string[];
};

export async function fetchPackageEdgeDataExport(input: {
  edgeModelIds?: string[];
  edgeApiIds?: string[];
}): Promise<PackageEdgeDataExportResult> {
  const { data, response } = await apiPost<{
    success?: boolean;
    error?: string;
    details?: string[];
    capabilities?: PackageEdgeDataExportResult['capabilities'];
    files?: Array<{ path: string; content: string }>;
    warnings?: string[];
  }>('/api/packages/builder/edge-data-export', input);

  if (!response.ok || !data?.success) {
    const details = Array.isArray(data?.details) ? data.details.join(' · ') : '';
    throw new Error(
      [data?.error || 'Failed to export Edge data for the package.', details].filter(Boolean).join(' '),
    );
  }

  return {
    capabilities: {
      edge_models: Array.isArray(data.capabilities?.edge_models) ? data.capabilities.edge_models : [],
      edge_apis: Array.isArray(data.capabilities?.edge_apis) ? data.capabilities.edge_apis : [],
      edge_model_studio_meta: Array.isArray(data.capabilities?.edge_model_studio_meta)
        ? data.capabilities.edge_model_studio_meta
        : [],
      scope_dimensions: data.capabilities?.scope_dimensions,
      record_policies: data.capabilities?.record_policies,
      record_policy_bindings: data.capabilities?.record_policy_bindings,
    },
    files: Array.isArray(data.files)
      ? data.files.filter((file): file is { path: string; content: string } => (
        !!file
        && typeof file.path === 'string'
        && file.path.trim().length > 0
        && typeof file.content === 'string'
      ))
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}
