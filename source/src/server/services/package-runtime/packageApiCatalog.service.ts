import fs from 'fs';
import path from 'path';
import { atomicWriteText, buildPackageDisplayNameMap } from '../../../core/packages/PackageFileStore';
import {
  resolveApiMetaEntryPath,
  resolveInstalledPackageApiCatalogLocation,
  validatePluginApiMetaSidecar,
} from '../../../core/packages/packageApiMetaSidecar';
import {
  AUTHENTICATED_FUNCTION_ACCESS_CONTROL,
  PUBLIC_FUNCTION_ACCESS_CONTROL,
  type FunctionAccessControl,
} from '../../../shared/api/contracts/server-functions/accessControl';
import type { ManagedFunctionOpenApiInput } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';
import { getEnabledInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import type { ApiRegistryRecord } from '../../domain/package-domain/types';
import type { SystemFunctionRoute } from '../../utils/systemApiRoutes';
import { resolveRuntimeEntryPath } from './packageUiRuntime.service';

export type PackageApiCatalogEntry = {
  packageId: string;
  version: string;
  api: ApiRegistryRecord;
};

export function buildPackageApiCatalogId(packageId: string, apiId: string): string {
  return `pkg-api-${packageId}-${apiId}`;
}

export function resolvePackageApiCatalogEntry(catalogId: string): PackageApiCatalogEntry | null {
  if (!catalogId.startsWith('pkg-api-')) {
    return null;
  }

  const enabledMap = getEnabledInstalledVersionsMap();
  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry || registry.records.apis.length === 0) {
      continue;
    }

    for (const api of registry.records.apis) {
      if (buildPackageApiCatalogId(packageId, api.apiId) === catalogId) {
        return { packageId, version, api };
      }
    }
  }

  return null;
}

export function updateInstalledPackageApiHandler(
  catalogId: string,
  code: string,
): { ok: true } | { ok: false; error: string } {
  const resolved = resolvePackageApiCatalogEntry(catalogId);
  if (!resolved) {
    return { ok: false, error: 'Package API not found or package is not enabled.' };
  }

  const absPath = resolveRuntimeEntryPath(resolved.packageId, resolved.version, resolved.api.entry);
  if (!absPath) {
    return { ok: false, error: `Invalid API entry path "${resolved.api.entry}".` };
  }

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  atomicWriteText(absPath, code);

  return { ok: true };
}

const mapPackageApiAuthToAccessControl = (
  auth: ApiRegistryRecord['auth'],
): FunctionAccessControl => {
  if (auth === 'public') {
    return PUBLIC_FUNCTION_ACCESS_CONTROL;
  }
  if (auth === 'admin') {
    return {
      accessMode: 'specific',
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    };
  }
  return AUTHENTICATED_FUNCTION_ACCESS_CONTROL;
};

function readPackageApiMetaSidecar(
  packageId: string,
  version: string,
  entry: string,
) {
  const metaEntry = resolveApiMetaEntryPath(entry);
  const absPath = resolveRuntimeEntryPath(packageId, version, metaEntry);
  if (!absPath || !fs.existsSync(absPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8')) as unknown;
    const validation = validatePluginApiMetaSidecar(parsed);
    return validation.valid ? validation.sidecar : null;
  } catch {
    return null;
  }
}

export function buildPackageApiDocInput(
  packageId: string,
  version: string,
  api: ApiRegistryRecord,
): ManagedFunctionOpenApiInput {
  const httpPath = api.httpPath || `/api${api.path}`;
  const location = resolveInstalledPackageApiCatalogLocation(packageId, httpPath, api.apiId);
  const sidecar = readPackageApiMetaSidecar(packageId, version, api.entry);
  const metadataJson = sidecar?.tags?.length
    ? JSON.stringify({ apiDoc: { tags: sidecar.tags } })
    : null;

  return {
    id: buildPackageApiCatalogId(packageId, api.apiId),
    name: location.name,
    folder: location.folder,
    method: api.method,
    path: httpPath,
    code: readPackageApiHandlerSource(packageId, version, api.entry),
    metadata_json: metadataJson,
    test_payload: sidecar?.testPayload
      ?? JSON.stringify({ query: {}, params: {}, body: {} }, null, 2),
    engine_type: sidecar?.engineType ?? 'SANDBOX_JS',
    is_built_in: false,
    access_control: mapPackageApiAuthToAccessControl(api.auth),
    created_at: api.registeredAt,
    created_by: `package:${packageId}`,
    updated_at: api.registeredAt,
    updated_by: `package:${packageId}`,
  };
}

export function listInstalledPackageApiDocInputs(): ManagedFunctionOpenApiInput[] {
  const enabledMap = getEnabledInstalledVersionsMap();
  const inputs: ManagedFunctionOpenApiInput[] = [];

  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry || registry.records.apis.length === 0) {
      continue;
    }

    for (const api of registry.records.apis) {
      inputs.push(buildPackageApiDocInput(packageId, version, api));
    }
  }

  return inputs;
}

function readPackageApiHandlerSource(packageId: string, version: string, entry: string): string {
  const absPath = resolveRuntimeEntryPath(packageId, version, entry);
  if (!absPath || !fs.existsSync(absPath)) {
    return `// Package API handler (${packageId})\n// Runtime source is unavailable.\n`;
  }
  return fs.readFileSync(absPath, 'utf8');
}

export function listInstalledPackageApiRoutes(): SystemFunctionRoute[] {
  const enabledMap = getEnabledInstalledVersionsMap();
  const routes: SystemFunctionRoute[] = [];
  const displayNames = buildPackageDisplayNameMap();

  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry || registry.records.apis.length === 0) {
      continue;
    }

    for (const api of registry.records.apis) {
      const httpPath = api.httpPath || `/api${api.path}`;
      const location = resolveInstalledPackageApiCatalogLocation(packageId, httpPath, api.apiId);
      const packageActor = `package:${packageId}`;
      routes.push({
        id: buildPackageApiCatalogId(packageId, api.apiId),
        name: location.name,
        folder: location.folder,
        method: api.method,
        path: httpPath,
        code: readPackageApiHandlerSource(packageId, version, api.entry),
        language: api.entry.endsWith('.js') ? 'js' : 'ts',
        testPayload: JSON.stringify({ query: {}, params: {}, body: {} }, null, 2),
        isBuiltIn: false,
        packageId,
        packageDisplayName: displayNames.get(packageId) ?? packageId,
        created_at: api.registeredAt,
        created_by: packageActor,
        updated_at: api.registeredAt,
        updated_by: packageActor,
      });
    }
  }

  return routes;
}
