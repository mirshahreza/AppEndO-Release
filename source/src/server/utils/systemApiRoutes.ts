import type { Express } from 'express';
import { format as formatWithPrettier } from 'prettier';
import { getAsyncHandlerInnerHandler } from './asyncHandler';

export type SystemFunctionHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type SystemFunctionRoute = {
  id: string;
  name: string;
  folder: string;
  method: SystemFunctionHttpMethod;
  path: string;
  code: string;
  language: 'ts' | 'js';
  testPayload: string;
  isBuiltIn?: boolean;
  packageId?: string;
  packageDisplayName?: string;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
};

type ExpressRouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack?: ExpressStackLayer[];
  };
  name?: string;
  handle?: { stack?: ExpressStackLayer[] };
  path?: string;
  regexp?: RegExp;
};

type ExpressStackLayer = ExpressRouteLayer;

const SUPPORTED_HTTP_METHODS = new Set<SystemFunctionHttpMethod>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
]);

export const joinRoutePaths = (basePath: string, routePath: string): string => {
  const base = (basePath || '').replace(/\/+$/, '') || '';
  if (!routePath || routePath === '/') {
    return base || '/';
  }
  if (routePath.startsWith('/')) {
    return base ? `${base}${routePath}` : routePath;
  }
  return base ? `${base}/${routePath}` : `/${routePath}`;
};

const getRouterMountPath = (layer: ExpressRouteLayer): string => {
  if (typeof layer.path === 'string' && layer.path.length > 0) {
    return layer.path;
  }

  const source = layer.regexp?.source;
  if (!source) {
    return '';
  }

  let mountPath = source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)/, '')
    .replace(/\(\?=\\\/\|\$\)/, '')
    .replace(/\\\/\?$/, '')
    .replace(/\\\/\(\?=\\\/\|\$\)/, '')
    .replace(/\\\//g, '/')
    .replace(/\/\?$/, '');

  if (!mountPath.startsWith('/')) {
    mountPath = `/${mountPath}`;
  }

  return mountPath === '/' ? '' : mountPath;
};

const isDiscoverableApiPath = (routePath: string): boolean => (
  routePath.startsWith('/api')
  && !routePath.includes('*')
);

const toSystemFunctionId = (method: string, routePath: string) => {
  const normalizedPath = routePath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `sys-${method.toLowerCase()}-${normalizedPath || 'root'}`;
};

const toSystemFunctionName = (segments: string[], method: string) => {
  const tail = segments.slice(2).map((segment) => {
    if (segment.startsWith(':')) {
      return `by-${segment.slice(1)}`;
    }
    return segment;
  }).filter(Boolean);

  if (tail.length === 0) {
    return `${method.toLowerCase()}-${segments[1] || 'root'}`;
  }

  return tail.join('-');
};

const normalizeSystemApiRoutePath = (routePath: string): string => {
  const withoutQuery = routePath.split('?')[0] || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

export const deriveSystemFunctionDisplayName = (
  method: string,
  routePath: string,
): string => {
  const segments = normalizeSystemApiRoutePath(routePath).split('/').filter(Boolean);
  return toSystemFunctionName(segments, method.toUpperCase());
};

export const buildSystemFunctionRouteKey = (method: string, routePath: string): string => (
  `${method.toUpperCase()} ${normalizeSystemApiRoutePath(routePath)}`
);

const toSystemFunctionTestPayload = (method: SystemFunctionHttpMethod, routePath: string) => {
  const normalizedPath = routePath.toLowerCase();

  if (method === 'POST' && normalizedPath === '/api/auth/login') {
    return JSON.stringify({ body: { email: 'admin@append.os', password: 'admin123' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/profile') {
    return JSON.stringify({ query: { userId: 1 } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/profile') {
    return JSON.stringify({ body: { userId: 1, fullName: 'Admin User', phone: '+989120000000' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/users') {
    return JSON.stringify({ query: { limit: 10, page: 1 } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/users') {
    return JSON.stringify({ body: { email: 'newuser@example.com', password: 'secret123', role: 'DEVELOPER' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/users/:id') {
    return JSON.stringify({ params: { id: '2' }, body: { email: 'updated@example.com', role: 'ADMIN' } }, null, 2);
  }

  if (method === 'DELETE' && normalizedPath === '/api/users/:id') {
    return JSON.stringify({ params: { id: '2' } }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/roles') {
    return JSON.stringify({ query: { limit: 10, page: 1 } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/roles') {
    return JSON.stringify({ body: { name: 'MODERATOR', description: 'Content moderator role' } }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/roles/:id') {
    return JSON.stringify({ params: { id: '3' }, body: { description: 'Updated description' } }, null, 2);
  }

  if (method === 'DELETE' && normalizedPath === '/api/roles/:id') {
    return JSON.stringify({ params: { id: '3' } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/base-info') {
    return JSON.stringify({
      body: {
        parentId: null,
        title: 'General',
        titleEn: 'General',
        titleFa: 'General',
        titleAr: 'General',
        shortName: 'GEN',
        viewOrder: 1,
        note: 'Sample base-info node',
        metadata: '',
        value: 0,
        isActive: true,
        uiColor: '',
        uiHtml: '',
      },
    }, null, 2);
  }

  if (method === 'PUT' && normalizedPath === '/api/base-info/:id') {
    return JSON.stringify({
      params: { id: '1' },
      body: {
        title: 'General',
        titleEn: 'General',
        titleFa: 'General',
        titleAr: 'General',
        shortName: 'GEN',
        viewOrder: 1,
        note: 'Sample base-info node',
        metadata: '',
        value: 0,
        isActive: true,
        uiColor: '',
        uiHtml: '',
      },
    }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/base-info/:id/move') {
    return JSON.stringify({
      params: { id: '1' },
      body: { targetId: '2', position: 'inside' },
    }, null, 2);
  }

  if (method === 'PATCH' && normalizedPath === '/api/base-info/:id/active') {
    return JSON.stringify({
      params: { id: '1' },
      body: { isActive: true },
    }, null, 2);
  }

  if (method === 'GET' && normalizedPath === '/api/workflow-work-items/:workitemid') {
    return JSON.stringify({ params: { workItemId: '1' } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/workflow-work-items/:workitemid/claim') {
    return JSON.stringify({ params: { workItemId: '1' } }, null, 2);
  }

  if (method === 'POST' && normalizedPath === '/api/workflow-work-items/:workitemid/complete') {
    return JSON.stringify({
      params: { workItemId: '1' },
      body: { outcome: 'APPROVED', output: {} },
    }, null, 2);
  }

  const paramMatches: string[] = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  const params = paramMatches.reduce((acc, token) => {
    const key = token.slice(1);
    acc[key] = key.toLowerCase().includes('id') ? '1' : 'sample';
    return acc;
  }, {} as Record<string, string>);

  const payload: Record<string, unknown> = {};
  if (Object.keys(params).length > 0) {
    payload.params = params;
  }

  if (method === 'GET') {
    payload.query = { limit: 10, page: 1 };
  } else {
    payload.body = { sample: true };
  }

  return JSON.stringify(payload, null, 2);
};

export type CollectSystemApiRoutesOptions = {
  /** When false (default), skips Prettier and handler extraction for faster discovery. */
  includePreviewCode?: boolean;
};

const PLACEHOLDER_PREVIEW_CODE = (method: SystemFunctionHttpMethod, routePath: string) => (
  `// Auto-discovered built-in route: ${method} ${routePath}\nasync function handler() {\n  return res.status(501).json({ success: false, error: "Built-in system route preview only." });\n}\n\nhandler();`
);

const formatHandlerSourceForPreview = async (source: string) => {
  try {
    return await formatWithPrettier(source, {
      parser: 'babel',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
    });
  } catch {
    return source;
  }
};

const toPreviewHandlerIdentifier = (value: string) => {
  const normalized = value
    .replace(/[^a-zA-Z0-9_$]+/g, '_')
    .replace(/^[^a-zA-Z_$]+/, '');
  return normalized || 'handler';
};

const buildTypeScriptHandlerPreview = async (
  source: string,
  handlerName: string,
  method: SystemFunctionHttpMethod,
  routePath: string,
) => {
  const formattedSource = await formatHandlerSourceForPreview(source);
  const previewIdentifier = toPreviewHandlerIdentifier(handlerName);
  const previewCode = `// Primary route handler
// ${method} ${routePath}

type BuiltInReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type BuiltInRes = {
  json(data: unknown): unknown;
  send(data: unknown): unknown;
  status(code: number): BuiltInRes;
};

type BuiltInNext = (error?: unknown) => unknown;
type BuiltInHandler = (req: BuiltInReq, res: BuiltInRes, next?: BuiltInNext) => Promise<unknown> | unknown;

declare const db: any;
declare const logger: {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

const ${previewIdentifier}: BuiltInHandler = (
${formattedSource}
);

${previewIdentifier};`;

  try {
    return await formatWithPrettier(previewCode, {
      parser: 'babel-ts',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
    });
  } catch {
    return previewCode;
  }
};

const resolvePrimaryRouteHandler = (routeStack: ExpressStackLayer[] | undefined) => {
  if (!Array.isArray(routeStack) || routeStack.length === 0) {
    return null;
  }

  for (let index = routeStack.length - 1; index >= 0; index -= 1) {
    const handle = routeStack[index]?.handle;
    if (typeof handle === 'function') {
      return handle;
    }
  }

  return null;
};

const buildSystemFunctionRoutePreviewCode = async (
  method: SystemFunctionHttpMethod,
  routePath: string,
  primaryHandler: ((...args: unknown[]) => unknown) | null,
): Promise<string> => {
  if (!primaryHandler) {
    return PLACEHOLDER_PREVIEW_CODE(method, routePath);
  }

  // asyncHandler(...) wraps the real route logic in a generic catch-and-forward closure; reflecting
  // that closure's own source would document every asyncHandler-wrapped route identically. Reflect
  // the real handler it wraps instead, when the wrapper exposes one.
  const effectiveHandler = getAsyncHandlerInnerHandler(primaryHandler) ?? primaryHandler;
  const handlerName = effectiveHandler.name || primaryHandler.name || 'handler';
  try {
    return await buildTypeScriptHandlerPreview(
      effectiveHandler.toString(),
      handlerName,
      method,
      routePath,
    );
  } catch {
    return await buildTypeScriptHandlerPreview(
      `function ${handlerName}() { /* source unavailable */ }`,
      handlerName,
      method,
      routePath,
    );
  }
};

const buildSystemFunctionRoute = async (
  method: SystemFunctionHttpMethod,
  routePath: string,
  primaryHandler: ((...args: unknown[]) => unknown) | null,
  options: CollectSystemApiRoutesOptions,
): Promise<SystemFunctionRoute> => {
  const segments = routePath.split('/').filter(Boolean);
  const folder = segments[1] || 'system';
  const name = toSystemFunctionName(segments, method);

  const previewCode = options.includePreviewCode
    ? await buildSystemFunctionRoutePreviewCode(method, routePath, primaryHandler)
    : PLACEHOLDER_PREVIEW_CODE(method, routePath);

  return {
    id: toSystemFunctionId(method, routePath),
    name,
    folder,
    method,
    path: routePath,
    code: previewCode,
    language: 'ts',
    testPayload: toSystemFunctionTestPayload(method, routePath),
    isBuiltIn: true,
  };
};

const collectRoutesFromStack = async (
  stack: ExpressStackLayer[],
  basePath: string,
  routes: SystemFunctionRoute[],
  seen: Set<string>,
  options: CollectSystemApiRoutesOptions,
): Promise<void> => {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = joinRoutePaths(basePath, layer.route.path);
      if (!isDiscoverableApiPath(routePath)) {
        continue;
      }

      for (const methodKey of Object.keys(layer.route.methods || {})) {
        const upperMethod = methodKey.toUpperCase() as SystemFunctionHttpMethod;
        if (!SUPPORTED_HTTP_METHODS.has(upperMethod)) {
          continue;
        }

        const uniqueKey = `${upperMethod} ${routePath}`;
        if (seen.has(uniqueKey)) {
          continue;
        }
        seen.add(uniqueKey);

        const primaryHandler = options.includePreviewCode
          ? resolvePrimaryRouteHandler(layer.route.stack)
          : null;
        routes.push(await buildSystemFunctionRoute(upperMethod, routePath, primaryHandler, options));
      }
      continue;
    }

    if (layer.name === 'router' && Array.isArray(layer.handle?.stack)) {
      const mountPath = getRouterMountPath(layer);
      await collectRoutesFromStack(
        layer.handle.stack,
        joinRoutePaths(basePath, mountPath),
        routes,
        seen,
        options,
      );
    }
  }
};

export const collectSystemApiRoutes = async (
  app: Express,
  options: CollectSystemApiRoutesOptions = {},
): Promise<SystemFunctionRoute[]> => {
  const router = (app as { _router?: { stack?: ExpressStackLayer[] } })._router;
  const stack = Array.isArray(router?.stack) ? router.stack : [];
  const routes: SystemFunctionRoute[] = [];
  const seen = new Set<string>();

  await collectRoutesFromStack(stack, '', routes, seen, options);

  return routes.sort((a, b) => {
    const folderCompare = a.folder.localeCompare(b.folder);
    if (folderCompare !== 0) return folderCompare;
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.method.localeCompare(b.method);
  });
};
