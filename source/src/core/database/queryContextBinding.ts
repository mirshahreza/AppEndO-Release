export type SessionContextBindingSlices = {
  server?: Record<string, unknown>;
  client?: Record<string, unknown>;
};

const CONTEXT_BINDING_PATTERN = /:(?:ctx|session)\.([a-zA-Z0-9_.]+)|@session\.([a-zA-Z0-9_.]+)/g;

const isScalarContextValue = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const resolveNestedPath = (source: Record<string, unknown> | undefined, path: string): unknown => {
  if (!source) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const resolveContextValue = (
  slices: SessionContextBindingSlices,
  path: string,
  prefix: 'ctx' | 'session',
): unknown => {
  if (prefix === 'session') {
    if (path.startsWith('server.')) {
      return resolveNestedPath(slices.server, path.slice('server.'.length));
    }
    if (path.startsWith('client.')) {
      return resolveNestedPath(slices.client, path.slice('client.'.length));
    }
    return resolveNestedPath(slices.server, path)
      ?? resolveNestedPath(slices.client, path);
  }

  if (path.startsWith('server.')) {
    return resolveNestedPath(slices.server, path.slice('server.'.length));
  }
  if (path.startsWith('client.')) {
    return resolveNestedPath(slices.client, path.slice('client.'.length));
  }

  return resolveNestedPath(slices.server, path)
    ?? resolveNestedPath(slices.client, path);
};

export const bindSessionContextToQuery = (
  sql: string,
  params: unknown[],
  slices: SessionContextBindingSlices,
): { sql: string; params: unknown[] } => {
  if (!CONTEXT_BINDING_PATTERN.test(sql)) {
    CONTEXT_BINDING_PATTERN.lastIndex = 0;
    return { sql, params: [...params] };
  }
  CONTEXT_BINDING_PATTERN.lastIndex = 0;

  const boundParams = [...params];
  const boundSql = sql.replace(
    CONTEXT_BINDING_PATTERN,
    (_match, ctxPath: string | undefined, sessionPath: string | undefined) => {
      const path = ctxPath || sessionPath || '';
      const prefix = ctxPath ? 'ctx' : 'session';
      const value = resolveContextValue(slices, path, prefix);

      if (value === undefined || value === null) {
        throw new Error(`Session context binding not found: ${prefix}.${path}`);
      }
      if (!isScalarContextValue(value)) {
        throw new Error(`Session context binding must be scalar: ${prefix}.${path}`);
      }

      boundParams.push(value);
      return '?';
    },
  );

  return { sql: boundSql, params: boundParams };
};
