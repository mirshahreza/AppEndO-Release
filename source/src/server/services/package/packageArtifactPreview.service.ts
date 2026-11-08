import crypto from 'crypto';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  isVerticalAppManifest,
  validateManifest,
  normalizeArtifactManifestForValidation,
  type AnyPackageManifest,
} from '../../../core/packages/PackageManifestValidator';
import { readPackageIndex } from '../../../core/packages/PackageFileStore';
import { conflictMessages } from '../../domain/package-domain/conflictDetection';
import { parseManifestFile, resolveVersionForInstall } from '../../domain/package-domain/manifestRepository';
import type { ConflictItem, InstallPackageOptions } from '../../domain/package-domain/types';
import { getEffectivePolicy } from '../../domain/package-domain/registryBuilder';
import { createPackageDependencyService } from '../package-runtime/packageDependency.service';
import { createPackageRegistryService } from '../package-runtime/packageRegistry.service';
import { manifestForRegistry } from '../package-runtime/packageVerticalRuntime.service';
import type {
  PackageBundleDownloadPlan,
  PackageImportPreview,
  PackageInstallPreview,
  PackageInstallPreviewRequest,
} from '../../../shared/api/contracts/package/artifactPreview';
import {
  packageArtifactSizeLimitError,
} from '../../../core/packages/packageArtifactLimits';

function hasUnsafeZipEntryPath(entryName: string): boolean {
  if (!entryName || entryName.includes('\0')) return true;

  const normalizedPosix = path.posix.normalize(entryName.replace(/\\/g, '/'));
  if (normalizedPosix === '..' || normalizedPosix.startsWith('../')) return true;
  if (path.posix.isAbsolute(normalizedPosix)) return true;
  if (/^[a-zA-Z]:\//.test(normalizedPosix)) return true;

  const segments = normalizedPosix.split('/').filter(Boolean);
  return segments.includes('..');
}

function mapConflictItems(
  conflicts: ConflictItem[],
  denied: ConflictItem[],
): PackageInstallPreview['conflicts'] {
  const deniedKeys = new Set(denied.map((item) => `${item.objectType}::${item.conflictKey}`));
  return conflicts.map((item) => ({
    objectType: item.objectType,
    conflictKey: item.conflictKey,
    ownerPackageId: item.ownerPackageId,
    blocked: deniedKeys.has(`${item.objectType}::${item.conflictKey}`),
  }));
}

function buildPluginInstallPreview(
  packageId: string,
  version: string,
  manifest: AnyPackageManifest,
  options: InstallPackageOptions = {},
): PackageInstallPreview {
  const registry = createPackageRegistryService();
  const dependency = createPackageDependencyService();
  const registryManifest = manifestForRegistry(manifest);
  const targetDataSource = options.targetDataSource?.trim() || 'default';

  const dependencyFailure = dependency.checkInstallDependencies(packageId, registryManifest);
  const candidate = registry.buildCandidateRegistry(
    packageId,
    registryManifest,
    version,
    targetDataSource,
  );
  const conflicts = registry.collectConflictsFromStorage(packageId, candidate);
  const { denied, policy } = registry.evaluateConflicts(
    conflicts,
    registryManifest,
    options.overridePolicy,
  );

  const installBlocked = denied.length > 0 || Boolean(dependencyFailure);
  let blockReason: string | undefined;
  if (dependencyFailure) {
    blockReason = dependencyFailure.error;
  } else if (denied.length > 0) {
    blockReason = 'Install blocked due to object conflicts.';
  }

  return {
    schema: 'package-install-preview',
    schemaVersion: '1.0.0',
    artifactType: 'package',
    packageId,
    version,
    displayName: manifest.name,
    pluginKind: isVerticalAppManifest(manifest) ? 'vertical-app' : 'extension',
    manifest: manifest as unknown as Record<string, unknown>,
    conflicts: mapConflictItems(conflicts, denied),
    dependencyIssues: dependencyFailure?.details ?? [],
    effectivePolicy: policy,
    installBlocked,
    blockReason,
  };
}

export function previewPluginInstall(
  request: PackageInstallPreviewRequest,
): { ok: true; preview: PackageInstallPreview } | { ok: false; error: string; details?: string[] } {
  const packageId = request.packageId?.trim();
  if (!packageId) {
    return { ok: false, error: 'packageId is required.' };
  }

  const selected = resolveVersionForInstall(packageId, request.version);
  if (!selected) {
    return { ok: false, error: `Package "${packageId}" was not found.` };
  }

  const manifest = parseManifestFile(selected.manifestPath);
  if (!manifest) {
    return { ok: false, error: 'Manifest could not be loaded for preview.' };
  }

  return {
    ok: true,
    preview: buildPluginInstallPreview(packageId, selected.version, manifest, {
      version: selected.version,
      targetDataSource: request.targetDataSource,
      overridePolicy: request.overridePolicy,
    }),
  };
}

function readPackageManifestFromZip(zip: AdmZip):
  | { ok: true; manifest: AnyPackageManifest }
  | { ok: false; error: string; details?: string[] } {
  let manifestText: string;
  try {
    manifestText = zip.readAsText('package.json');
  } catch {
    return { ok: false, error: 'ZIP does not contain package.json in its root.' };
  }

  if (!manifestText?.trim()) {
    return { ok: false, error: 'ZIP does not contain package.json in its root.' };
  }

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestText);
  } catch {
    return { ok: false, error: 'package.json is not valid JSON.' };
  }

  const validation = validateManifest(normalizeArtifactManifestForValidation(rawManifest));
  if (!validation.valid || !validation.manifest) {
    return { ok: false, error: 'package.json validation failed.', details: validation.errors };
  }

  return { ok: true, manifest: validation.manifest };
}

function packageVersionExists(packageId: string, version: string): boolean {
  const index = readPackageIndex();
  const entry = index.packages.find((item) => item.packageId === packageId);
  return Boolean(entry?.versions.some((item) => item.version === version));
}

export function previewZipImport(
  buffer: Buffer,
  originalName: string,
  options: InstallPackageOptions = {},
): PackageImportPreview {
  const artifactSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const base: PackageImportPreview = {
    schema: 'package-import-preview',
    schemaVersion: '1.0.0',
    artifactType: 'unknown',
    fileName: originalName,
    artifactSha256,
    validationErrors: [],
    duplicateVersion: false,
  };

  if (!originalName.toLowerCase().endsWith('.zip')) {
    return {
      ...base,
      validationErrors: ['File must have .zip extension.'],
    };
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return {
      ...base,
      validationErrors: ['Could not parse ZIP file. The file may be corrupt.'],
    };
  }

  for (const entry of zip.getEntries()) {
    if (hasUnsafeZipEntryPath(entry.entryName)) {
      return {
        ...base,
        validationErrors: [`ZIP contains unsafe entry path: "${entry.entryName}".`],
      };
    }
  }

  if (zip.getEntry('package.json') == null) {
    return {
      ...base,
      validationErrors: ['ZIP must contain package.json in its root.'],
    };
  }

  const sizeError = packageArtifactSizeLimitError(buffer.length);
  if (sizeError) {
    return {
      ...base,
      artifactType: 'package',
      validationErrors: [sizeError],
    };
  }

  const parsed = readPackageManifestFromZip(zip);
  if (!parsed.ok) {
    return {
      ...base,
      artifactType: 'package',
      validationErrors: parsed.details?.length
        ? parsed.details
        : [parsed.error],
    };
  }

  const { id: packageId, version, name } = parsed.manifest;
  const duplicateVersion = packageVersionExists(packageId, version);

  return {
    ...base,
    artifactType: 'package',
    packageId,
    version,
    displayName: name,
    manifest: parsed.manifest as unknown as Record<string, unknown>,
    duplicateVersion,
    validationErrors: duplicateVersion
      ? [`Package "${packageId}" version "${version}" already exists on this node.`]
      : [],
    installPreview: buildPluginInstallPreview(packageId, version, parsed.manifest, options),
  };
}

export function buildBundleDownloadPlan(input: {
  packageId?: string;
  packageVersion?: string;
}): { ok: true; plan: PackageBundleDownloadPlan } | { ok: false; error: string } {
  const packageId = input.packageId?.trim();
  if (!packageId) {
    return { ok: false, error: 'packageId is required.' };
  }

  const selected = resolveVersionForInstall(packageId, input.packageVersion);
  if (!selected) {
    return { ok: false, error: `Package "${packageId}" was not found.` };
  }

  return {
    ok: true,
    plan: {
      schema: 'package-bundle-download',
      schemaVersion: '1.0.0',
      items: [{
        artifactType: 'package',
        id: packageId,
        version: selected.version,
        fileName: `${packageId}-${selected.version}.zip`,
        downloadUrl: `/api/packages/${encodeURIComponent(packageId)}/download?version=${encodeURIComponent(selected.version)}`,
      }],
    },
  };
}

export function summarizeInstallPreviewConflicts(preview: PackageInstallPreview): string[] {
  if (preview.conflicts.length === 0) return [];
  const denied = preview.conflicts.filter((item) => item.blocked);
  if (denied.length === 0) return [];
  return conflictMessages(denied.map((item) => ({
    objectType: item.objectType,
    conflictKey: item.conflictKey,
    ownerPackageId: item.ownerPackageId,
  })));
}

export function getEffectivePolicyForManifest(
  manifest: AnyPackageManifest,
  overridePolicy?: InstallPackageOptions['overridePolicy'],
): Record<string, 'allow' | 'deny'> {
  return getEffectivePolicy(manifestForRegistry(manifest), overridePolicy);
}
