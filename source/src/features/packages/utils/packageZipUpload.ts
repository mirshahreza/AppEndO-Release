import type {
  PackageImportPreview,
  PackageInstallPreviewRequest,
} from '../../../shared/api/contracts/package/artifactPreview';
import { previewPackageZipImport } from '../../../shared/api/queries/packageStudio';
import { uploadPackageZip } from '../../../shared/api/queries/packages';

const DEFAULT_OVERRIDE_POLICY: Required<PackageInstallPreviewRequest['overridePolicy']> = {
  apis: 'deny',
  ui_components: 'deny',
  db_objects: 'deny',
  mcp_servers: 'deny',
};

export function getPackageZipUploadBlockReason(preview: PackageImportPreview): string | null {
  if (preview.validationErrors.length > 0) {
    return preview.validationErrors.join(' ');
  }
  if (preview.duplicateVersion) {
    return 'This version is already registered on the node. Upload a new version or remove the existing artifact first.';
  }
  if (preview.artifactType === 'package' && preview.installPreview?.installBlocked) {
    return preview.installPreview.blockReason || 'Upload blocked by install policy.';
  }
  if (preview.artifactType !== 'package') {
    return `Unsupported artifact type: ${preview.artifactType}`;
  }
  return null;
}

export function canUploadPackageZipPreview(preview: PackageImportPreview): boolean {
  return getPackageZipUploadBlockReason(preview) === null;
}

export async function uploadPackageZipWithValidation(
  file: File,
  options?: { createdBy?: string | null },
): Promise<string> {
  const preview = await previewPackageZipImport(file, {
    targetDataSource: 'default',
    overridePolicy: DEFAULT_OVERRIDE_POLICY,
  });

  const blockReason = getPackageZipUploadBlockReason(preview);
  if (blockReason) {
    throw new Error(blockReason);
  }

  const result = await uploadPackageZip(file, {
    createdBy: options?.createdBy?.trim() || undefined,
  });
  const label = preview.displayName?.trim() || 'Package';
  return `${label} v${result.version} uploaded.`;
}

export function pickPackageZipFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    input.click();
  });
}
