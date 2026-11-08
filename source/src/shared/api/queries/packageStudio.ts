import type { PackageFunctionExportRequest } from '../contracts/package/functionExport';
import type {
  PackageBundleDownloadPlan,
  PackageImportPreview,
  PackageInstallPreview,
  PackageInstallPreviewRequest,
} from '../contracts/package/artifactPreview';
import { apiRequest } from '../client';

export async function previewPackageFunctionExport(
  payload: PackageFunctionExportRequest,
): Promise<{
  preview: {
    packageId: string;
    version: string;
    functionCount: number;
    apis: Array<{
      id: string;
      method: string;
      path: string;
      entry: string;
      metaEntry: string;
      auth: 'public' | 'authenticated' | 'admin';
    }>;
    warnings: string[];
  };
  manifest: Record<string, unknown>;
}> {
  const response = await fetch('/api/package/export/functions/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success) {
    const details = Array.isArray(json?.details) ? json.details.join(' ') : '';
    throw new Error(json?.error || details || `Export preview failed (HTTP ${response.status}).`);
  }

  return {
    preview: json.preview,
    manifest: json.manifest,
  };
}

export async function downloadPackageFunctionExport(
  payload: PackageFunctionExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch('/api/package/export/functions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Export download failed (HTTP ${response.status}).`;
    try {
      const json = await response.json();
      if (json?.error) {
        message = String(json.error);
      }
      if (Array.isArray(json?.details) && json.details.length > 0) {
        message = `${message} ${json.details.join(' ')}`;
      }
    } catch {
      // Keep generic message when body is not JSON.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] || `${payload.packageId}-${payload.version || '0.1.0'}.zip`;
  const blob = await response.blob();
  return { blob, fileName };
}

export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function previewPackageZipImport(
  file: File,
  options?: {
    targetDataSource?: string;
    overridePolicy?: PackageInstallPreviewRequest['overridePolicy'];
  },
): Promise<PackageImportPreview> {
  const body = new FormData();
  body.append('file', file);
  if (options?.targetDataSource) {
    body.append('targetDataSource', options.targetDataSource);
  }
  if (options?.overridePolicy) {
    body.append('overridePolicy', JSON.stringify(options.overridePolicy));
  }

  const { data, response } = await apiRequest<{ success?: boolean; preview?: PackageImportPreview; error?: string }>(
    '/api/package/import/preview',
    { method: 'POST', body },
  );

  if (!response.ok || !data.success || !data.preview) {
    throw new Error(data.error || `Import preview failed (HTTP ${response.status}).`);
  }

  return data.preview;
}

export async function previewPackageInstall(
  request: PackageInstallPreviewRequest,
): Promise<PackageInstallPreview> {
  const { data, response } = await apiRequest<{ success?: boolean; preview?: PackageInstallPreview; error?: string }>(
    '/api/package/install/preview',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok || !data.success || !data.preview) {
    throw new Error(data.error || `Install preview failed (HTTP ${response.status}).`);
  }

  return data.preview;
}

export async function fetchPackageBundleDownloadPlan(input: {
  packageId?: string;
  packageVersion?: string;
}): Promise<PackageBundleDownloadPlan> {
  const { data, response } = await apiRequest<{ success?: boolean; plan?: PackageBundleDownloadPlan; error?: string }>(
    '/api/package/bundle/download-plan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok || !data.success || !data.plan) {
    throw new Error(data.error || `Bundle download plan failed (HTTP ${response.status}).`);
  }

  return data.plan;
}

export async function downloadArtifactFromUrl(downloadUrl: string, fileName: string): Promise<void> {
  const response = await fetch(downloadUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Download failed for ${fileName} (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  triggerBrowserDownload(blob, fileName);
}

export async function triggerPackageBundleDownload(input: {
  packageId?: string;
  packageVersion?: string;
}): Promise<string[]> {
  const plan = await fetchPackageBundleDownloadPlan(input);
  const downloaded: string[] = [];
  for (const item of plan.items) {
    await downloadArtifactFromUrl(item.downloadUrl, item.fileName);
    downloaded.push(item.fileName);
  }
  return downloaded;
}
