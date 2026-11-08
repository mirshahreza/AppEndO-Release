import { apiPost } from '../../../shared/api/client';

export type PackageWorkflowCapability = {
  scopeKey: string;
  key: string;
  entry: string;
};

export type PackageWorkflowExportResult = {
  capabilities: { workflows: PackageWorkflowCapability[] };
  files: Array<{ path: string; content: string }>;
  warnings: string[];
};

export async function fetchPackageWorkflowExport(input: {
  workflowDefinitionIds?: number[];
  workflowKeys?: Array<{ scopeKey?: string; key: string }>;
}): Promise<PackageWorkflowExportResult> {
  const { data, response } = await apiPost<{
    success?: boolean;
    error?: string;
    details?: string[];
    capabilities?: { workflows?: PackageWorkflowCapability[] };
    files?: Array<{ path: string; content: string }>;
    warnings?: string[];
  }>('/api/packages/builder/workflow-export', input);

  if (!response.ok || !data?.success) {
    const details = Array.isArray(data?.details) ? data.details.join(' · ') : '';
    throw new Error(
      [data?.error || 'Failed to export workflows for the package.', details].filter(Boolean).join(' '),
    );
  }

  const workflows = Array.isArray(data.capabilities?.workflows) ? data.capabilities.workflows : [];
  const files = Array.isArray(data.files)
    ? data.files.filter((file): file is { path: string; content: string } => (
      !!file
      && typeof file.path === 'string'
      && file.path.trim().length > 0
      && typeof file.content === 'string'
    ))
    : [];

  return {
    capabilities: { workflows },
    files,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}
