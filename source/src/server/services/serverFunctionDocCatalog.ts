import type { ServerFunctionItem } from '../../shared/api/contracts/server-functions/types';
import { parseFunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import { INITIAL_FUNCTIONS } from '../../shared/api/contracts/server-functions/initialFunctions';
import type { ManagedFunctionOpenApiInput } from '../../shared/api/openapi/buildManagedFunctionOpenApi';
import { listManagedFunctions } from '../domain/functions/functionRepository';
import type { SystemFunctionRoute } from '../utils/systemApiRoutes';
import { builtinFunctionRegistry } from './builtinFunctionRegistry.service';
import {
  buildPackageApiDocInput,
  listInstalledPackageApiDocInputs,
  resolvePackageApiCatalogEntry,
} from './package-runtime/packageApiCatalog.service';

export type ServerFunctionDocCatalogDeps = {
  discoverSystemRoutes: () => Promise<SystemFunctionRoute[]>;
};

const curatedBuiltInByRoute = new Map<string, ServerFunctionItem>(
  INITIAL_FUNCTIONS
    .filter((item) => item.isBuiltIn)
    .map((item) => [`${item.method} ${item.path}`, item]),
);

const curatedBuiltInById = new Map<string, ServerFunctionItem>(
  INITIAL_FUNCTIONS
    .filter((item) => item.isBuiltIn)
    .map((item) => [item.id, item]),
);

const toManagedOpenApiInput = (row: Record<string, unknown>): ManagedFunctionOpenApiInput => ({
  id: String(row.id || ''),
  name: String(row.name || ''),
  folder: String(row.folder || 'general'),
  method: String(row.method || 'GET'),
  path: String(row.path || ''),
  code: typeof row.code === 'string' ? row.code : '',
  metadata_json: typeof row.metadata_json === 'string'
    ? row.metadata_json
    : (row.metadata_json === null || row.metadata_json === undefined
      ? null
      : JSON.stringify(row.metadata_json)),
  test_payload: typeof row.test_payload === 'string'
    ? row.test_payload
    : (typeof row.testPayload === 'string' ? row.testPayload : null),
  engine_type: typeof row.engine_type === 'string'
    ? row.engine_type
    : (typeof row.engineType === 'string' ? row.engineType : null),
  is_built_in: false,
  updated_at: typeof row.updated_at === 'string'
    ? row.updated_at
    : (typeof row.updatedAt === 'string' ? row.updatedAt : null),
  access_control: parseFunctionAccessControl(row.access_control ?? row.accessControl),
});

const toCuratedBuiltInInput = (
  curated: (typeof INITIAL_FUNCTIONS)[number],
): ManagedFunctionOpenApiInput => {
  const merged = builtinFunctionRegistry.getMergedRecordById(curated.id);
  const accessControl = merged?.accessControl ?? curated.accessControl;
  return {
    id: curated.id,
    name: curated.name,
    folder: curated.folder,
    method: curated.method,
    path: curated.path,
    code: curated.code,
    metadata_json: merged?.metadataJson ? JSON.stringify(merged.metadataJson) : (curated.metadataJson ? JSON.stringify(curated.metadataJson) : null),
    test_payload: merged?.testPayload ?? curated.testPayload,
    engine_type: curated.engineType ?? 'SANDBOX_JS',
    is_built_in: true,
    allowed_roles: accessControl?.allowRoles ?? [],
    access_control: accessControl,
  };
};

const toSystemBuiltInInput = (
  route: SystemFunctionRoute,
  catalogId?: string,
): ManagedFunctionOpenApiInput => {
  const routeLookupKey = `${route.method} ${route.path}`;
  const curated = curatedBuiltInByRoute.get(routeLookupKey);
  if (curated) {
    return {
      ...toCuratedBuiltInInput(curated),
      id: catalogId ?? curated.id,
    };
  }

  return {
    id: catalogId ?? route.id,
    name: route.name,
    folder: route.folder,
    method: route.method,
    path: route.path,
    code: route.code,
    metadata_json: null,
    test_payload: route.testPayload,
    engine_type: 'SANDBOX_JS',
    is_built_in: true,
    allowed_roles: [],
  };
};

const buildRouteKey = (input: Pick<ManagedFunctionOpenApiInput, 'method' | 'path'>) => (
  `${input.method.toUpperCase()} ${input.path}`
);

const EXCLUDED_BUILTIN_DOC_PREFIXES = [
  '/api/docs',
  '/api/health',
  '/api/ready',
  '/api/project-standards',
];

const isIncludedBuiltInDocRoute = (path: string): boolean => (
  !EXCLUDED_BUILTIN_DOC_PREFIXES.some((prefix) => (
    path === prefix || path.startsWith(`${prefix}/`)
  ))
);

export async function loadAllServerFunctionDocInputs(
  deps: ServerFunctionDocCatalogDeps,
): Promise<ManagedFunctionOpenApiInput[]> {
  await builtinFunctionRegistry.ensureLoaded();
  const [managedRows, systemRoutes] = await Promise.all([
    listManagedFunctions(),
    deps.discoverSystemRoutes(),
  ]);

  const managedInputs = managedRows.map((row) => toManagedOpenApiInput(row as unknown as Record<string, unknown>));
  const managedRouteKeys = new Set(managedInputs.map(buildRouteKey));

  const builtInInputs = systemRoutes
    .filter((route) => isIncludedBuiltInDocRoute(route.path))
    .filter((route) => !managedRouteKeys.has(buildRouteKey(route)))
    .map((route) => toSystemBuiltInInput(route));

  const builtInRouteKeys = new Set(builtInInputs.map(buildRouteKey));
  const packageInputs = listInstalledPackageApiDocInputs()
    .filter((input) => !managedRouteKeys.has(buildRouteKey(input)))
    .filter((input) => !builtInRouteKeys.has(buildRouteKey(input)));

  return [...managedInputs, ...builtInInputs, ...packageInputs];
}

export async function findServerFunctionDocInput(
  deps: ServerFunctionDocCatalogDeps,
  functionId: string,
): Promise<ManagedFunctionOpenApiInput | null> {
  await builtinFunctionRegistry.ensureLoaded();
  const managedRows = await listManagedFunctions();
  const managedMatch = managedRows.find((row) => String(row.id) === functionId);
  if (managedMatch) {
    return toManagedOpenApiInput(managedMatch as unknown as Record<string, unknown>);
  }

  const curated = curatedBuiltInById.get(functionId);
  if (curated) {
    return toCuratedBuiltInInput(curated);
  }

  const packageResolved = resolvePackageApiCatalogEntry(functionId);
  if (packageResolved) {
    return buildPackageApiDocInput(
      packageResolved.packageId,
      packageResolved.version,
      packageResolved.api,
    );
  }

  const systemRoutes = await deps.discoverSystemRoutes();
  const systemMatch = systemRoutes.find((route) => route.id === functionId);
  if (systemMatch) {
    return toSystemBuiltInInput(systemMatch);
  }

  return null;
}
