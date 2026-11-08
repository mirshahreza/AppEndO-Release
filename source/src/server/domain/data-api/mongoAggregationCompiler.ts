import type { PivotResult, PivotSpec } from '../../../shared/api/contracts/data-api';
import { groupedRowsToPivotResult } from './pivotFlatDataset';
import { DEFAULT_PIVOT_CELL_CAP } from '../../../shared/api/contracts/data-api';

export type MongoWhitelistField = {
  path: string;
  type: string;
};

export type MongoAggregationCompileInput = {
  collection: string;
  whitelist: MongoWhitelistField[];
  spec: PivotSpec;
  recordPolicyMatch?: Record<string, unknown>;
  cellCap?: number;
  maxTimeMS?: number;
};

const aggregationOperator = (aggregation: string): string => {
  switch (aggregation) {
    case 'sum':
      return '$sum';
    case 'avg':
      return '$avg';
    case 'min':
      return '$min';
    case 'max':
      return '$max';
    case 'countDistinct':
      return '$addToSet';
    case 'count':
    default:
      return '$sum';
  }
};

const assertWhitelisted = (field: string, whitelist: MongoWhitelistField[]): void => {
  if (!whitelist.some((item) => item.path === field)) {
    throw new Error(`Mongo pivot field "${field}" is not in the declared whitelist.`);
  }
};

export const compileMongoAggregationPipeline = (
  input: MongoAggregationCompileInput,
): { collection: string; pipeline: Record<string, unknown>[]; maxTimeMS: number } => {
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

  const groupFields = [...spec.rows.map((item) => item.field), ...spec.columns.map((item) => item.field)];
  const id: Record<string, string> = {};
  for (const field of groupFields) {
    id[field] = `$${field}`;
  }

  const group: Record<string, unknown> = { _id: Object.keys(id).length > 0 ? id : null };
  spec.measures.forEach((measure, index) => {
    if (measure.aggregation === 'count') {
      group[`m${index}`] = { $sum: 1 };
      return;
    }
    group[`m${index}`] = { [aggregationOperator(measure.aggregation)]: `$${measure.field}` };
  });

  const match: Record<string, unknown> = { ...(input.recordPolicyMatch ?? {}) };
  for (const [field, operators] of Object.entries(spec.filters ?? {})) {
    for (const [operator, value] of Object.entries(operators)) {
      if (operator === 'eq') {
        match[field] = value;
      } else if (operator === 'gt') {
        match[field] = { ...(typeof match[field] === 'object' ? match[field] as object : {}), $gt: value };
      } else if (operator === 'gte') {
        match[field] = { ...(typeof match[field] === 'object' ? match[field] as object : {}), $gte: value };
      } else if (operator === 'lt') {
        match[field] = { ...(typeof match[field] === 'object' ? match[field] as object : {}), $lt: value };
      } else if (operator === 'lte') {
        match[field] = { ...(typeof match[field] === 'object' ? match[field] as object : {}), $lte: value };
      } else if (operator === 'ne') {
        match[field] = { $ne: value };
      } else if (operator === 'in') {
        match[field] = { $in: Array.isArray(value) ? value : String(value).split(',').map((item) => item.trim()).filter(Boolean) };
      }
    }
  }

  const pipeline: Record<string, unknown>[] = [];
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  pipeline.push({ $group: group });
  const project: Record<string, unknown> = {};
  groupFields.forEach((field) => {
    project[field] = `$_id.${field}`;
  });
  spec.measures.forEach((measure, index) => {
    if (measure.aggregation === 'countDistinct') {
      project[`m${index}`] = { $size: { $ifNull: [`$m${index}`, []] } };
    } else {
      project[`m${index}`] = `$m${index}`;
    }
  });
  pipeline.push({ $project: project });
  pipeline.push({ $limit: input.cellCap ?? DEFAULT_PIVOT_CELL_CAP });

  return {
    collection: input.collection,
    pipeline,
    maxTimeMS: input.maxTimeMS ?? 30_000,
  };
};

export const mongoDocumentsToPivotResult = (
  documents: Array<Record<string, unknown>>,
  spec: PivotSpec,
): PivotResult => groupedRowsToPivotResult(documents, spec);
