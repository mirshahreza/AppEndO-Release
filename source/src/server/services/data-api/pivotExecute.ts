import type { ModelCtor, Sequelize, WhereOptions } from 'sequelize';
import type { PivotResult, PivotSpec, PivotSourceKind } from '../../../shared/api/contracts/data-api';
import { parsePivotSpec } from '../../../shared/api/contracts/data-api';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import {
  DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS,
  DATA_SOURCE_TYPE_MONGODB_ANALYTICS,
  DATA_SOURCE_TYPE_OLAP_BRIDGE,
  parseDataSourceAnalyticsOptions,
  type DataSourceAnalyticsOptions,
} from '../../../shared/api/contracts/data-sources/analyticsOptions';
import { pivotSequelizeDataset, type JsonFieldExtraction } from '../../domain/data-api/pivotFlatDataset';
import { readPivotResultCache, writePivotResultCache } from '../../domain/data-api/pivotResultCache';
import {
  applyDerivedMeasures,
  resolveStarSchemaField,
  type CubeAnnotation,
} from '../../domain/data-api/rolapStarSchemaCompiler';
import { compileMongoAggregationPipeline, mongoDocumentsToPivotResult } from '../../domain/data-api/mongoAggregationCompiler';
import {
  compileElasticsearchAggregation,
  elasticsearchAggregationsToPivotResult,
} from '../../domain/data-api/elasticsearchAggregationCompiler';
import {
  compilePivotSpecToOlapStatement,
  olapBridgeRowsToPivotResult,
  type OlapCubeMetadata,
} from '../../domain/data-api/pivotOlapCompiler';

export type ExecutePivotInput = {
  spec: unknown;
  dataSource: StoredDataSource;
  policyContextKey: string;
  allowedFields?: Set<string>;
  jsonExtractions?: JsonFieldExtraction[];
  where?: WhereOptions;
  ModelCtor?: ModelCtor;
  sequelize?: Sequelize;
  dialect?: string;
  cubeAnnotation?: CubeAnnotation;
  olapMetadata?: OlapCubeMetadata;
  noCache?: boolean;
};

export type ExecutePivotOutput = {
  success: true;
  data: PivotResult;
  meta: {
    cached: boolean;
    cellCount: number;
    cellCap: number;
    sourceKind: PivotSourceKind;
  };
  source: { id: string; name: string; type: string };
};

const resolveSourceKind = (
  spec: PivotSpec,
  dataSource: StoredDataSource,
  cubeAnnotation?: CubeAnnotation,
): PivotSourceKind => {
  if (spec.source?.kind) {
    return spec.source.kind;
  }
  if (dataSource.type === DATA_SOURCE_TYPE_OLAP_BRIDGE) {
    return 'olap-bridge';
  }
  if (dataSource.type === DATA_SOURCE_TYPE_MONGODB_ANALYTICS) {
    return 'mongo-aggregation';
  }
  if (dataSource.type === DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS) {
    return 'elasticsearch-aggregation';
  }
  if (cubeAnnotation && Object.keys(cubeAnnotation.measures).length > 0) {
    return 'star-schema';
  }
  return 'flat-sql';
};

const analyticsOptionsOf = (dataSource: StoredDataSource): DataSourceAnalyticsOptions => (
  parseDataSourceAnalyticsOptions(dataSource.options)
);

const callOlapBridge = async (
  dataSource: StoredDataSource,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> => {
  const options = analyticsOptionsOf(dataSource);
  const base = dataSource.host.trim().replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Api-Key': dataSource.password ?? '',
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`OLAP bridge request failed (${response.status}).`);
  }
  return response.json();
};

const executeMongoPivot = async (
  spec: PivotSpec,
  dataSource: StoredDataSource,
): Promise<PivotResult> => {
  const options = analyticsOptionsOf(dataSource);
  const collection = spec.source?.collection || options.collection;
  if (!collection) {
    throw new Error('MongoDB Analytics requires a declared collection.');
  }
  const compiled = compileMongoAggregationPipeline({
    collection,
    whitelist: options.fields ?? [],
    spec,
  });
  const { MongoClient } = await import('mongodb');
  const uri = dataSource.host.includes('://')
    ? dataSource.host
    : `mongodb://${dataSource.username ? `${encodeURIComponent(dataSource.username)}:${encodeURIComponent(dataSource.password ?? '')}@` : ''}${dataSource.host}:${dataSource.port || 27017}/${dataSource.database ?? ''}`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(dataSource.database || undefined);
    const documents = await db.collection(compiled.collection)
      .aggregate(compiled.pipeline, { maxTimeMS: compiled.maxTimeMS })
      .toArray() as Array<Record<string, unknown>>;
    return mongoDocumentsToPivotResult(documents, spec);
  } finally {
    await client.close();
  }
};

const executeElasticsearchPivot = async (
  spec: PivotSpec,
  dataSource: StoredDataSource,
): Promise<PivotResult> => {
  const options = analyticsOptionsOf(dataSource);
  const index = spec.source?.index || options.index;
  if (!index) {
    throw new Error('Elasticsearch Analytics requires a declared index.');
  }
  const compiled = compileElasticsearchAggregation({
    index,
    whitelist: options.fields ?? [],
    spec,
    timeout: '30s',
  });
  const { Client } = await import('@elastic/elasticsearch');
  const node = dataSource.host.includes('://')
    ? dataSource.host
    : `http://${dataSource.host}:${dataSource.port || 9200}`;
  const client = new Client({
    node,
    auth: dataSource.password
      ? { apiKey: dataSource.password }
      : dataSource.username
        ? { username: dataSource.username, password: dataSource.password ?? '' }
        : undefined,
    requestTimeout: 30_000,
  });
  const response = await client.search({
    index: compiled.index,
    ...compiled.body,
  });
  return elasticsearchAggregationsToPivotResult(
    (response as { aggregations?: Record<string, unknown> }).aggregations,
    spec,
  );
};

const executeOlapPivot = async (
  spec: PivotSpec,
  dataSource: StoredDataSource,
  metadata?: OlapCubeMetadata,
): Promise<PivotResult> => {
  const options = analyticsOptionsOf(dataSource);
  const catalog = spec.source?.catalog || options.catalog || dataSource.database || '';
  const cube = spec.source?.cube || options.cube || '';
  if (!catalog || !cube) {
    throw new Error('OLAP Bridge requires catalog and cube.');
  }
  const resolvedMetadata = metadata ?? await callOlapBridge(
    dataSource,
    `/catalogs/${encodeURIComponent(catalog)}/cubes/${encodeURIComponent(cube)}/metadata`,
  ) as OlapCubeMetadata;
  const compiled = compilePivotSpecToOlapStatement(spec, {
    ...resolvedMetadata,
    catalog,
    cube,
    language: resolvedMetadata.language ?? options.language ?? 'MDX',
  });
  const raw = await callOlapBridge(dataSource, `/catalogs/${encodeURIComponent(catalog)}/query`, {
    method: 'POST',
    body: compiled,
  }) as { columns?: Array<{ name: string }>; rows?: unknown[][] };
  return olapBridgeRowsToPivotResult({
    columns: raw.columns ?? [],
    rows: raw.rows ?? [],
  }, spec);
};

export const executePivot = async (input: ExecutePivotInput): Promise<ExecutePivotOutput> => {
  const spec = parsePivotSpec(input.spec);
  const sourceKind = resolveSourceKind(spec, input.dataSource, input.cubeAnnotation);
  const options = analyticsOptionsOf(input.dataSource);
  const ttlMs = options.pivotCacheTtlMs;
  const cacheLookup = {
    dataSourceId: input.dataSource.id,
    spec,
    policyContextKey: input.policyContextKey,
    ttlMs,
    noCache: input.noCache,
  };
  const cached = await readPivotResultCache(cacheLookup);
  if (cached) {
    return {
      success: true,
      data: cached,
      meta: {
        cached: true,
        cellCount: cached.cells.length,
        cellCap: cached.cells.length,
        sourceKind,
      },
      source: { id: input.dataSource.id, name: input.dataSource.name, type: input.dataSource.type },
    };
  }

  let result: PivotResult;
  if (sourceKind === 'mongo-aggregation') {
    result = await executeMongoPivot(spec, input.dataSource);
  } else if (sourceKind === 'elasticsearch-aggregation') {
    result = await executeElasticsearchPivot(spec, input.dataSource);
  } else if (sourceKind === 'olap-bridge') {
    result = await executeOlapPivot(spec, input.dataSource, input.olapMetadata);
  } else {
    if (!input.ModelCtor || !input.sequelize) {
      throw new Error('SQL pivot requires a published Edge model.');
    }
    const allowed = input.allowedFields ?? new Set<string>();
    if (sourceKind === 'star-schema' && input.cubeAnnotation) {
      for (const field of [
        ...spec.rows.map((item) => item.field),
        ...spec.columns.map((item) => item.field),
        ...spec.measures.map((item) => item.field),
      ]) {
        resolveStarSchemaField(field, input.cubeAnnotation);
      }
    }
    result = await pivotSequelizeDataset({
      ModelCtor: input.ModelCtor,
      sequelize: input.sequelize,
      dialect: input.dialect ?? 'sqlite',
      spec,
      where: input.where,
      jsonExtractions: input.jsonExtractions,
      allowedFields: allowed,
    });
    if (sourceKind === 'star-schema' && input.cubeAnnotation) {
      result = applyDerivedMeasures(result, spec, input.cubeAnnotation);
    }
  }

  await writePivotResultCache(cacheLookup, result);
  return {
    success: true,
    data: result,
    meta: {
      cached: false,
      cellCount: result.cells.length,
      cellCap: result.cells.length,
      sourceKind,
    },
    source: { id: input.dataSource.id, name: input.dataSource.name, type: input.dataSource.type },
  };
};

export const testOlapBridgeHealth = async (dataSource: StoredDataSource): Promise<{ ok: boolean; message: string }> => {
  try {
    const payload = await callOlapBridge(dataSource, '/health') as { status?: string };
    if (payload?.status === 'ok') {
      return { ok: true, message: 'OLAP bridge is reachable.' };
    }
    return { ok: false, message: 'OLAP bridge health did not return ok.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'OLAP bridge unreachable.' };
  }
};
