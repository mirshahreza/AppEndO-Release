import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import type { ToolExecutionContext } from '../../../../../core/ai/agent/types';
import {
  canAccessFunctionDoc,
  type FunctionDocAccessPrincipal,
  type OpenApiObject,
} from '../../../../../shared/api/openapi/buildManagedFunctionOpenApi';
import { openApiSpecService } from '../../../openApiSpec.service';
import { toAccessibleRouteListItem } from '../../../openApiRouteCatalog';

export const LIST_OPENAPI_ROUTES_TOOL_NAME = 'list_openapi_routes';
export const GET_OPENAPI_SPEC_TOOL_NAME = 'get_openapi_spec';

export const OPENAPI_SPEC_MAX_BYTES = 512_000;

const defaultPrincipal: FunctionDocAccessPrincipal = {
  isAdmin: false,
  roles: [],
};

const resolvePrincipal = (context?: ToolExecutionContext): FunctionDocAccessPrincipal => (
  context?.docAccessPrincipal ?? defaultPrincipal
);

const sortRouteItems = <T extends { path: string; method: string; name: string }>(items: T[]): T[] => (
  [...items].sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.method.localeCompare(right.method)
    || left.name.localeCompare(right.name)
  ))
);

export const limitOpenApiSpecSize = (
  spec: OpenApiObject,
): { spec: OpenApiObject; truncated: boolean; totalPaths?: number } => {
  const serialized = JSON.stringify(spec);
  if (Buffer.byteLength(serialized, 'utf8') <= OPENAPI_SPEC_MAX_BYTES) {
    return { spec, truncated: false };
  }

  const pathsRecord = spec.paths && typeof spec.paths === 'object'
    ? spec.paths as Record<string, unknown>
    : {};
  const pathKeys = Object.keys(pathsRecord);
  const limitedPaths: Record<string, unknown> = {};
  let truncated = false;

  for (const pathKey of pathKeys) {
    const candidate = {
      ...spec,
      paths: { ...limitedPaths, [pathKey]: pathsRecord[pathKey] },
    };
    if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') > OPENAPI_SPEC_MAX_BYTES) {
      truncated = true;
      break;
    }
    limitedPaths[pathKey] = pathsRecord[pathKey];
  }

  if (Object.keys(limitedPaths).length === 0) {
    truncated = true;
  }

  return {
    spec: {
      openapi: spec.openapi,
      info: spec.info,
      servers: spec.servers,
      paths: limitedPaths,
      components: spec.components,
      _truncated: truncated,
      _totalPaths: pathKeys.length,
      _returnedPaths: Object.keys(limitedPaths).length,
    },
    truncated: truncated || Object.keys(limitedPaths).length < pathKeys.length,
    totalPaths: pathKeys.length,
  };
};

export const executeListOpenapiRoutes = async (
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
) => {
  const principal = resolvePrincipal(context);
  const pathFilter = typeof args.pathContains === 'string' ? args.pathContains.trim().toLowerCase() : '';
  const methodFilter = typeof args.method === 'string' ? args.method.trim().toUpperCase() : '';

  const routes = await openApiSpecService.listAccessibleRoutesForPrincipal(principal);
  let items = routes.map(toAccessibleRouteListItem);

  if (pathFilter) {
    items = items.filter((item) => item.path.toLowerCase().includes(pathFilter));
  }
  if (methodFilter) {
    items = items.filter((item) => item.method === methodFilter);
  }

  items = sortRouteItems(items);

  return {
    ok: true as const,
    summary: pathFilter || methodFilter
      ? `Listed ${items.length} accessible OpenAPI route(s) matching filters.`
      : `Listed ${items.length} accessible OpenAPI route(s).`,
    data: {
      items,
      totalCount: items.length,
      filters: {
        pathContains: pathFilter || undefined,
        method: methodFilter || undefined,
      },
    },
  };
};

export const executeGetOpenapiSpec = async (
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
) => {
  const principal = resolvePrincipal(context);
  const functionId = typeof args.functionId === 'string' ? args.functionId.trim() : '';

  if (!functionId) {
    const spec = await openApiSpecService.getAggregatedSpecForPrincipal(principal);
    const limited = limitOpenApiSpecSize(spec);
    return {
      ok: true as const,
      summary: limited.truncated
        ? `Returned aggregated OpenAPI spec (truncated to ${limited.spec._returnedPaths ?? 0}/${limited.totalPaths ?? 0} path(s)).`
        : 'Returned aggregated OpenAPI spec for accessible routes.',
      data: {
        scope: 'aggregated' as const,
        truncated: limited.truncated,
        totalPaths: limited.totalPaths,
        spec: limited.spec,
      },
    };
  }

  const input = await openApiSpecService.findFunctionInput(functionId);
  if (!input) {
    return {
      ok: false as const,
      summary: `OpenAPI route "${functionId}" was not found.`,
      error: 'route_not_found',
    };
  }

  if (!canAccessFunctionDoc(principal, input)) {
    return {
      ok: false as const,
      summary: `OpenAPI route "${functionId}" is not accessible for the current user.`,
      error: 'route_forbidden',
    };
  }

  const spec = await openApiSpecService.getFunctionSpec(functionId);
  if (!spec) {
    return {
      ok: false as const,
      summary: `OpenAPI route "${functionId}" was not found.`,
      error: 'route_not_found',
    };
  }

  const limited = limitOpenApiSpecSize(spec);
  return {
    ok: true as const,
    summary: limited.truncated
      ? `Returned OpenAPI spec for ${input.method.toUpperCase()} ${input.path} (truncated).`
      : `Returned OpenAPI spec for ${input.method.toUpperCase()} ${input.path}.`,
    data: {
      scope: 'route' as const,
      functionId,
      method: input.method.toUpperCase(),
      path: input.path,
      truncated: limited.truncated,
      spec: limited.spec,
    },
  };
};

export const createOpenApiTools = (): NativeToolDefinition[] => [
  {
    name: LIST_OPENAPI_ROUTES_TOOL_NAME,
    description: 'List managed and built-in API routes with OpenAPI docs accessible to the current user. Includes testPayload hints for route testing.',
    group: 'openapi',
    parameters: {
      type: 'object',
      properties: {
        pathContains: {
          type: 'string',
          description: 'Optional case-insensitive path substring filter.',
        },
        method: {
          type: 'string',
          description: 'Optional HTTP method filter (GET, POST, PUT, PATCH, DELETE).',
        },
      },
    },
    execute: async (args, context) => executeListOpenapiRoutes(args, context),
  },
  {
    name: GET_OPENAPI_SPEC_TOOL_NAME,
    description: 'Fetch aggregated OpenAPI spec (omit functionId) or a single route spec by function id from list_openapi_routes.',
    group: 'openapi',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: 'Optional managed/built-in function id. Omit for aggregated accessible spec.',
        },
      },
    },
    execute: async (args, context) => executeGetOpenapiSpec(args, context),
  },
];
