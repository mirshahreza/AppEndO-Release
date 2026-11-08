import fs from 'fs';
import path from 'path';
import vm from 'vm';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { transpileSandboxSource } from './sandboxTranspile';
import { atomicWriteBinary, packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import { getEnabledInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import type { ApiRegistryRecord } from '../../domain/package-domain/types';
import {
  getPackageRuntimeRoot,
  isSafeRelativeEntry,
  resolveRuntimeEntryPath,
} from './packageUiRuntime.service';
import { safeRegexMatch } from '../../utils/safeRegex';
import { validateJsonSchema } from '../../utils/jsonSchemaValidate';
import { createDeveloperLibraryRequire } from '../libraries/developerLibraryRequire';

export type ApiRuntimeExtractResult =
  | { ok: true; extractedCount: number }
  | { ok: false; error: string; details?: string[] };

export type PackageApiRouteMatch = {
  packageId: string;
  version: string;
  api: ApiRegistryRecord;
  params: Record<string, string>;
};

export type PackageApiHandlerResult =
  | { ok: true }
  | { ok: false; error: string; statusCode: number };

const MANAGEMENT_API_PREFIXES = [
  '/api/packages/feature-flags',
  '/api/packages/builder/catalog',
  '/api/packages/upload',
  '/api/packages/dependency-graph',
];

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeRequestPath(requestPath: string): string {
  const withoutQuery = requestPath.split('?')[0] || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compileRoutePattern(routePath: string): { pathRegex: RegExp; paramNames: string[] } {
  const normalizedPath = normalizeRequestPath(routePath);
  const segments = normalizedPath.split('/').filter(Boolean);
  const paramNames: string[] = [];

  const regexBody = segments.map((segment) => {
    if (segment.startsWith(':')) {
      paramNames.push(segment.slice(1));
      return '([^/]+)';
    }
    return escapeRegex(segment);
  }).join('/');

  return {
    pathRegex: new RegExp(`^/${regexBody}/?$`),
    paramNames,
  };
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readZipEntryMap(artifactPath: string): Map<string, Buffer> | null {
  if (!fs.existsSync(artifactPath)) return null;
  const zip = new AdmZip(artifactPath);
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entries.set(normalizeZipEntryName(entry.entryName), entry.getData());
  }
  return entries;
}

const PACKAGE_MANAGEMENT_ACTIONS = new Set([
  'download',
  'install',
  'uninstall',
  'reinstall',
  'enable',
  'disable',
  'ui',
  'deployment',
  'assets',
]);

function isRegisteredPackageId(packageId: string): boolean {
  const index = readPackageIndex();
  return index.packages.some((pkg) => pkg.packageId === packageId);
}

export function isPluginManagementApiPath(pathname: string): boolean {
  const normalized = normalizeRequestPath(pathname);
  if (MANAGEMENT_API_PREFIXES.includes(normalized)) {
    return true;
  }
  if (normalized === '/api/packages') {
    return true;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'api' || segments[1] !== 'packages') {
    return false;
  }

  const resource = segments[2] ?? '';
  if (!isRegisteredPackageId(resource)) {
    return false;
  }

  if (segments.length === 3) {
    return true;
  }

  const action = segments[3] ?? '';
  if (PACKAGE_MANAGEMENT_ACTIONS.has(action)) {
    return true;
  }

  return false;
}

export function extractPackageApiRuntime(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): ApiRuntimeExtractResult {
  const apis = manifest.capabilities.apis;
  if (apis.length === 0) {
    return { ok: true, extractedCount: 0 };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.` };
  }

  const zipEntries = readZipEntryMap(artifactPath);
  if (!zipEntries) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} could not be read.` };
  }

  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const details: string[] = [];
  let extractedCount = 0;

  for (const api of apis) {
    const entry = normalizeZipEntryName(api.entry);
    if (!isSafeRelativeEntry(entry)) {
      details.push(`Unsafe API entry path "${api.entry}" for api "${api.id}".`);
      continue;
    }

    const payload = zipEntries.get(entry);
    if (!payload) {
      details.push(`API entry "${api.entry}" is missing from artifact for api "${api.id}".`);
      continue;
    }

    const targetPath = resolveRuntimeEntryPath(packageId, version, entry);
    if (!targetPath) {
      details.push(`API entry "${api.entry}" resolved outside runtime root for api "${api.id}".`);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    atomicWriteBinary(targetPath, payload);
    extractedCount += 1;
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'Failed to extract one or more package API runtime entries.',
      details,
    };
  }

  return { ok: true, extractedCount };
}

export function removePluginApiRuntime(_packageId: string, _version?: string): void {
  // API handlers are extracted into the shared runtime root removed by removePluginUiRuntime.
}

type CompiledApiRoute = {
  packageId: string;
  version: string;
  api: ApiRegistryRecord;
  pathRegex: RegExp;
  paramNames: string[];
};

// This middleware runs unscoped on EVERY HTTP request (not just /api/packages/*), so rebuilding
// the route list from scratch here — readdir + parse every install-state.json + every
// object-registry.json, then recompile a RegExp per API route — used to happen per request
// regardless of path. Install-state/registry files only change on install/uninstall/enable/
// disable/publish, so a signature built from each file's own mtime (stat only, no read+parse) is
// a cheap, reliable staleness check: directory mtime alone isn't enough here because an in-place
// overwrite of an existing file (as opposed to a create/rename) doesn't bump the *directory's*
// mtime on Windows/most filesystems, only the file's own.
type CompiledApiRoutesCache = {
  routes: CompiledApiRoute[];
  signature: string;
};

let compiledApiRoutesCache: CompiledApiRoutesCache | null = null;

function computeDirFilesSignature(dirPath: string): string {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(dirPath).sort();
  } catch {
    return '';
  }
  const parts: string[] = [];
  for (const fileName of fileNames) {
    try {
      const stat = fs.statSync(path.join(dirPath, fileName));
      parts.push(`${fileName}:${stat.mtimeMs}`);
    } catch {
      // File removed between readdir and stat — ignore, next call will reconcile.
    }
  }
  return parts.join(',');
}

function computeApiRoutesCacheSignature(): string {
  return `${computeDirFilesSignature(packageDirs.installed)}|${computeDirFilesSignature(packageDirs.objects)}`;
}

function listCompiledApiRoutes(): CompiledApiRoute[] {
  const signature = computeApiRoutesCacheSignature();
  if (compiledApiRoutesCache && compiledApiRoutesCache.signature === signature) {
    return compiledApiRoutesCache.routes;
  }

  const enabledMap = getEnabledInstalledVersionsMap();
  const routes: CompiledApiRoute[] = [];

  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry) continue;

    for (const api of registry.records.apis) {
      const httpPath = api.httpPath || `/api${api.path}`;
      const compiled = compileRoutePattern(httpPath);
      routes.push({
        packageId,
        version,
        api: {
          ...api,
          httpPath,
          auth: api.auth ?? 'admin',
        },
        pathRegex: compiled.pathRegex,
        paramNames: compiled.paramNames,
      });
    }
  }

  compiledApiRoutesCache = { routes, signature };
  return routes;
}

export function resolvePackageApiRoute(method: string, pathname: string): PackageApiRouteMatch | null {
  const normalizedPath = normalizeRequestPath(pathname);
  if (isPluginManagementApiPath(normalizedPath)) {
    return null;
  }

  const normalizedMethod = method.toUpperCase();
  for (const route of listCompiledApiRoutes()) {
    if (route.api.method !== normalizedMethod) continue;
    const match = normalizedPath.match(route.pathRegex);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1] || '');
    });

    return {
      packageId: route.packageId,
      version: route.version,
      api: route.api,
      params,
    };
  }

  return null;
}

function readApiHandlerSource(packageId: string, version: string, entry: string): string | null {
  const absPath = resolveRuntimeEntryPath(packageId, version, entry);
  if (!absPath || !fs.existsSync(absPath)) {
    return null;
  }
  return fs.readFileSync(absPath, 'utf8');
}

export async function executePluginApiHandler(
  match: PackageApiRouteMatch,
  req: Record<string, unknown>,
  res: {
    status: (code: number) => { json: (body: unknown) => void; send: (body: unknown) => void };
    json: (body: unknown) => void;
    send: (body: unknown) => void;
    headersSent: boolean;
  },
  options: { timeoutMs?: number; authRoles?: string[] } = {},
): Promise<PackageApiHandlerResult> {
  const source = readApiHandlerSource(match.packageId, match.version, match.api.entry);
  if (!source) {
    return {
      ok: false,
      error: `API runtime entry "${match.api.entry}" is not available.`,
      statusCode: 404,
    };
  }

  const timeoutMs = Math.min(
    60_000,
    Math.max(1_000, match.api.timeoutMs ?? options.timeoutMs ?? 3_000),
  );

  let compiledCode = '';
  try {
    compiledCode = await transpileSandboxSource(source, match.api.entry);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid handler source.';
    return { ok: false, error: `Compile error: ${message}`, statusCode: 400 };
  }

  const wrappedCode = `(async () => {
    ${compiledCode}
    const __pluginApiHandler = module.exports?.default ?? module.exports;
    if (typeof __pluginApiHandler !== 'function') {
      throw new Error('Package API handler must export a default async function.');
    }
    await __pluginApiHandler(req, res);
  })()`;

  const moduleRef = { exports: {} as Record<string, unknown> };
  const sandboxEnv = {
    module: moduleRef,
    exports: moduleRef.exports,
    req: {
      ...req,
      params: {
        ...(typeof req.params === 'object' && req.params !== null ? req.params as Record<string, unknown> : {}),
        ...match.params,
      },
      auth: {
        roles: Array.isArray(options.authRoles) ? options.authRoles : [],
      },
    },
    res: {
      status: (statusCode: number) => {
        res.status(statusCode);
        return sandboxEnv.res;
      },
      json: (body: unknown) => {
        res.json(body);
      },
      send: (body: unknown) => {
        res.send(body);
      },
      headersSent: () => res.headersSent,
    },
    util: {
      regexMatch: safeRegexMatch,
      validateSchema: validateJsonSchema,
    },
    require: createDeveloperLibraryRequire(),
  };

  try {
    const script = new vm.Script(wrappedCode, { filename: `package-api-${match.packageId}.js` });
    const context = vm.createContext(sandboxEnv);
    const execution = script.runInContext(context, { timeout: timeoutMs }) as Promise<void>;
    await execution;
    return { ok: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Package API handler failed.';
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    }
    return { ok: false, error: message, statusCode: 500 };
  }
}
