import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildPackageRows } from '../contracts/package-manifest/mappers';
import type {
  DependencyGraph,
  InstallPackagePayload,
  InstallPackageResult,
  PackageDetail,
  PackageListApiItem,
  PackageRow,
} from '../contracts/package-manifest/types';
import type { VerticalAppDeploymentPreview } from '../contracts/package-manifest/verticalApp';
import type {
  PackageRepackDriftPreview,
  PackageRepackItemDiff,
  PackageRepackPayload,
  PackageRepackResult,
} from '../contracts/package/repack';
import type { PackageUninstallRemoveScope } from '../contracts/package/uninstall';
import { apiDelete, apiFetch, apiGet, apiPost, apiRequest, type ApiListResponse, type ApiMutationResponse } from '../client';
import { serverFunctionsQueryKeys } from './server-functions';
import { slotsQueryKeys } from './slots';
import { componentDesignerQueryKeys } from './component-designer';
import { platformQueryKeys, refetchPlatformBootQueries } from './platform';
import { invalidatePlatformQueries } from './platformCrud';

const invalidatePackageRuntimeQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: packagesQueryKeys.grid() });
  void queryClient.invalidateQueries({ queryKey: serverFunctionsQueryKeys.catalog() });
  void queryClient.invalidateQueries({ queryKey: slotsQueryKeys.catalog() });
  void queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.drafts() });
  // CD-I02: Invalidate palette catalog so reusable-components category refreshes
  // without a full page reload after marketplace package install.
  void queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.paletteCatalog() });
  invalidatePlatformQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: platformQueryKeys.navigations() });
  await queryClient.refetchQueries({ queryKey: slotsQueryKeys.catalog() });
  await queryClient.refetchQueries({ queryKey: componentDesignerQueryKeys.drafts() });
  await refetchPlatformBootQueries(queryClient);
  // Eagerly refetch palette catalog so the toolbox updates immediately
  await queryClient.refetchQueries({ queryKey: componentDesignerQueryKeys.paletteCatalog() });
};


type PackagesListResponse = ApiListResponse & {
  items?: PackageListApiItem[];
};

type PackageDetailResponse = ApiMutationResponse & {
  package?: PackageDetail;
};

type DependencyGraphResponse = ApiMutationResponse & {
  graph?: DependencyGraph;
};

type FeatureFlagsResponse = ApiMutationResponse & {
  flags?: {
    builderEnabled?: boolean;
  };
};

type UploadPackageResponse = ApiMutationResponse & {
  packageId?: string;
  version?: string;
  details?: string[];
};

type DeploymentPreviewResponse = ApiMutationResponse & {
  preview?: VerticalAppDeploymentPreview;
};

type RepackDriftResponse = ApiMutationResponse & {
  drift?: PackageRepackDriftPreview;
};

type RepackDiffResponse = ApiMutationResponse & {
  diff?: PackageRepackItemDiff;
};

type RepackResponse = ApiMutationResponse & {
  repack?: PackageRepackResult;
  deploymentStatus?: 'none' | 'pending' | 'applied';
};

export type PackageWorkspaceAssetSummary = {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
};

type InstallPackageResponse = ApiMutationResponse & InstallPackageResult;

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

const packagesQueryKeys = {
  all: ['packages'] as const,
  grid: () => [...packagesQueryKeys.all, 'grid'] as const,
  featureFlags: () => [...packagesQueryKeys.all, 'feature-flags'] as const,
  detail: (packageId: string, version?: string) => (
    version
      ? [...packagesQueryKeys.all, 'detail', packageId, version] as const
      : [...packagesQueryKeys.all, 'detail', packageId] as const
  ),
};

export async function fetchPackageDependencyGraph(): Promise<DependencyGraph> {
  try {
    const { data, response } = await apiGet<DependencyGraphResponse>('/api/packages/dependency-graph');
    if (response.ok && data.graph) {
      return data.graph;
    }
  } catch {
    // Keep package list available even if dependency graph cannot be resolved.
  }
  return { edges: [], issues: [] };
}

export async function fetchPackageDetail(
  packageId: string,
  version?: string,
  signal?: AbortSignal,
): Promise<PackageDetail | null> {
  const query = version?.trim() ? `?version=${encodeURIComponent(version.trim())}` : '';
  const { data, response } = await apiRequest<PackageDetailResponse>(
    `/api/packages/${encodeURIComponent(packageId)}${query}`,
    signal ? { signal } : {},
  );
  if (!response.ok || !data.package) {
    return null;
  }
  return data.package;
}

export async function fetchPackagesGridData(): Promise<PackageRow[]> {
  const { data: pluginsJson, response: pluginsRes } = await apiGet<PackagesListResponse>('/api/packages');
  if (!pluginsRes.ok) {
    throw new Error(getErrorMessage(pluginsJson, 'Failed to load packages.'));
  }

  const items: PackageListApiItem[] = Array.isArray(pluginsJson?.items) ? pluginsJson.items : [];
  const graph = await fetchPackageDependencyGraph();
  return buildPackageRows(items, graph);
}

export async function fetchPackageFeatureFlags(): Promise<{
  builderEnabled: boolean;
}> {
  try {
    const { data, response } = await apiGet<FeatureFlagsResponse>('/api/packages/feature-flags');
    if (!response.ok) {
      return { builderEnabled: true };
    }
    return {
      builderEnabled: typeof data?.flags?.builderEnabled === 'boolean'
        ? data.flags.builderEnabled
        : true,
    };
  } catch {
    // Ignore feature-flag read failures and keep default behavior.
  }
  return { builderEnabled: true };
}

export async function uploadPackageZip(
  file: File,
  options?: { createdBy?: string | null },
): Promise<{ packageId: string; version: string }> {
  const body = new FormData();
  body.append('file', file);
  if (options?.createdBy?.trim()) {
    body.append('createdBy', options.createdBy.trim());
  }

  const { data, response } = await apiRequest<UploadPackageResponse>('/api/packages/upload', {
    method: 'POST',
    body,
  });

  if (!response.ok || !data.success) {
    const details: string[] = Array.isArray(data.details) ? data.details : [];
    const error = new Error(getErrorMessage(data, 'Upload failed.'));
    (error as Error & { details?: string[] }).details = details;
    throw error;
  }

  return {
    packageId: String(data.packageId ?? ''),
    version: String(data.version ?? ''),
  };
}

export async function downloadPackageArtifact(packageId: string, version: string): Promise<Blob> {
  const downloadUrl = `/api/packages/${encodeURIComponent(packageId)}/download?version=${encodeURIComponent(version)}`;
  const response = await apiFetch(downloadUrl, { method: 'GET' });
  if (!response.ok) {
    const raw = await response.text();
    let json: { error?: string } = {};
    try {
      json = raw ? JSON.parse(raw) as { error?: string } : {};
    } catch {
      json = {};
    }
    throw new Error(json.error || 'Download failed.');
  }
  return response.blob();
}

export async function installPackage(packageId: string, payload: InstallPackagePayload): Promise<InstallPackageResult> {
  const { data, response } = await apiPost<InstallPackageResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/install`,
    payload,
  );
  if (!response.ok || !data.success) {
    const details: string[] = Array.isArray((data as UploadPackageResponse).details) ? (data as UploadPackageResponse).details! : [];
    const error = new Error(getErrorMessage(data, 'Install failed.'));
    (error as Error & { details?: string[] }).details = details;
    throw error;
  }
  return {
    deploymentStatus: data.deploymentStatus,
    pluginKind: data.pluginKind,
  };
}

export async function fetchPackageDeploymentPreview(packageId: string): Promise<VerticalAppDeploymentPreview> {
  const { data, response } = await apiGet<DeploymentPreviewResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/deployment/preview`,
  );
  if (!response.ok || !data.preview) {
    throw new Error(getErrorMessage(data, 'Failed to load deployment preview.'));
  }
  return data.preview;
}

export async function applyPackageDeployment(packageId: string): Promise<void> {
  const { data, response } = await apiPost<ApiMutationResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/deployment/apply`,
    {},
  );
  if (!response.ok || !data.success) {
    const details: string[] = Array.isArray((data as UploadPackageResponse).details) ? (data as UploadPackageResponse).details! : [];
    const error = new Error(getErrorMessage(data, 'Failed to apply deployment.'));
    (error as Error & { details?: string[] }).details = details;
    throw error;
  }
}

export async function uninstallPackage(
  packageId: string,
  removeScope: PackageUninstallRemoveScope,
): Promise<void> {
  const { data, response } = await apiPost<ApiMutationResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/uninstall`,
    { removeScope },
  );
  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, 'Uninstall failed.'));
  }
}

export async function deletePackage(packageId: string, version: string): Promise<void> {
  const query = `?version=${encodeURIComponent(version)}`;
  const { data, response } = await apiDelete<ApiMutationResponse>(
    `/api/packages/${encodeURIComponent(packageId)}${query}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, 'Delete failed.'));
  }
}

export async function reinstallPackage(
  packageId: string,
  payload?: {
    version?: string;
    targetDataSource?: string;
    overridePolicy?: InstallPackagePayload['overridePolicy'];
    installOptionalRecords?: boolean;
  },
): Promise<InstallPackageResult> {
  const { data, response } = await apiPost<InstallPackageResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/reinstall`,
    payload ?? {},
  );
  if (!response.ok || !data.success) {
    const details: string[] = Array.isArray((data as UploadPackageResponse).details) ? (data as UploadPackageResponse).details! : [];
    const error = new Error(getErrorMessage(data, 'Reinstall failed.'));
    (error as Error & { details?: string[] }).details = details;
    throw error;
  }
  return {
    deploymentStatus: data.deploymentStatus,
    pluginKind: data.pluginKind,
  };
}

export async function fetchPackageRepackDrift(packageId: string): Promise<PackageRepackDriftPreview> {
  const { data, response } = await apiGet<RepackDriftResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/repack/drift`,
  );
  if (!response.ok || !data.drift) {
    throw new Error(getErrorMessage(data, 'Failed to load repack drift.'));
  }
  return data.drift;
}

export async function fetchPackageRepackDiff(packageId: string, itemId: string): Promise<PackageRepackItemDiff> {
  const query = new URLSearchParams({ itemId });
  const { data, response } = await apiGet<RepackDiffResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/repack/diff?${query.toString()}`,
  );
  if (!response.ok || !data.diff) {
    throw new Error(getErrorMessage(data, 'Failed to load repack diff.'));
  }
  return data.diff;
}

export async function revertPackageRepackItem(packageId: string, itemId: string): Promise<void> {
  const { data, response } = await apiPost<ApiMutationResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/repack/revert`,
    { itemId },
  );
  if (!response.ok || !data.success) {
    throw new Error(getErrorMessage(data, 'Failed to revert item.'));
  }
}

export async function repackPackage(packageId: string, payload: PackageRepackPayload): Promise<PackageRepackResult> {
  const { data, response } = await apiPost<RepackResponse>(
    `/api/packages/${encodeURIComponent(packageId)}/repack`,
    payload,
  );
  if (!response.ok || !data.success || !data.repack) {
    const details: string[] = Array.isArray((data as UploadPackageResponse).details) ? (data as UploadPackageResponse).details! : [];
    const error = new Error(getErrorMessage(data, 'Repack failed.'));
    (error as Error & { details?: string[] }).details = details;
    throw error;
  }
  return data.repack;
}

export function usePackagesGridQuery() {
  return useQuery({
    queryKey: packagesQueryKeys.grid(),
    queryFn: fetchPackagesGridData,
  });
}

export function usePackageFeatureFlagsQuery() {
  return useQuery({
    queryKey: packagesQueryKeys.featureFlags(),
    queryFn: fetchPackageFeatureFlags,
  });
}

function usePackageDetailQuery(packageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: packagesQueryKeys.detail(packageId ?? ''),
    queryFn: () => fetchPackageDetail(packageId as string),
    enabled: Boolean(packageId) && enabled,
  });
}

function useUploadPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPackageZip(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packagesQueryKeys.grid() });
    },
  });
}

export function useInstallPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, payload }: { packageId: string; payload: InstallPackagePayload }) =>
      installPackage(packageId, payload),
    onSettled: async () => {
      await invalidatePackageRuntimeQueries(queryClient);
    },
  });
}

export function useApplyPackageDeploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => applyPackageDeployment(packageId),
    onSuccess: async () => {
      await invalidatePackageRuntimeQueries(queryClient);
    },
  });
}

export function useUninstallPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, removeScope }: { packageId: string; removeScope: PackageUninstallRemoveScope }) =>
      uninstallPackage(packageId, removeScope),
    onSuccess: async () => {
      await invalidatePackageRuntimeQueries(queryClient);
    },
  });
}

export function useDeletePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, version }: { packageId: string; version: string }) =>
      deletePackage(packageId, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packagesQueryKeys.grid() });
    },
  });
}

export function useReinstallPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      packageId,
      payload,
    }: {
      packageId: string;
      payload?: {
        version?: string;
        targetDataSource?: string;
        overridePolicy?: InstallPackagePayload['overridePolicy'];
        installOptionalRecords?: boolean;
      };
    }) => reinstallPackage(packageId, payload),
    onSettled: async () => {
      await invalidatePackageRuntimeQueries(queryClient);
    },
  });
}

export function useRepackPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, payload }: { packageId: string; payload: PackageRepackPayload }) =>
      repackPackage(packageId, payload),
    onSuccess: async (_data, { packageId }) => {
      await invalidatePackageRuntimeQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: packagesQueryKeys.detail(packageId) });
    },
  });
}
