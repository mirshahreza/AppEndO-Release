import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { validateManifest } from '../../../core/packages/PackageManifestValidator';
import {
  allocateUniquePackageApiRouteSuffix,
  buildManagedFunctionApiRouteSuffix,
  buildManagedFunctionPackageApiMapping,
  buildPackageApiSlug,
  buildPluginApiMetaSidecar,
  validatePluginApiMetaSidecar,
} from '../../../core/packages/packageApiMetaSidecar';
import { findManagedFunctionByIdFromStore } from '../../../core/functions/FunctionFileStore';
import type {
  PackageFunctionExportPreview,
  PackageFunctionExportRequest,
} from '../../../shared/api/contracts/package/functionExport';

const PLUGIN_ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const MAX_FUNCTION_EXPORT_COUNT = 100;

type ExportZipEntry = {
  path: string;
  content: Buffer;
};

export type PackageFunctionExportBuildResult =
  | {
      ok: true;
      buffer: Buffer;
      fileName: string;
      manifest: PackageManifest;
      preview: PackageFunctionExportPreview;
    }
  | { ok: false; error: string; details?: string[] };

function computeArtifactHash(entries: ExportZipEntry[]): string {
  const payload = entries
    .filter((entry) => entry.path !== 'package.json')
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}\0${entry.content.toString('base64')}`)
    .join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function validateExportRequest(input: PackageFunctionExportRequest): string[] {
  const errors: string[] = [];
  const packageId = input.packageId?.trim() ?? '';
  const functionIds = Array.isArray(input.functionIds)
    ? input.functionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (!PLUGIN_ID_RE.test(packageId)) {
    errors.push('packageId must match ^[a-z][a-z0-9-]{2,63}$.');
  }
  if (functionIds.length === 0) {
    errors.push('functionIds must include at least one managed function id.');
  }
  if (functionIds.length > MAX_FUNCTION_EXPORT_COUNT) {
    errors.push(`functionIds cannot exceed ${MAX_FUNCTION_EXPORT_COUNT} items.`);
  }
  if (input.kind && input.kind !== 'extension') {
    errors.push('Only kind "extension" is supported for function export in PKG-2.');
  }

  const version = input.version?.trim() || '0.1.0';
  if (!SEMVER_RE.test(version)) {
    errors.push('version must be SemVer (x.y.z).');
  }

  return errors;
}

export function previewPackageFunctionExport(
  input: PackageFunctionExportRequest,
): PackageFunctionExportBuildResult | { ok: false; error: string; details?: string[] } {
  const requestErrors = validateExportRequest(input);
  if (requestErrors.length > 0) {
    return { ok: false, error: 'Export request validation failed.', details: requestErrors };
  }

  const built = buildPackageFunctionExportEntries(input);
  if (!built.ok) {
    return built;
  }

  return {
    ok: true,
    buffer: Buffer.alloc(0),
    fileName: `${input.packageId.trim()}-${built.version}.zip`,
    manifest: built.manifest,
    preview: built.preview,
  };
}

function buildPackageFunctionExportEntries(input: PackageFunctionExportRequest):
  | {
      ok: true;
      manifest: PackageManifest;
      zipEntries: ExportZipEntry[];
      preview: PackageFunctionExportPreview;
      version: string;
    }
  | { ok: false; error: string; details?: string[] } {
  const packageId = input.packageId.trim();
  const version = input.version?.trim() || '0.1.0';
  const functionIds = [...new Set(input.functionIds.map((id) => String(id).trim()).filter(Boolean))];
  const warnings: string[] = [];
  const details: string[] = [];
  const usedSlugs = new Set<string>();
  const apis: PackageManifest['capabilities']['apis'] = [];
  const zipEntries: ExportZipEntry[] = [];
  const previewApis: PackageFunctionExportPreview['apis'] = [];

  for (const functionId of functionIds) {
    const fn = findManagedFunctionByIdFromStore(functionId);
    if (!fn) {
      details.push(`Managed function "${functionId}" was not found.`);
      continue;
    }

    const apiSlug = allocateUniquePackageApiRouteSuffix(
      buildPackageApiSlug({
        folder: fn.folder,
        name: fn.name,
        path: fn.path,
      }),
      usedSlugs,
    );
    const mapping = buildManagedFunctionPackageApiMapping({
      packageId,
      folder: fn.folder,
      name: fn.name,
      method: fn.method,
      path: fn.path,
      apiSlug,
    });
    const { entry, metaEntry, manifestPath: apiPath, apiId } = mapping;
    const sidecar = buildPluginApiMetaSidecar(fn);
    const sidecarValidation = validatePluginApiMetaSidecar(sidecar);
    if (!sidecarValidation.valid) {
      details.push(`Function "${functionId}" meta sidecar invalid: ${sidecarValidation.errors.join('; ')}`);
      continue;
    }

    const api = {
      id: apiId,
      method: fn.method as PackageManifest['capabilities']['apis'][number]['method'],
      path: apiPath,
      entry,
      timeoutMs: sidecar.timeoutMs,
      auth: sidecar.auth,
    };

    apis.push(api);
    previewApis.push({
      id: api.id,
      method: api.method,
      path: api.path,
      entry: api.entry,
      metaEntry,
      auth: api.auth ?? 'admin',
    });

    zipEntries.push({
      path: entry,
      content: Buffer.from(`${fn.code.trim()}\n`, 'utf8'),
    });
    zipEntries.push({
      path: metaEntry,
      content: Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`, 'utf8'),
    });
  }

  if (apis.length === 0) {
    return {
      ok: false,
      error: 'No exportable managed functions were found for the requested ids.',
      details: details.length > 0 ? details : undefined,
    };
  }

  if (details.length > 0) {
    warnings.push(...details);
  }

  const manifestWithoutHash: Omit<PackageManifest, 'integrity'> & {
    integrity: { algorithm: 'sha256'; artifactHash: string };
  } = {
    $schemaVersion: '1.0',
    id: packageId,
    name: input.name?.trim() || packageId,
    version,
    description: input.description?.trim() || undefined,
    createdBy: input.createdBy?.trim() || undefined,
    requiredAppVersion: input.requiredAppVersion?.trim() || '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis,
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
    },
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };

  const artifactHash = computeArtifactHash([
    ...zipEntries,
    { path: 'package.json', content: Buffer.from(`${JSON.stringify(manifestWithoutHash, null, 2)}\n`, 'utf8') },
  ]);
  const manifest: PackageManifest = {
    ...manifestWithoutHash,
    integrity: {
      algorithm: 'sha256',
      artifactHash,
    },
  };

  const manifestValidation = validateManifest(manifest);
  if (!manifestValidation.valid) {
    return {
      ok: false,
      error: 'Generated package manifest failed validation.',
      details: manifestValidation.errors,
    };
  }

  zipEntries.push({
    path: 'package.json',
    content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  });

  return {
    ok: true,
    manifest,
    zipEntries,
    preview: {
      packageId,
      version,
      functionCount: apis.length,
      apis: previewApis,
      warnings,
    },
    version,
  };
}

export function buildPackageFunctionExport(
  input: PackageFunctionExportRequest,
): PackageFunctionExportBuildResult {
  const requestErrors = validateExportRequest(input);
  if (requestErrors.length > 0) {
    return { ok: false, error: 'Export request validation failed.', details: requestErrors };
  }

  const built = buildPackageFunctionExportEntries(input);
  if (!built.ok) {
    return built;
  }

  const zip = new AdmZip();
  for (const entry of built.zipEntries) {
    zip.addFile(entry.path, entry.content);
  }

  return {
    ok: true,
    buffer: zip.toBuffer(),
    fileName: `${built.preview.packageId}-${built.version}.zip`,
    manifest: built.manifest,
    preview: built.preview,
  };
}

export function buildManagedFunctionExportBundle(functionId: string):
  | {
      ok: true;
      slug: string;
      entry: string;
      metaEntry: string;
      code: string;
      metaJson: string;
      auth: 'public' | 'authenticated' | 'admin';
      timeoutMs: number;
      method: string;
      path: string;
      name: string;
    }
  | { ok: false; error: string } {
  const fn = findManagedFunctionByIdFromStore(functionId);
  if (!fn) {
    return { ok: false, error: `Managed function "${functionId}" was not found.` };
  }

  const routeSuffix = buildManagedFunctionApiRouteSuffix({
    folder: fn.folder,
    name: fn.name,
    path: fn.path,
  });
  const entry = `api/${routeSuffix}.ts`;
  const metaEntry = `api/${routeSuffix}.meta.json`;
  const sidecar = buildPluginApiMetaSidecar(fn);
  const validation = validatePluginApiMetaSidecar(sidecar);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('; ') };
  }

  return {
    ok: true,
    slug: routeSuffix,
    entry,
    metaEntry,
    code: `${fn.code.trim()}\n`,
    metaJson: `${JSON.stringify(sidecar, null, 2)}\n`,
    auth: sidecar.auth,
    timeoutMs: sidecar.timeoutMs,
    method: fn.method,
    path: fn.path,
    name: fn.name,
  };
}
