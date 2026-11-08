import type { PivotResult, PivotSpec } from '../../../shared/api/contracts/data-api';
import { groupedRowsToPivotResult } from './pivotFlatDataset';
import { DEFAULT_PIVOT_CELL_CAP } from '../../../shared/api/contracts/data-api';

export type ElasticsearchWhitelistField = {
  path: string;
  type: string;
};

export type ElasticsearchAggregationCompileInput = {
  index: string;
  whitelist: ElasticsearchWhitelistField[];
  spec: PivotSpec;
  recordPolicyFilter?: Record<string, unknown>;
  cellCap?: number;
  timeout: string;
};

const metricAgg = (aggregation: string, field: string): Record<string, unknown> => {
  switch (aggregation) {
    case 'sum':
      return { sum: { field } };
    case 'avg':
      return { avg: { field } };
    case 'min':
      return { min: { field } };
    case 'max':
      return { max: { field } };
    case 'countDistinct':
      return { cardinality: { field } };
    case 'count':
    default:
      return { value_count: { field } };
  }
};

const assertWhitelisted = (field: string, whitelist: ElasticsearchWhitelistField[]): void => {
  if (!whitelist.some((item) => item.path === field)) {
    throw new Error(`Elasticsearch pivot field "${field}" is not in the declared whitelist.`);
  }
};

export const compileElasticsearchAggregation = (
  input: ElasticsearchAggregationCompileInput,
): { index: string; body: Record<string, unknown> } => {
  const { spec, whitelist } = input;
  for (const field of [
    ...spec.rows.map((item) => item.field),
    ...spec.columns.map((item) => item.field),
    ...spec.measures.map((item) => item.field),
    ...Object.keys(spec.filters ?? {}),
  ]) {
    if (field !== '*') {
      assertWhitelisted(field, whitelist);
    }
  }

  const filterClauses: Record<string, unknown>[] = [];
  if (input.recordPolicyFilter) {
    filterClauses.push(input.recordPolicyFilter);
  }
  for (const [field, operators] of Object.entries(spec.filters ?? {})) {
    for (const [operator, value] of Object.entries(operators)) {
      if (operator === 'eq') {
        filterClauses.push({ term: { [field]: value } });
      } else if (operator === 'in') {
        const values = Array.isArray(value) ? value : String(value).split(',').map((item) => item.trim()).filter(Boolean);
        filterClauses.push({ terms: { [field]: values } });
      } else if (operator === 'gte' || operator === 'gt' || operator === 'lte' || operator === 'lt') {
        filterClauses.push({ range: { [field]: { [operator]: value } } });
      }
    }
  }

  const groupFields = [...spec.rows.map((item) => item.field), ...spec.columns.map((item) => item.field)];
  const size = input.cellCap ?? DEFAULT_PIVOT_CELL_CAP;
  let aggregations: Record<string, unknown> = {};
  spec.measures.forEach((measure, index) => {
    aggregations[`m${index}`] = metricAgg(measure.aggregation, measure.field);
  });

  for (const field of [...groupFields].reverse()) {
    aggregations = {
      [field]: {
        terms: { field, size },
        aggs: aggregations,
      },
    };
  }

  return {
    index: input.index,
    body: {
      size: 0,
      timeout: input.timeout,
      query: filterClauses.length > 0 ? { bool: { filter: filterClauses } } : { match_all: {} },
      aggs: aggregations,
    },
  };
};

type EsBucket = {
  key?: unknown;
  doc_count?: number;
  buckets?: EsBucket[];
  [name: string]: unknown;
};

const flattenBuckets = (
  aggregations: Record<string, unknown> | undefined,
  fields: string[],
  prefix: Record<string, unknown>,
  spec: PivotSpec,
): Array<Record<string, unknown>> => {
  if (fields.length === 0) {
    const row: Record<string, unknown> = { ...prefix };
    spec.measures.forEach((_, index) => {
      const metric = aggregations?.[`m${index}`] as { value?: unknown } | undefined;
      row[`m${index}`] = metric?.value ?? aggregations?.doc_count;
    });
    return [row];
  }
  const [field, ...rest] = fields;
  const container = aggregations?.[field] as { buckets?: EsBucket[] } | undefined;
  const buckets = container?.buckets ?? [];
  return buckets.flatMap((bucket) => flattenBuckets(
    bucket as Record<string, unknown>,
    rest,
    { ...prefix, [field]: bucket.key },
    spec,
  ));
};

export const elasticsearchAggregationsToPivotResult = (
  aggregations: Record<string, unknown> | undefined,
  spec: PivotSpec,
): PivotResult => {
  const groupFields = [...spec.rows.map((item) => item.field), ...spec.columns.map((item) => item.field)];
  const rows = flattenBuckets(aggregations, groupFields, {}, spec);
  return groupedRowsToPivotResult(rows, spec);
};
