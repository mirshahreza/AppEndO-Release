import type { FunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import {
  canAccessManagedFunction,
  parseFunctionAccessControl,
  resolveFunctionAccessMode,
} from '../../shared/api/contracts/server-functions/accessControl';
import { sanitizeFunctionSegment } from '../functions/functionNaming';

export type ManagedFunctionExportSource = {
  id: string;
  name: string;
  method: string;
  path: string;
  code: string;
  timeout_ms: number;
  engine_type: 'SANDBOX_JS' | 'DATA_API';
  metadata_json: string | null;
  test_payload: string;
  access_control: FunctionAccessControl;
};

export const PACKAGE_API_META_SCHEMA = 'append-package-api-meta';
export const PACKAGE_API_META_SCHEMA_VERSION = '1.0.0';

export type PluginApiMetaSidecar = {
  schema: typeof PACKAGE_API_META_SCHEMA;
  schemaVersion: typeof PACKAGE_API_META_SCHEMA_VERSION;
  auth: 'public' | 'authenticated' | 'admin';
  timeoutMs: number;
  engineType: 'SANDBOX_JS' | 'DATA_API';
  tags?: string[];
  testPayload?: string;
  managedFunctionId?: string;
  managedPath?: string;
};

const VALID_AUTH = new Set(['public', 'authenticated', 'admin']);
const SECRET_KEY_RE = /(password|secret|token|api[_-]?key|authorization|credential)/i;

function toApiSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'item';
}

export type ManagedFunctionPackagePathSource = {
  folder: string;
  name: string;
  path?: string;
};

function deriveRouteSuffixFromManagedPath(path: string | undefined): string | null {
  const normalized = path?.trim() ?? '';
  if (!normalized.startsWith('/api/')) {
    return null;
  }

  const tail = normalized.slice('/api/'.length);
  if (!tail) {
    return null;
  }

  return tail
    .split('/')
    .filter(Boolean)
    .map((segment) => sanitizeFunctionSegment(segment))
    .join('/');
}

export function buildManagedFunctionApiRouteSuffix(
  source: ManagedFunctionPackagePathSource,
): string {
  const folderRaw = source.folder?.trim() ?? '';
  const folderSuffix = folderRaw ? sanitizeFunctionSegment(folderRaw) : '';
  const nameSuffix = sanitizeFunctionSegment(source.name || 'unnamed');
  const fromPath = deriveRouteSuffixFromManagedPath(source.path);
  const pathSegments = fromPath?.split('/').filter(Boolean) ?? [];

  // Full managed paths like /api/test/test are authoritative for folder/name layout.
  if (pathSegments.length >= 2) {
    return fromPath!;
  }

  if (folderSuffix) {
    return `${folderSuffix}/${nameSuffix}`;
  }

  if (fromPath) {
    return fromPath;
  }

  return toApiSlug(source.name || 'unnamed');
}

/** Last managed-path segment (or name slug) — used for api ids and flat zip entry names. */
export function buildPackageApiSlug(source: ManagedFunctionPackagePathSource): string {
  const fromPath = deriveRouteSuffixFromManagedPath(source.path);
  const pathSegments = fromPath?.split('/').filter(Boolean) ?? [];

  if (pathSegments.length > 0) {
    return pathSegments[pathSegments.length - 1]!;
  }

  return sanitizeFunctionSegment(source.name || 'unnamed');
}

export function allocateUniquePackageApiRouteSuffix(
  base: string,
  used: Set<string>,
): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }

  const next = `${base}-${index}`;
  used.add(next);
  return next;
}

function resolveManagedFunctionManifestApiPath(
  source: ManagedFunctionPackagePathSource,
): string {
  const normalized = source.path?.trim() ?? '';
  if (normalized.startsWith('/api/')) {
    return normalized;
  }

  const suffix = buildManagedFunctionApiRouteSuffix(source);
  return `/api/${suffix}`;
}

export function buildManagedFunctionPackageApiMapping(input: {
  packageId: string;
  folder: string;
  name: string;
  method: string;
  path?: string;
  apiSlug?: string;
}): {
  apiSlug: string;
  manifestPath: string;
  entry: string;
  metaEntry: string;
  apiId: string;
} {
  const routeSuffix = buildManagedFunctionApiRouteSuffix(input);
  const apiSlug = input.apiSlug ?? buildPackageApiSlug(input);
  const manifestPath = resolveManagedFunctionManifestApiPath(input);
  return {
    apiSlug,
    manifestPath,
    entry: `api/${routeSuffix}.ts`,
    metaEntry: `api/${routeSuffix}.meta.json`,
    apiId: `${toApiSlug(input.method)}-${apiSlug}`,
  };
}

export function resolveInstalledPackageApiCatalogLocation(
  packageId: string,
  httpPath: string,
  apiId: string,
): { folder: string; name: string } {
  const normalized = httpPath.trim();
  if (normalized.startsWith('/api/')) {
    const segments = normalized.slice('/api/'.length).split('/').filter(Boolean);
    if (segments[0] === 'packages') {
      if (segments.length >= 3) {
        return {
          folder: `packages/${segments[1]!}`,
          name: segments[segments.length - 1]!,
        };
      }
      if (segments.length === 2) {
        return {
          folder: 'packages',
          name: segments[1]!,
        };
      }
    }
    if (segments.length > 1) {
      return {
        folder: segments.slice(0, -1).join('/'),
        name: segments[segments.length - 1]!,
      };
    }
    if (segments.length === 1) {
      return {
        folder: 'general',
        name: segments[0]!,
      };
    }
  }

  return {
    folder: `packages/${toApiSlug(packageId)}`,
    name: apiId,
  };
}

export function parseFunctionTagsFromMetadata(metadataJson: string | null): string[] {
  if (!metadataJson?.trim()) return [];
  try {
    const parsed = JSON.parse(metadataJson) as { apiDoc?: { tags?: string[] } };
    return Array.isArray(parsed.apiDoc?.tags)
      ? parsed.apiDoc.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function resolvePluginApiAuthFromAccessControl(
  accessControl: FunctionAccessControl,
): 'public' | 'authenticated' | 'admin' {
  const mode = resolveFunctionAccessMode(accessControl);

  if (mode === 'public') {
    return 'public';
  }

  const allowRoles = accessControl.allowRoles.map((role) => role.toUpperCase());
  if (mode === 'specific' && allowRoles.length > 0 && allowRoles.every((role) => role === 'ADMIN')) {
    return 'admin';
  }

  return 'authenticated';
}

export function redactTestPayloadSecrets(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const redacted = redactSecretsInValue(parsed);
    return `${JSON.stringify(redacted, null, 2)}\n`;
  } catch {
    return trimmed;
  }
}

function redactSecretsInValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsInValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (SECRET_KEY_RE.test(key)) {
      next[key] = '[REDACTED]';
      continue;
    }
    next[key] = redactSecretsInValue(nested);
  }
  return next;
}

export function buildPluginApiMetaSidecar(fn: ManagedFunctionExportSource): PluginApiMetaSidecar {
  const accessControl = parseFunctionAccessControl(fn.access_control);
  const tags = parseFunctionTagsFromMetadata(fn.metadata_json);
  const sidecar: PluginApiMetaSidecar = {
    schema: PACKAGE_API_META_SCHEMA,
    schemaVersion: PACKAGE_API_META_SCHEMA_VERSION,
    auth: resolvePluginApiAuthFromAccessControl(accessControl),
    timeoutMs: fn.timeout_ms ?? 10000,
    engineType: fn.engine_type ?? 'SANDBOX_JS',
    managedFunctionId: fn.id,
    managedPath: fn.path,
  };

  if (tags.length > 0) {
    sidecar.tags = tags;
  }

  const redactedPayload = redactTestPayloadSecrets(fn.test_payload ?? '');
  if (redactedPayload.trim()) {
    sidecar.testPayload = redactedPayload.trimEnd();
  }

  return sidecar;
}

export function validatePluginApiMetaSidecar(raw: unknown): {
  valid: boolean;
  errors: string[];
  sidecar: PluginApiMetaSidecar | null;
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['API meta sidecar must be a JSON object.'], sidecar: null };
  }

  const record = raw as Record<string, unknown>;
  if (record.schema !== PACKAGE_API_META_SCHEMA) {
    errors.push(`API meta sidecar schema must be "${PACKAGE_API_META_SCHEMA}".`);
  }
  if (record.schemaVersion !== PACKAGE_API_META_SCHEMA_VERSION) {
    errors.push(`API meta sidecar schemaVersion must be "${PACKAGE_API_META_SCHEMA_VERSION}".`);
  }
  if (typeof record.auth !== 'string' || !VALID_AUTH.has(record.auth)) {
    errors.push('API meta sidecar auth must be public|authenticated|admin.');
  }
  if (typeof record.timeoutMs !== 'number' || record.timeoutMs < 1000 || record.timeoutMs > 60000) {
    errors.push('API meta sidecar timeoutMs must be between 1000 and 60000.');
  }
  if (record.engineType !== 'SANDBOX_JS' && record.engineType !== 'DATA_API') {
    errors.push('API meta sidecar engineType must be SANDBOX_JS|DATA_API.');
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
      errors.push('API meta sidecar tags must be a string array when present.');
    }
  }
  if (record.testPayload !== undefined && typeof record.testPayload !== 'string') {
    errors.push('API meta sidecar testPayload must be a string when present.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, sidecar: null };
  }

  return {
    valid: true,
    errors: [],
    sidecar: record as PluginApiMetaSidecar,
  };
}

export function resolveApiMetaEntryPath(apiEntry: string): string {
  const normalized = apiEntry.trim().replace(/\\/g, '/');
  if (normalized.endsWith('.meta.json')) {
    return normalized;
  }
  if (normalized.endsWith('.ts')) {
    return normalized.replace(/\.ts$/i, '.meta.json');
  }
  if (normalized.endsWith('.js')) {
    return normalized.replace(/\.js$/i, '.meta.json');
  }
  return `${normalized}.meta.json`;
}

export function validatePluginPackageApiSidecars(
  apis: Array<{ entry: string }>,
  entryNames: Set<string>,
): string[] {
  const errors: string[] = [];

  for (const api of apis) {
    const metaEntry = resolveApiMetaEntryPath(api.entry);
    if (!entryNames.has(metaEntry)) {
      continue;
    }

    errors.push(...validateMetaEntryPresence(api.entry, metaEntry, entryNames));
  }

  return errors;
}

function validateMetaEntryPresence(
  apiEntry: string,
  metaEntry: string,
  entryNames: Set<string>,
): string[] {
  if (!entryNames.has(apiEntry)) {
    return [`API entry "${apiEntry}" is missing for meta sidecar "${metaEntry}".`];
  }
  return [];
}
