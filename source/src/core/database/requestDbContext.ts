export type RequestDbContext = {
  dataSourceId?: string;
  dataSourceName?: string;
  database?: string;
};

export type RequestDbContextInput = {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
};

const readRequestStringValue = (value: unknown) => {
  if (Array.isArray(value)) {
    const firstMatch = value.find((item) => typeof item === 'string' && item.trim());
    return typeof firstMatch === 'string' ? firstMatch.trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
};

export const getRequestDbContextFromInput = (input: RequestDbContextInput): RequestDbContext => {
  const headers = input.headers || {};
  const query = input.query || {};
  const bodyRecord = input.body && typeof input.body === 'object' ? input.body as Record<string, unknown> : {};
  const bodyContext = bodyRecord.dbContext && typeof bodyRecord.dbContext === 'object'
    ? bodyRecord.dbContext as Record<string, unknown>
    : {};

  const dataSourceId = readRequestStringValue(headers['x-append-datasource-id'])
    || readRequestStringValue(query.dataSourceId)
    || readRequestStringValue(bodyContext.dataSourceId)
    || readRequestStringValue(bodyRecord.dataSourceId);
  const dataSourceName = readRequestStringValue(headers['x-append-datasource-name'])
    || readRequestStringValue(query.dataSourceName)
    || readRequestStringValue(bodyContext.dataSourceName)
    || readRequestStringValue(bodyRecord.dataSourceName);
  const database = readRequestStringValue(headers['x-append-database'])
    || readRequestStringValue(query.database)
    || readRequestStringValue(bodyContext.database)
    || readRequestStringValue(bodyRecord.database);

  return {
    dataSourceId: dataSourceId || undefined,
    dataSourceName: dataSourceName || undefined,
    database: database || undefined,
  };
};
