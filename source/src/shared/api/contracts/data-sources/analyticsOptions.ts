export type AnalyticsWhitelistField = {
  path: string;
  type: string;
};

export type DataSourceAnalyticsOptions = {
  collection?: string;
  index?: string;
  catalog?: string;
  cube?: string;
  language?: 'MDX' | 'DAX';
  fields?: AnalyticsWhitelistField[];
  pivotCacheTtlMs?: number;
};

export const DATA_SOURCE_TYPE_OLAP_BRIDGE = 'OLAP Bridge';
export const DATA_SOURCE_TYPE_MONGODB_ANALYTICS = 'MongoDB Analytics';
export const DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS = 'Elasticsearch Analytics';

export const isAnalyticsDataSourceType = (type: string): boolean => (
  type === DATA_SOURCE_TYPE_OLAP_BRIDGE
  || type === DATA_SOURCE_TYPE_MONGODB_ANALYTICS
  || type === DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS
);

export const parseDataSourceAnalyticsOptions = (value: unknown): DataSourceAnalyticsOptions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const fields = Array.isArray(record.fields)
    ? record.fields.flatMap((entry): AnalyticsWhitelistField[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return [];
      }
      const row = entry as Record<string, unknown>;
      const path = typeof row.path === 'string' ? row.path.trim() : '';
      const type = typeof row.type === 'string' ? row.type.trim() : 'string';
      return path ? [{ path, type: type || 'string' }] : [];
    })
    : undefined;
  const language = record.language === 'DAX' || record.language === 'MDX' ? record.language : undefined;
  return {
    collection: typeof record.collection === 'string' ? record.collection.trim() : undefined,
    index: typeof record.index === 'string' ? record.index.trim() : undefined,
    catalog: typeof record.catalog === 'string' ? record.catalog.trim() : undefined,
    cube: typeof record.cube === 'string' ? record.cube.trim() : undefined,
    language,
    fields,
    pivotCacheTtlMs: typeof record.pivotCacheTtlMs === 'number' ? record.pivotCacheTtlMs : undefined,
  };
};
