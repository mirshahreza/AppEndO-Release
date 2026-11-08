import { apiFetch, apiGet } from '../../../shared/api/client';
import type { PackageWorkspaceAssetSummary } from '../../../shared/api/queries/packages';

export async function fetchPackageWorkspaceAssets(): Promise<{
  assets: PackageWorkspaceAssetSummary[];
  rootPath: string;
  urlPrefix: string;
}> {
  const { data, response } = await apiGet<{
    success?: boolean;
    error?: string;
    assets?: PackageWorkspaceAssetSummary[];
    rootPath?: string;
    urlPrefix?: string;
  }>('/api/packages/builder/workspace-assets');

  if (!response.ok || !data?.success || !Array.isArray(data.assets)) {
    throw new Error(data?.error || 'Failed to load workspace assets.');
  }

  return {
    assets: data.assets,
    rootPath: data.rootPath?.trim() || 'workspace/assets',
    urlPrefix: data.urlPrefix?.trim() || '/assets/workspace',
  };
}

export async function fetchPackageWorkspaceAssetBytes(workspacePath: string): Promise<Uint8Array> {
  const response = await apiFetch(
    `/api/packages/builder/workspace-assets/content?path=${encodeURIComponent(workspacePath)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to read workspace asset "${workspacePath}".`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function fetchPackagePlatformFontBytes(relativePath: string): Promise<Uint8Array> {
  const response = await apiFetch(
    `/api/packages/builder/platform-fonts/content?path=${encodeURIComponent(relativePath)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to read platform font "${relativePath}".`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function uploadPackageWorkspaceAsset(file: File): Promise<PackageWorkspaceAssetSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/api/packages/builder/workspace-assets/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json() as {
    success?: boolean;
    error?: string;
    asset?: PackageWorkspaceAssetSummary;
  };

  if (!response.ok || !data?.success || !data.asset) {
    throw new Error(data?.error || 'Failed to upload workspace asset.');
  }

  return data.asset;
}

export async function deletePackageWorkspaceAsset(workspacePath: string): Promise<void> {
  const response = await apiFetch(
    `/api/packages/builder/workspace-assets?path=${encodeURIComponent(workspacePath)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || `Failed to delete workspace asset "${workspacePath}".`);
  }
}

